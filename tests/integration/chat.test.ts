import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getChatMessages, getChatUpdates, getUnreadChatCount } from "@/lib/data/chat";
import type { Database } from "@/lib/db/client";
import { chatMessage, chatRead } from "@/lib/db/schema";
import { deleteChatMessage, markChatRead, postChatMessage } from "@/lib/services/chat";
import { anonymizeUser } from "@/lib/services/players";
import { cancelQuestion, resolveQuestion } from "@/lib/services/questions";
import type { Actor } from "@/lib/services/result";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { createCategory, createPrediction, createQuestion, createUser } from "../helpers/factories";

// General chat (architecture §5.15, vectors CH1 to CH10, step 8d): services and reads, with an
// injected clock.

const clock = makeClock("2026-10-15T10:00:00Z");
const now = clock.now;

let db: Database;
let close: () => Promise<void>;
let admin: Actor;
let lea: Actor;
let hugo: Actor;

const actorOf = (row: { id: string; role: string | null; banned: boolean | null }): Actor => ({
  id: row.id,
  role: row.role === "admin" ? "admin" : "player",
  banned: row.banned === true,
});

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  admin = actorOf(await createUser(db, { role: "admin", name: "Admin" }));
  lea = actorOf(await createUser(db, { name: "Léa" }));
  hugo = actorOf(await createUser(db, { name: "Hugo" }));
});

afterEach(async () => {
  await close();
});

async function post(actor: Actor, body: string, at = now) {
  const result = await postChatMessage(db, actor, { body }, at);
  if (!result.ok) throw new Error(`post refused: ${result.code}`);
  return result.data.id;
}

async function rowOf(id: number) {
  const [row] = await db.select().from(chatMessage).where(eq(chatMessage.id, id));
  return row;
}

/** A number question closed yesterday, with Léa 240, Hugo 262 and Admin 235, real value to come. */
async function closedNumberQuestion() {
  const categoryId = (await createCategory(db, "JPO")).id;
  const q = await createQuestion(db, {
    categoryId,
    createdBy: admin.id,
    title: "Combien de participants à la JPO de septembre ?",
    unit: "participants",
    status: "published",
    opensAt: clock.at("-8d"),
    closesAt: clock.at("-1d"),
  });
  for (const [actor, valueNumber] of [[lea, 240], [hugo, 262], [admin, 235]] as const) {
    await createPrediction(db, { questionId: q.id, userId: actor.id, valueNumber });
  }
  return q;
}

describe("postChatMessage (§5.15)", () => {
  it("CH1: accepts 500 code points, emojis included, and refuses 501", async () => {
    const text = `${"🎉".repeat(100)}${"a".repeat(400)}`;
    const result = await postChatMessage(db, lea, { body: text }, now);
    expect(result).toMatchObject({ ok: true });
    expect((await rowOf((result as { data: { id: number } }).data.id)).body).toBe(text);
    expect(await postChatMessage(db, lea, { body: `${text}a` }, now)).toMatchObject({
      ok: false,
      code: "MESSAGE_TOO_LONG",
      message: "500 caractères au maximum.",
      fieldErrors: { body: "500 caractères au maximum." },
    });
  });

  it("CH2: refuses an empty message, or one made of spaces and line breaks", async () => {
    for (const body of ["", "   ", " \n\r\n\t "]) {
      expect(await postChatMessage(db, lea, { body }, now), JSON.stringify(body)).toMatchObject({
        ok: false,
        code: "EMPTY_MESSAGE",
        message: "Écris un message.",
      });
    }
    expect(await db.select().from(chatMessage)).toHaveLength(0);
  });

  it("normalizes the line ends and trims the text, inner line breaks kept", async () => {
    const id = await post(lea, "  Salut l'équipe !\r\n\r\nQui vient à la JPO ? 🎓  \n");
    expect(await rowOf(id)).toMatchObject({ kind: "message", userId: lea.id, body: "Salut l'équipe !\n\nQui vient à la JPO ? 🎓", createdAt: now });
  });

  it("refuses a text far beyond the limit before reading it, and anything that is not a text", async () => {
    expect(await postChatMessage(db, lea, { body: "a".repeat(10_001) }, now)).toMatchObject({ ok: false, code: "MESSAGE_TOO_LONG" });
    expect(await postChatMessage(db, lea, { body: 12 }, now)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(await postChatMessage(db, lea, {}, now)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("CH3: refuses the 11th message within 60 s, then accepts one 60 s after the first", async () => {
    for (let n = 0; n < 10; n += 1) await post(lea, `Message ${n + 1}`, new Date(now.getTime() + n * 1000));
    const eleventh = await postChatMessage(db, lea, { body: "Encore un" }, clock.at("+30s"));
    expect(eleventh).toMatchObject({ ok: false, code: "CHAT_RATE_LIMITED", message: "Doucement : 10 messages par minute au maximum." });
    // The others are not slowed down.
    expect(await postChatMessage(db, hugo, { body: "Moi aussi" }, clock.at("+30s"))).toMatchObject({ ok: true });
    // The first message was posted exactly 60 s before: it no longer counts.
    expect(await postChatMessage(db, lea, { body: "Encore un" }, clock.at("+60s"))).toMatchObject({ ok: true });
  });

  it("counts the deleted messages in the limit", async () => {
    for (let n = 0; n < 10; n += 1) {
      const id = await post(lea, `Message ${n + 1}`, new Date(now.getTime() + n * 1000));
      await deleteChatMessage(db, lea, { messageId: id }, now);
    }
    expect(await postChatMessage(db, lea, { body: "Encore un" }, clock.at("+30s"))).toMatchObject({ ok: false, code: "CHAT_RATE_LIMITED" });
  });

  it("CH4: refuses a disabled account and an anonymous visitor", async () => {
    const disabled = actorOf(await createUser(db, { name: "Nora", banned: true }));
    expect(await postChatMessage(db, disabled, { body: "Coucou" }, now)).toMatchObject({ ok: false, code: "ACCOUNT_DISABLED" });
    expect(await postChatMessage(db, null, { body: "Coucou" }, now)).toMatchObject({ ok: false, code: "NOT_AUTHENTICATED" });
    expect(await db.select().from(chatMessage)).toHaveLength(0);
  });
});

describe("deleteChatMessage (§5.15)", () => {
  it("CH5: a player deletes their own message, its text erased, not another's nor a result message", async () => {
    const own = await post(lea, "Je pense 250 😉");
    const other = await post(hugo, "Moi 262");
    const q = await closedNumberQuestion();
    await resolveQuestion(db, admin, { questionId: q.id, rawValue: "250" }, now);
    const [result] = await db.select().from(chatMessage).where(eq(chatMessage.kind, "result"));

    expect(await deleteChatMessage(db, lea, { messageId: own }, clock.at("+1min"))).toEqual({ ok: true, data: undefined });
    expect(await rowOf(own)).toMatchObject({ body: null, deletedAt: clock.at("+1min"), deletedBy: lea.id, userId: lea.id });
    expect(await deleteChatMessage(db, lea, { messageId: other }, now)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await deleteChatMessage(db, lea, { messageId: result.id }, now)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await rowOf(other)).toMatchObject({ body: "Moi 262", deletedAt: null });
    expect(await rowOf(result.id)).toMatchObject({ deletedAt: null });
  });

  it("CH6: an admin deletes a player's message and a result message", async () => {
    const message = await post(hugo, "Message à modérer");
    const q = await closedNumberQuestion();
    await resolveQuestion(db, admin, { questionId: q.id, rawValue: "250" }, now);
    const [result] = await db.select().from(chatMessage).where(eq(chatMessage.kind, "result"));

    expect(await deleteChatMessage(db, admin, { messageId: message }, now)).toMatchObject({ ok: true });
    expect(await rowOf(message)).toMatchObject({ body: null, deletedBy: admin.id });
    expect(await deleteChatMessage(db, admin, { messageId: result.id }, now)).toMatchObject({ ok: true });
    expect(await rowOf(result.id)).toMatchObject({ deletedAt: now, deletedBy: admin.id });
  });

  it("refuses an unknown or already deleted message", async () => {
    const id = await post(lea, "Bonjour");
    await deleteChatMessage(db, lea, { messageId: id }, now);
    for (const messageId of [id, 999]) {
      expect(await deleteChatMessage(db, admin, { messageId }, now)).toMatchObject({ ok: false, code: "MESSAGE_NOT_FOUND", message: "Ce message n'existe plus." });
    }
    expect(await deleteChatMessage(db, admin, { messageId: "abc" }, now)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });
});

describe("markChatRead and the unread count (§5.15)", () => {
  it("counts the others' messages after the latest one read, all of them before the first visit", async () => {
    await post(hugo, "Un");
    await post(admin, "Deux");
    const mine = await post(lea, "Trois");
    expect(await getUnreadChatCount(db, lea)).toBe(2);
    expect(await getUnreadChatCount(db, hugo)).toBe(2);

    expect(await markChatRead(db, lea, { lastMessageId: mine }, now)).toEqual({ ok: true, data: undefined });
    expect(await getUnreadChatCount(db, lea)).toBe(0);
    await post(hugo, "Quatre");
    expect(await getUnreadChatCount(db, lea)).toBe(1);
  });

  it("CH7: an id smaller than the latest one read changes nothing", async () => {
    const first = await post(hugo, "Un");
    const second = await post(hugo, "Deux");
    await markChatRead(db, lea, { lastMessageId: second }, now);
    expect(await markChatRead(db, lea, { lastMessageId: first }, clock.at("+1h"))).toMatchObject({ ok: true });
    expect(await db.select().from(chatRead)).toEqual([{ userId: lea.id, lastReadId: second, updatedAt: now }]);
  });

  it("refuses an id beyond the latest message", async () => {
    const id = await post(hugo, "Un");
    expect(await markChatRead(db, lea, { lastMessageId: id + 1 }, now)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(await markChatRead(db, lea, { lastMessageId: 0 }, now)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(await db.select().from(chatRead)).toHaveLength(0);
  });

  it("CH8: leaves out the viewer's own messages and the deleted ones; counts the result messages", async () => {
    const deleted = await post(hugo, "Oups");
    await deleteChatMessage(db, hugo, { messageId: deleted }, now);
    await post(lea, "Le mien");
    expect(await getUnreadChatCount(db, lea)).toBe(0);
    const q = await closedNumberQuestion();
    await resolveQuestion(db, admin, { questionId: q.id, rawValue: "250" }, now);
    expect(await getUnreadChatCount(db, lea)).toBe(1);
    expect(await getUnreadChatCount(db, admin)).toBe(2);
  });
});

describe("result message (§5.15)", () => {
  it("CH9: one message at the first entry, none at a correction, whose text changes; hidden once the question is cancelled", async () => {
    const q = await closedNumberQuestion();
    await resolveQuestion(db, admin, { questionId: q.id, rawValue: "245" }, now);
    const results = await db.select().from(chatMessage).where(eq(chatMessage.kind, "result"));
    expect(results).toEqual([expect.objectContaining({ kind: "result", questionId: q.id, userId: null, body: null, createdAt: now })]);
    let page = await getChatMessages(db, lea, {}, now);
    expect(page.messages).toEqual([
      expect.objectContaining({
        kind: "result",
        author: null,
        result: { questionId: q.id, text: "Résultat : Combien de participants à la JPO de septembre ? → 245 participants. Le plus proche : Léa." },
      }),
    ]);

    // Correction to 248,5: no second message; Léa (240) is still the closest, 8,5 away.
    expect(await resolveQuestion(db, admin, { questionId: q.id, rawValue: "248.5" }, clock.at("+1h"))).toMatchObject({ ok: true, data: { corrected: true } });
    expect(await db.select().from(chatMessage).where(eq(chatMessage.kind, "result"))).toHaveLength(1);
    page = await getChatMessages(db, lea, {}, now);
    expect(page.messages[0].result?.text).toBe(
      "Résultat (corrigé) : Combien de participants à la JPO de septembre ? → 248,5 participants. Le plus proche : Léa.",
    );

    // The same result again changes nothing.
    await resolveQuestion(db, admin, { questionId: q.id, rawValue: "248,5" }, clock.at("+2h"));
    expect(await db.select().from(chatMessage).where(eq(chatMessage.kind, "result"))).toHaveLength(1);

    await cancelQuestion(db, admin, { questionId: q.id }, clock.at("+3h"));
    expect((await getChatMessages(db, lea, {}, now)).messages).toEqual([]);
    expect(await getUnreadChatCount(db, lea)).toBe(0);
  });

  it("names every closest prediction, ties included", async () => {
    const q = await closedNumberQuestion();
    // 251: Léa (240) is 11 away, Hugo (262) 11 away, Admin (235) 16.
    await resolveQuestion(db, admin, { questionId: q.id, rawValue: "251" }, now);
    const [message] = (await getChatMessages(db, hugo, {}, now)).messages;
    expect(message.result?.text).toMatch(/→ 251 participants\. Les plus proches : Hugo et Léa\.$/);
  });

  it("gives the right answer of a choice question, and how many found it", async () => {
    const categoryId = (await createCategory(db, "Intégration")).id;
    const q = await createQuestion(db, {
      categoryId,
      createdBy: admin.id,
      type: "choice",
      title: "Quel campus comptera le plus d'intégrés en Bachelor ?",
      options: ["Caen", "Le Havre", "Paris"],
      status: "published",
      opensAt: clock.at("-8d"),
      closesAt: clock.at("-1d"),
    });
    const optionId = (label: string) => q.options.find((option) => option.label === label)!.id;
    await createPrediction(db, { questionId: q.id, userId: lea.id, optionId: optionId("Le Havre") });
    await createPrediction(db, { questionId: q.id, userId: hugo.id, optionId: optionId("Caen") });
    await resolveQuestion(db, admin, { questionId: q.id, optionId: optionId("Le Havre") }, now);
    const [message] = (await getChatMessages(db, lea, {}, now)).messages;
    expect(message.result?.text).toBe("Résultat : Quel campus comptera le plus d'intégrés en Bachelor ? → Le Havre. 1 bonne réponse sur 2 pronos.");
  });

  it("leaves out the second sentence when nobody predicted the question", async () => {
    const q = await createQuestion(db, { createdBy: admin.id, title: "Combien de visiteurs au salon ?", unit: "visiteurs", status: "published", opensAt: clock.at("-8d"), closesAt: clock.at("-1d") });
    await resolveQuestion(db, admin, { questionId: q.id, rawValue: "1200" }, now);
    const [message] = (await getChatMessages(db, lea, {}, now)).messages;
    expect(message.result?.text).toBe("Résultat : Combien de visiteurs au salon ? → 1 200 visiteurs.");
  });

  it("is not posted when the result is refused", async () => {
    const q = await closedNumberQuestion();
    expect(await resolveQuestion(db, admin, { questionId: q.id, rawValue: "abc" }, now)).toMatchObject({ ok: false });
    expect(await resolveQuestion(db, lea, { questionId: q.id, rawValue: "250" }, now)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await db.select().from(chatMessage)).toHaveLength(0);
  });
});

describe("anonymization (§5.15, §6.3)", () => {
  it("CH10: erases every message of the account, as a deletion by the admin", async () => {
    const first = await post(hugo, "Mon premier message");
    const second = await post(hugo, "Mon second message");
    const other = await post(lea, "Le message de Léa");
    await deleteChatMessage(db, hugo, { messageId: first }, clock.at("-1h"));

    expect(await anonymizeUser(db, admin, { userId: hugo.id }, now)).toMatchObject({ ok: true });
    expect(await rowOf(first)).toMatchObject({ body: null, deletedAt: clock.at("-1h"), deletedBy: hugo.id });
    expect(await rowOf(second)).toMatchObject({ body: null, deletedAt: now, deletedBy: admin.id });
    expect(await rowOf(other)).toMatchObject({ body: "Le message de Léa", deletedAt: null });

    const page = await getChatMessages(db, lea, {}, now);
    expect(page.messages.map(({ author, body, deleted }) => ({ name: author?.name, inactive: author?.inactive, body, deleted }))).toEqual([
      { name: "Ancien joueur 1", inactive: true, body: null, deleted: true },
      { name: "Ancien joueur 1", inactive: true, body: null, deleted: true },
      { name: "Léa", inactive: false, body: "Le message de Léa", deleted: false },
    ]);
  });
});

describe("getChatMessages (§5.15)", () => {
  it("gives the latest 50 messages, oldest first, then the 50 before an id", async () => {
    const ids: number[] = [];
    for (let n = 0; n < 120; n += 1) {
      const [row] = await db
        .insert(chatMessage)
        .values({ kind: "message", userId: n % 2 ? lea.id : hugo.id, body: `Message ${n + 1}`, createdAt: new Date(now.getTime() + n * 1000) })
        .returning();
      ids.push(row.id);
    }
    const latest = await getChatMessages(db, lea, {}, now);
    expect(latest.messages.map(({ id }) => id)).toEqual(ids.slice(70));
    expect(latest.hasMore).toBe(true);
    expect(latest.serverTime).toBe(now.toISOString());

    const before = await getChatMessages(db, lea, { beforeId: ids[70] }, now);
    expect(before.messages.map(({ id }) => id)).toEqual(ids.slice(20, 70));
    expect(before.hasMore).toBe(true);
    const oldest = await getChatMessages(db, lea, { beforeId: ids[20] }, now);
    expect(oldest.messages.map(({ id }) => id)).toEqual(ids.slice(0, 20));
    expect(oldest.hasMore).toBe(false);
  });

  it("describes each message: author, date, text, and who may delete it", async () => {
    const own = await post(lea, "Bravo 🎉", clock.at("-2min"));
    const other = await post(hugo, "Merci 🙏", clock.at("-1min"));
    await deleteChatMessage(db, hugo, { messageId: other }, now);

    const forLea = await getChatMessages(db, lea, {}, now);
    expect(forLea.messages).toEqual([
      {
        id: own,
        kind: "message",
        createdAt: clock.at("-2min").toISOString(),
        author: { id: lea.id, name: "Léa", avatar: expect.stringMatching(/^maillot-/), inactive: false },
        body: "Bravo 🎉",
        deleted: false,
        result: null,
        canDelete: true,
      },
      {
        id: other,
        kind: "message",
        createdAt: clock.at("-1min").toISOString(),
        author: { id: hugo.id, name: "Hugo", avatar: expect.stringMatching(/^maillot-/), inactive: false },
        body: null,
        deleted: true,
        result: null,
        canDelete: false,
      },
    ]);
    const forAdmin = await getChatMessages(db, admin, {}, now);
    expect(forAdmin.messages.map(({ canDelete }) => canDelete)).toEqual([true, false]);
    expect((await getChatMessages(db, hugo, {}, now)).messages.map(({ canDelete }) => canDelete)).toEqual([false, false]);
  });
});

describe("getChatUpdates (§5.15)", () => {
  it("gives the new messages and the deletions since the previous poll, and the time to send back", async () => {
    const t0 = clock.at("-10min");
    const old = await post(hugo, "Ancien", t0);
    const toDelete = await post(lea, "À supprimer", t0);

    const later = clock.at("+5min");
    const fresh = await post(hugo, "Nouveau", clock.at("+4min"));
    await deleteChatMessage(db, lea, { messageId: toDelete }, clock.at("+4min"));

    const updates = await getChatUpdates(db, lea, { afterId: toDelete, since: now }, later);
    expect(updates.messages.map(({ id, body }) => ({ id, body }))).toEqual([{ id: fresh, body: "Nouveau" }]);
    expect(updates.deletedIds).toEqual([toDelete]);
    expect(updates.serverTime).toBe(later.toISOString());
    expect(updates.messages.map(({ id }) => id)).not.toContain(old);
  });

  it("never sends the text of a deleted message (§9.3)", async () => {
    const id = await post(hugo, "Texte secret supprimé", clock.at("+1min"));
    await deleteChatMessage(db, hugo, { messageId: id }, clock.at("+2min"));
    const updates = await getChatUpdates(db, lea, { afterId: 0, since: now }, clock.at("+3min"));
    expect(JSON.stringify(updates)).not.toContain("Texte secret");
    expect(updates.messages).toEqual([expect.objectContaining({ id, deleted: true, body: null })]);
  });

  it("repeats the last minute, so that a message committed after a larger id is not missed", async () => {
    // Two messages a second apart; the poll already saw the second (larger id) but not the first.
    const [first] = await db.insert(chatMessage).values({ kind: "message", userId: hugo.id, body: "Premier", createdAt: clock.at("-30s") }).returning();
    const [second] = await db.insert(chatMessage).values({ kind: "message", userId: lea.id, body: "Second", createdAt: clock.at("-29s") }).returning();
    const updates = await getChatUpdates(db, lea, { afterId: second.id, since: now }, clock.at("+10s"));
    expect(updates.messages.map(({ id }) => id)).toEqual([first.id, second.id]);
    // A message older than the margin is not sent again.
    const [oldOne] = await db.insert(chatMessage).values({ kind: "message", userId: hugo.id, body: "Vieux", createdAt: clock.at("-2min") }).returning();
    expect((await getChatUpdates(db, lea, { afterId: oldOne.id, since: now }, clock.at("+10s"))).messages.map(({ id }) => id)).toEqual([first.id, second.id]);
  });

  it("sends 100 new messages at most, oldest first", async () => {
    for (let n = 0; n < 105; n += 1) {
      await db.insert(chatMessage).values({ kind: "message", userId: hugo.id, body: `Message ${n + 1}`, createdAt: clock.at("-1d") });
    }
    const updates = await getChatUpdates(db, lea, { afterId: 0, since: now }, now);
    expect(updates.messages).toHaveLength(100);
    expect(updates.messages[0].body).toBe("Message 1");
    expect(updates.messages[99].body).toBe("Message 100");
  });
});
