import { and, count, eq, gt, max, sql } from "drizzle-orm";
import { z } from "zod";
import { CHAT_MAX_LENGTH, CHAT_MAX_PER_MINUTE, CHAT_RATE_WINDOW_MS } from "@/lib/chat/constants";
import { messageLength, normalizeMessageBody } from "@/lib/chat/message-body";
import type { Database } from "@/lib/db/client";
import { chatMessage, chatRead, user } from "@/lib/db/schema";
import { type Actor, authorize, ERROR_MESSAGES, fail, isFailure, ok, type Result } from "./result";

// General chat (architecture §5.15, v1.2, step 8d): one thread for the whole team, open to every
// signed-in account that is not disabled. A message is never edited; deleting it erases its text.
// The result messages are posted by resolveQuestion (services/questions.ts), and the messages of an
// anonymized account are erased by anonymizeUser (services/players.ts).

/** A pasted text far beyond the limit is refused before being read. */
const MAX_RAW_LENGTH = 20 * CHAT_MAX_LENGTH;

const postInput = z.object({ body: z.string() });

/**
 * Posts a message (§5.15): its text is normalized (line ends, spaces at both ends), then holds 1 to
 * 500 code points. At most 10 messages per account over the last 60 seconds, deleted ones
 * included: the account row is locked (FOR NO KEY UPDATE) before counting, so that two quick
 * clicks cannot pass the limit together.
 */
export async function postChatMessage(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now: Date,
): Promise<Result<{ id: number }>> {
  const me = authorize(actor);
  if (isFailure(me)) return me;
  const parsed = postInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  if (parsed.data.body.length > MAX_RAW_LENGTH) return fail("MESSAGE_TOO_LONG", undefined, { body: ERROR_MESSAGES.MESSAGE_TOO_LONG });
  const body = normalizeMessageBody(parsed.data.body);
  if (body === "") return fail("EMPTY_MESSAGE", undefined, { body: ERROR_MESSAGES.EMPTY_MESSAGE });
  if (messageLength(body) > CHAT_MAX_LENGTH) return fail("MESSAGE_TOO_LONG", undefined, { body: ERROR_MESSAGES.MESSAGE_TOO_LONG });

  return db.transaction(async (tx) => {
    const [account] = await tx.select({ id: user.id }).from(user).where(eq(user.id, me.id)).for("no key update");
    if (!account) return fail("NOT_AUTHENTICATED");
    const since = new Date(now.getTime() - CHAT_RATE_WINDOW_MS);
    const [{ recent }] = await tx
      .select({ recent: count() })
      .from(chatMessage)
      .where(and(eq(chatMessage.userId, me.id), gt(chatMessage.createdAt, since)));
    if (recent >= CHAT_MAX_PER_MINUTE) return fail("CHAT_RATE_LIMITED");
    const [row] = await tx.insert(chatMessage).values({ kind: "message", userId: me.id, body, createdAt: now }).returning({ id: chatMessage.id });
    return ok({ id: row.id });
  });
}

const messageInput = z.object({ messageId: z.coerce.number().int().positive() });

/**
 * Deletes a message (§5.15): a player's message by its author or an admin, a result message by an
 * admin only. Its text is erased, not just hidden: « Message supprimé. » shows in its place.
 */
export async function deleteChatMessage(db: Database, actor: Actor | null, input: unknown, now: Date): Promise<Result> {
  const me = authorize(actor);
  if (isFailure(me)) return me;
  const parsed = messageInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: chatMessage.id, kind: chatMessage.kind, userId: chatMessage.userId, deletedAt: chatMessage.deletedAt })
      .from(chatMessage)
      .where(eq(chatMessage.id, parsed.data.messageId))
      .for("update");
    if (!row || row.deletedAt) return fail("MESSAGE_NOT_FOUND");
    const allowed = me.role === "admin" || (row.kind === "message" && row.userId === me.id);
    if (!allowed) return fail("FORBIDDEN");
    await tx.update(chatMessage).set({ body: null, deletedAt: now, deletedBy: me.id }).where(eq(chatMessage.id, row.id));
    return ok();
  });
}

const readInput = z.object({ lastMessageId: z.coerce.number().int().positive() });

/**
 * Marks the chat as read up to a message (§5.15), called by the chat page while it shows messages,
 * tab visible. The latest read message only moves forward; an id beyond the latest message is
 * refused.
 */
export async function markChatRead(db: Database, actor: Actor | null, input: unknown, now: Date): Promise<Result> {
  const me = authorize(actor);
  if (isFailure(me)) return me;
  const parsed = readInput.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");
  const { lastMessageId } = parsed.data;

  const [{ latest }] = await db.select({ latest: max(chatMessage.id) }).from(chatMessage);
  if (latest === null || lastMessageId > latest) return fail("INVALID_INPUT");
  await db
    .insert(chatRead)
    .values({ userId: me.id, lastReadId: lastMessageId, updatedAt: now })
    .onConflictDoUpdate({
      target: chatRead.userId,
      set: { lastReadId: sql`excluded.last_read_id`, updatedAt: sql`excluded.updated_at` },
      setWhere: sql`${chatRead.lastReadId} < excluded.last_read_id`,
    });
  return ok();
}
