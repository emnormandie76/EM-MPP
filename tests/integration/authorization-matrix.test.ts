import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/client";
import {
  account,
  allowedEmail,
  announcement,
  category,
  chatMessage,
  chatRead,
  prediction,
  predictionEvent,
  prize,
  question,
  questionExtension,
  questionOption,
  season,
  seasonStanding,
  session,
  user,
} from "@/lib/db/schema";
import { createAnnouncement, deleteAnnouncement, updateAnnouncement } from "@/lib/services/announcements";
import { archiveCategory, createCategory, renameCategory, unarchiveCategory } from "@/lib/services/categories";
import { deleteChatMessage, markChatRead, postChatMessage } from "@/lib/services/chat";
import { cancelQuestionExtension, setQuestionExtension } from "@/lib/services/extensions";
import { addAllowedEmails, anonymizeUser, disableUser, enableUser, removeAllowedEmail, setRole, setTemporaryPassword } from "@/lib/services/players";
import { savePrediction, setJoker, unlockPrediction, validatePrediction } from "@/lib/services/predictions";
import { recordVisit, updateAvatar, updateDisplayName } from "@/lib/services/profile";
import {
  cancelQuestion,
  createQuestion,
  deleteDraftQuestion,
  duplicateQuestion,
  publishQuestions,
  resolveQuestion,
  setQuestionDates,
  updateQuestion,
} from "@/lib/services/questions";
import type { Actor, ErrorCode, Result } from "@/lib/services/result";
import { createSeason, deleteSeason, proclaimSeason, updateSeason, upsertPrizes } from "@/lib/services/seasons";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import {
  createPrediction,
  createQuestion as insertQuestion,
  createCategory as insertCategory,
  createUser,
  ensureTestSeason,
} from "../helpers/factories";

// Authorization matrix (architecture §6.5, §9.3): every write service of §7.3, called by each
// profile — anonymous, player, disabled player, disabled admin, admin — gives the expected answer.
// A refused call writes nothing; an allowed one succeeds, on data prepared for it.

const clock = makeClock("2026-10-15T10:00:00Z");
const now = clock.now;

type Profile = "anonymous" | "player" | "disabled player" | "disabled admin" | "admin";
/** Admin only, or any signed-in account that is not disabled (players play their own predictions; the admin plays too). */
type Access = "admin" | "account";

const EXPECTED: Record<Access, Record<Profile, ErrorCode | "ok">> = {
  admin: {
    anonymous: "NOT_AUTHENTICATED",
    player: "FORBIDDEN",
    "disabled player": "ACCOUNT_DISABLED",
    "disabled admin": "ACCOUNT_DISABLED",
    admin: "ok",
  },
  account: {
    anonymous: "NOT_AUTHENTICATED",
    player: "ok",
    "disabled player": "ACCOUNT_DISABLED",
    "disabled admin": "ACCOUNT_DISABLED",
    admin: "ok",
  },
};

let db: Database;
let close: () => Promise<void>;
let actors: Record<Profile, Actor | null>;
let categoryId: number;
let currentSeasonId: number;
let previousSeasonId: number;

const actorOf = (row: { id: string; role: string | null; banned: boolean | null }): Actor => ({
  id: row.id,
  role: row.role === "admin" ? "admin" : "player",
  banned: row.banned === true,
});

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  const admin = actorOf(await createUser(db, { role: "admin", name: "Admin" }));
  actors = {
    anonymous: null,
    player: actorOf(await createUser(db, { name: "Sarah" })),
    "disabled player": actorOf(await createUser(db, { name: "Parti", banned: true })),
    "disabled admin": actorOf(await createUser(db, { name: "Ancienne admin", role: "admin", banned: true })),
    admin,
  };
  categoryId = (await insertCategory(db, "JPO")).id;
  previousSeasonId = (await ensureTestSeason(db, "2025-2026")).id;
  currentSeasonId = (await ensureTestSeason(db, "2026-2027")).id;
});

afterAll(async () => {
  await close();
});

const admin = () => actors.admin!;
const player = () => actors.player!;

/** Every row of every table a service can write, to check that a refused call wrote nothing. */
async function snapshot(): Promise<string> {
  const tables = [
    user,
    session,
    account,
    allowedEmail,
    season,
    category,
    question,
    questionOption,
    questionExtension,
    prediction,
    predictionEvent,
    prize,
    announcement,
    seasonStanding,
    chatMessage,
    chatRead,
  ];
  const dumps = await Promise.all(tables.map(async (table) => (await db.select().from(table)).map((row) => JSON.stringify(row)).sort()));
  return JSON.stringify(dumps);
}

function openQuestion() {
  return insertQuestion(db, { categoryId, createdBy: admin().id, status: "published", opensAt: clock.at("-1d"), closesAt: clock.at("+5d") });
}

function draftQuestion(overrides: Parameters<typeof insertQuestion>[1] = {}) {
  return insertQuestion(db, { categoryId, createdBy: admin().id, ...overrides });
}

type Call = (actor: Actor | null) => Promise<Result<unknown>>;

/** Each service, with the data its allowed call needs; `prepare` returns the call. */
const CASES: { service: string; access: Access; prepare: () => Promise<Call> }[] = [
  // Predictions (§5.4)
  {
    service: "savePrediction",
    access: "account",
    prepare: async () => {
      const q = await openQuestion();
      return (actor) => savePrediction(db, actor, { questionId: q.id, rawValue: "120" }, now);
    },
  },
  {
    service: "validatePrediction",
    access: "account",
    prepare: async () => {
      const q = await openQuestion();
      return (actor) => validatePrediction(db, actor, { questionId: q.id, rawValue: "120" }, now);
    },
  },
  {
    service: "setJoker",
    access: "account",
    prepare: async () => {
      const q = await openQuestion();
      for (const userId of [player().id, admin().id]) await createPrediction(db, { questionId: q.id, userId });
      return (actor) => setJoker(db, actor, { questionId: q.id, enabled: true }, now);
    },
  },
  {
    service: "unlockPrediction",
    access: "admin",
    prepare: async () => {
      const q = await openQuestion();
      const p = await createPrediction(db, { questionId: q.id, userId: player().id, validatedAt: clock.at("-1h") });
      return (actor) => unlockPrediction(db, actor, { predictionId: p.id }, now);
    },
  },
  // Questions (§5.11)
  {
    service: "createQuestion",
    access: "admin",
    prepare: async () => (actor) =>
      createQuestion(
        db,
        actor,
        { kind: "number", categoryId: String(categoryId), title: "Combien de visiteurs au salon ?", unit: "visiteurs", source: "Tableau BI « Salons »" },
        now,
      ),
  },
  {
    service: "updateQuestion",
    access: "admin",
    prepare: async () => {
      const q = await draftQuestion();
      return (actor) => updateQuestion(db, actor, { questionId: q.id, title: "Combien de visiteurs au salon ?" }, now);
    },
  },
  {
    service: "deleteDraftQuestion",
    access: "admin",
    prepare: async () => {
      const q = await draftQuestion();
      return (actor) => deleteDraftQuestion(db, actor, { questionId: q.id });
    },
  },
  {
    service: "publishQuestions",
    access: "admin",
    prepare: async () => {
      const q = await draftQuestion({ opensAt: clock.at("+1d"), closesAt: clock.at("+6d") });
      return (actor) => publishQuestions(db, actor, { questionIds: [q.id] }, now);
    },
  },
  {
    service: "setQuestionDates",
    access: "admin",
    prepare: async () => {
      const q = await draftQuestion();
      return (actor) => setQuestionDates(db, actor, { questionIds: [q.id], opensAt: "2026-10-16T18:00", closesAt: "2026-10-21T18:00", expectedResultAt: "" }, now);
    },
  },
  {
    service: "duplicateQuestion",
    access: "admin",
    prepare: async () => {
      const q = await draftQuestion();
      return (actor) => duplicateQuestion(db, actor, { questionId: q.id }, now);
    },
  },
  {
    service: "cancelQuestion",
    access: "admin",
    prepare: async () => {
      const q = await openQuestion();
      return (actor) => cancelQuestion(db, actor, { questionId: q.id }, now);
    },
  },
  {
    service: "resolveQuestion",
    access: "admin",
    prepare: async () => {
      const q = await insertQuestion(db, { categoryId, createdBy: admin().id, status: "published", opensAt: clock.at("-5d"), closesAt: clock.at("-1d") });
      return (actor) => resolveQuestion(db, actor, { questionId: q.id, rawValue: "150" }, now);
    },
  },
  // Extensions (§5.14, v1.2)
  {
    service: "setQuestionExtension",
    access: "admin",
    prepare: async () => {
      const q = await insertQuestion(db, { categoryId, createdBy: admin().id, status: "published", opensAt: clock.at("-5d"), closesAt: clock.at("-1d") });
      const absent = await createUser(db, { name: "Absent" });
      return (actor) => setQuestionExtension(db, actor, { questionId: q.id, userId: absent.id, closesAt: "2026-10-17T18:00" }, now);
    },
  },
  {
    service: "cancelQuestionExtension",
    access: "admin",
    prepare: async () => {
      const q = await insertQuestion(db, { categoryId, createdBy: admin().id, status: "published", opensAt: clock.at("-5d"), closesAt: clock.at("-1d") });
      const absent = await createUser(db, { name: "Absente" });
      await db.insert(questionExtension).values({ questionId: q.id, userId: absent.id, closesAt: clock.at("+2d"), grantedBy: admin().id, grantedAt: now });
      return (actor) => cancelQuestionExtension(db, actor, { questionId: q.id, userId: absent.id }, now);
    },
  },
  // Categories
  {
    service: "createCategory",
    access: "admin",
    prepare: async () => (actor) => createCategory(db, actor, { name: "Intégration" }, now),
  },
  {
    service: "renameCategory",
    access: "admin",
    prepare: async () => {
      const c = await insertCategory(db, "Salons");
      return (actor) => renameCategory(db, actor, { categoryId: c.id, name: "Salons étudiants" });
    },
  },
  {
    service: "archiveCategory",
    access: "admin",
    prepare: async () => {
      const c = await insertCategory(db, "Webinaires");
      return (actor) => archiveCategory(db, actor, { categoryId: c.id }, now);
    },
  },
  {
    service: "unarchiveCategory",
    access: "admin",
    prepare: async () => {
      const c = await insertCategory(db, "Archivée");
      await db.update(category).set({ archivedAt: clock.at("-1d") }).where(eq(category.id, c.id));
      return (actor) => unarchiveCategory(db, actor, { categoryId: c.id });
    },
  },
  // Seasons, prizes, proclamation (§5.12, §5.13)
  {
    service: "createSeason",
    access: "admin",
    prepare: async () => (actor) => createSeason(db, actor, { label: "2027-2028", startsOn: "2027-09-27" }, now),
  },
  {
    service: "updateSeason",
    access: "admin",
    prepare: async () => {
      const s = await ensureTestSeason(db, "2029-2030");
      return (actor) => updateSeason(db, actor, { seasonId: s.id, label: "Saison 2029", startsOn: "2029-10-01" }, now);
    },
  },
  {
    service: "deleteSeason",
    access: "admin",
    prepare: async () => {
      const s = await ensureTestSeason(db, "2031-2032");
      return (actor) => deleteSeason(db, actor, { seasonId: s.id });
    },
  },
  {
    service: "upsertPrizes",
    access: "admin",
    prepare: async () => (actor) => upsertPrizes(db, actor, { seasonId: currentSeasonId, prizes: [{ rankLabel: "1er", description: "Un déjeuner d'équipe offert" }] }),
  },
  {
    service: "proclaimSeason",
    access: "admin",
    prepare: async () => {
      // The previous season, with one resolved question: ready to be proclaimed.
      await insertQuestion(db, {
        categoryId,
        createdBy: admin().id,
        status: "published",
        opensAt: new Date("2026-04-01T08:00:00Z"),
        closesAt: new Date("2026-04-08T16:00:00Z"),
        resultNumber: 180,
        resolvedAt: new Date("2026-04-20T08:00:00Z"),
      });
      return (actor) => proclaimSeason(db, actor, { seasonId: previousSeasonId }, now);
    },
  },
  // Announcements
  {
    service: "createAnnouncement",
    access: "admin",
    prepare: async () => (actor) => createAnnouncement(db, actor, { body: "Les questions sont ouvertes !" }, now),
  },
  {
    service: "updateAnnouncement",
    access: "admin",
    prepare: async () => {
      const [row] = await db.insert(announcement).values({ body: "Bienvenue", createdBy: admin().id, createdAt: clock.at("-1d"), updatedAt: clock.at("-1d") }).returning();
      return (actor) => updateAnnouncement(db, actor, { announcementId: row.id, body: "Bienvenue à tous" }, now);
    },
  },
  {
    service: "deleteAnnouncement",
    access: "admin",
    prepare: async () => {
      const [row] = await db.insert(announcement).values({ body: "À supprimer", createdBy: admin().id, createdAt: clock.at("-1d"), updatedAt: clock.at("-1d") }).returning();
      return (actor) => deleteAnnouncement(db, actor, { announcementId: row.id });
    },
  },
  // Accounts and allow list (§6.3)
  {
    service: "addAllowedEmails",
    access: "admin",
    prepare: async () => (actor) => addAllowedEmails(db, actor, { emails: "nouveau@example.test" }, now),
  },
  {
    service: "removeAllowedEmail",
    access: "admin",
    prepare: async () => {
      await db.insert(allowedEmail).values({ email: "libre@example.test" });
      return (actor) => removeAllowedEmail(db, actor, { email: "libre@example.test" });
    },
  },
  {
    service: "setRole",
    access: "admin",
    prepare: async () => {
      const target = await createUser(db);
      return (actor) => setRole(db, actor, { userId: target.id, role: "admin" }, now);
    },
  },
  {
    service: "disableUser",
    access: "admin",
    prepare: async () => {
      const target = await createUser(db);
      return (actor) => disableUser(db, actor, { userId: target.id }, now);
    },
  },
  {
    service: "enableUser",
    access: "admin",
    prepare: async () => {
      const target = await createUser(db, { banned: true });
      return (actor) => enableUser(db, actor, { userId: target.id }, now);
    },
  },
  {
    service: "setTemporaryPassword",
    access: "admin",
    prepare: async () => {
      const target = await createUser(db);
      return (actor) => setTemporaryPassword(db, actor, { userId: target.id }, now);
    },
  },
  {
    service: "anonymizeUser",
    access: "admin",
    prepare: async () => {
      const target = await createUser(db);
      return (actor) => anonymizeUser(db, actor, { userId: target.id }, now);
    },
  },
  // Own profile (§5.9, §8.3 /profil)
  {
    service: "updateDisplayName",
    access: "account",
    prepare: async () => {
      let n = 0;
      return (actor) => updateDisplayName(db, actor, { name: `Nouveau nom ${(n += 1)}` }, now);
    },
  },
  {
    service: "updateAvatar",
    access: "account",
    prepare: async () => (actor) => updateAvatar(db, actor, { avatar: "maillot-rouge-raye" }, now),
  },
  {
    service: "recordVisit",
    access: "account",
    prepare: async () => (actor) => recordVisit(db, actor, now),
  },
  // General chat (§5.15, v1.2)
  {
    service: "postChatMessage",
    access: "account",
    prepare: async () => (actor) => postChatMessage(db, actor, { body: "Bonjour l'équipe 👋" }, now),
  },
  {
    service: "deleteChatMessage",
    access: "account",
    prepare: async () => {
      // Each allowed profile deletes its own message (an admin may delete any).
      const own = async (userId: string) =>
        (await db.insert(chatMessage).values({ kind: "message", userId, body: "À supprimer", createdAt: clock.at("-1min") }).returning())[0];
      const playerMessage = await own(player().id);
      const adminMessage = await own(admin().id);
      return (actor) => deleteChatMessage(db, actor, { messageId: actor?.id === admin().id ? adminMessage.id : playerMessage.id }, now);
    },
  },
  {
    service: "markChatRead",
    access: "account",
    prepare: async () => {
      const [message] = await db.insert(chatMessage).values({ kind: "message", userId: admin().id, body: "À lire", createdAt: clock.at("-1min") }).returning();
      return (actor) => markChatRead(db, actor, { lastMessageId: message.id }, now);
    },
  },
];

const PROFILES: Profile[] = ["anonymous", "player", "disabled player", "disabled admin", "admin"];

describe("authorization matrix (§6.5, §9.3)", () => {
  it("covers the 39 write services of §7.3 (34 until step 8b, 2 extension services of step 8c, 3 chat services of step 8d)", () => {
    expect(new Set(CASES.map(({ service }) => service)).size).toBe(39);
  });

  for (const { service, access, prepare } of CASES) {
    it(`${service}: ${access === "admin" ? "admin only" : "any active account"}`, async () => {
      const call = await prepare();
      const refused = PROFILES.filter((profile) => EXPECTED[access][profile] !== "ok");
      const allowed = PROFILES.filter((profile) => EXPECTED[access][profile] === "ok");

      const before = await snapshot();
      for (const profile of refused) {
        expect(await call(actors[profile]), profile).toMatchObject({ ok: false, code: EXPECTED[access][profile] });
      }
      expect(await snapshot(), "a refused call writes nothing").toBe(before);

      for (const profile of allowed) {
        expect(await call(actors[profile]), profile).toMatchObject({ ok: true });
      }
    });
  }
});
