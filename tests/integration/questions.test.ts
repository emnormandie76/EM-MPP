import { asc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/lib/db/client";
import { category, question, questionExtension, questionOption, season } from "@/lib/db/schema";
import { formatNumber } from "@/lib/format";
import { parseNumberInput } from "@/lib/game/number-input";
import {
  cancelQuestion,
  createQuestion,
  deleteDraftQuestion,
  duplicateQuestion,
  publicationProblems,
  publishQuestions,
  resolveQuestion,
  setQuestionDates,
  updateQuestion,
} from "@/lib/services/questions";
import type { Actor } from "@/lib/services/result";
import { makeClock } from "../helpers/clock";
import { createTestDb } from "../helpers/db";
import { cancelQuestionExtension } from "@/lib/services/extensions";
import { createCategory, createPrediction, createQuestion as insertQuestion, createUser, ensureTestSeason } from "../helpers/factories";

// Back-office questions (architecture §5.11, §11 É5). Dates are typed in Paris time. The admin has
// created two seasons: 2025-2026 from 29 September 2025, and 2026-2027 from 28 September 2026 (a
// start day other than 1 October, as the admin chooses it: v1.1).

const clock = makeClock("2026-10-05T10:00:00Z");
const now = clock.now;

let db: Database;
let close: () => Promise<void>;
let admin: Actor;
let categoryId: number;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  const row = await createUser(db, { role: "admin" });
  admin = { id: row.id, role: "admin", banned: false };
  categoryId = (await createCategory(db, "JPO")).id;
  await ensureTestSeason(db, "2025-2026", "2025-09-29");
  await ensureTestSeason(db, "2026-2027", "2026-09-28");
});

afterEach(async () => {
  await close();
});

const base = (overrides: Record<string, unknown> = {}) => ({
  kind: "number",
  categoryId: String(categoryId),
  title: "Combien de participants à la JPO ?",
  unit: "participants",
  source: "Tableau BI « JPO »",
  ...overrides,
});

async function load(id: number) {
  const [row] = await db.select().from(question).where(eq(question.id, id));
  const options = await db
    .select()
    .from(questionOption)
    .where(eq(questionOption.questionId, id))
    .orderBy(asc(questionOption.position));
  return { ...row, options: options.map(({ label }) => label) };
}

async function created(input: Record<string, unknown>) {
  const result = await createQuestion(db, admin, base(input), now);
  if (!result.ok) throw new Error(`createQuestion failed: ${result.message} ${JSON.stringify(result.fieldErrors)}`);
  return load(result.data.id);
}

async function seasonLabelOf(seasonId: number | null) {
  if (seasonId === null) return null;
  const [row] = await db.select().from(season).where(eq(season.id, seasonId));
  return row.label;
}

/** An open question (published, opened yesterday, closing in 5 days), with a player's prediction. */
async function openQuestionWithPrediction(overrides: Parameters<typeof insertQuestion>[1] = {}) {
  const q = await insertQuestion(db, {
    categoryId,
    status: "published",
    opensAt: clock.at("-1d"),
    closesAt: clock.at("+5d"),
    helpHint: "Ancien indice",
    ...overrides,
  });
  const player = await createUser(db);
  await createPrediction(db, { questionId: q.id, userId: player.id, valueNumber: 240 });
  return q;
}

describe("authorization (§6.5): admin only", () => {
  const services = {
    createQuestion: (actor: Actor | null) => createQuestion(db, actor, base(), now),
    updateQuestion: async (actor: Actor | null) => {
      const q = await insertQuestion(db, { categoryId });
      return updateQuestion(db, actor, { questionId: q.id, helpHint: "Indice" }, now);
    },
    publishQuestions: async (actor: Actor | null) => {
      const q = await insertQuestion(db, { categoryId, opensAt: clock.at("+1d"), closesAt: clock.at("+3d") });
      return publishQuestions(db, actor, { questionIds: [q.id] }, now);
    },
    setQuestionDates: async (actor: Actor | null) => {
      const q = await insertQuestion(db, { categoryId });
      return setQuestionDates(db, actor, { questionIds: [q.id], opensAt: "2026-10-14T09:00", closesAt: "2026-10-21T18:00" }, now);
    },
    duplicateQuestion: async (actor: Actor | null) => {
      const q = await insertQuestion(db, { categoryId });
      return duplicateQuestion(db, actor, { questionId: q.id }, now);
    },
    cancelQuestion: async (actor: Actor | null) => {
      const q = await insertQuestion(db, { categoryId, status: "published", opensAt: clock.at("-1d"), closesAt: clock.at("+1d") });
      return cancelQuestion(db, actor, { questionId: q.id }, now);
    },
    deleteDraftQuestion: async (actor: Actor | null) => {
      const q = await insertQuestion(db, { categoryId });
      return deleteDraftQuestion(db, actor, { questionId: q.id });
    },
    resolveQuestion: async (actor: Actor | null) => {
      const q = await insertQuestion(db, { categoryId, status: "published", opensAt: clock.at("-3d"), closesAt: clock.at("-1d") });
      return resolveQuestion(db, actor, { questionId: q.id, rawValue: "250" }, now);
    },
  };

  it.each(Object.keys(services))("%s: anonymous, player and disabled admin refused; admin accepted", async (name) => {
    const service = services[name as keyof typeof services];
    const player = await createUser(db);
    const disabledAdmin = await createUser(db, { role: "admin", banned: true });

    expect(await service(null)).toMatchObject({ ok: false, code: "NOT_AUTHENTICATED" });
    expect(await service({ id: player.id, role: "player", banned: false })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await service({ id: disabledAdmin.id, role: "admin", banned: true })).toMatchObject({
      ok: false,
      code: "ACCOUNT_DISABLED",
    });
    expect(await service(admin)).toMatchObject({ ok: true });
  });
});

describe("creation (§5.11)", () => {
  it("creates a number question as a draft, without season while it has no closing date", async () => {
    const q = await created({ description: "  Tous programmes.  ", coefficient: "3", helpBiUrl: "https://bi.example.test/jpo" });
    expect(q).toMatchObject({
      type: "number",
      priceIsRight: false,
      wrongAnswerMalus: null,
      unit: "participants",
      description: "Tous programmes.",
      coefficient: 3,
      status: "draft",
      seasonId: null,
      opensAt: null,
      closesAt: null,
      helpBiUrl: "https://bi.example.test/jpo",
      helpLastYear: null,
      createdBy: admin.id,
      createdAt: now,
      options: [],
    });
  });

  // v1.2: the Juste Prix is removed (decision of the user, 02/10/2026); this test replaces
  // "creates a Juste Prix number question".
  it("refuses the Juste Prix kind, removed in v1.2", async () => {
    const result = await createQuestion(db, admin, base({ kind: "priceIsRight" }), now);
    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT", fieldErrors: { kind: "Choisis un type de question." } });
    expect(await db.select().from(question)).toEqual([]);
  });

  it("creates a choice question with its answers in order, without unit, with the malus of a wrong answer", async () => {
    const q = await created({ kind: "choice", options: [" BBA ", "Grande École", "MSc"], wrongAnswerMalus: "1 200,5" });
    expect(q).toMatchObject({ type: "choice", priceIsRight: false, unit: null, wrongAnswerMalus: 1200.5, options: ["BBA", "Grande École", "MSc"] });
  });

  it("the yes/no template creates the answers « Oui » and « Non »", async () => {
    const q = await created({ kind: "yesNo", options: ["Peut-être"], wrongAnswerMalus: "50" });
    expect(q).toMatchObject({ type: "choice", unit: null, wrongAnswerMalus: 50, options: ["Oui", "Non"] });
  });

  it("a choice question needs a malus of a wrong answer, typed like a prediction and above 0 (v1.2)", async () => {
    const refused = async (wrongAnswerMalus: string | undefined) =>
      (await createQuestion(db, admin, base({ kind: "choice", options: ["A", "B"], wrongAnswerMalus }), now)) as { fieldErrors?: Record<string, string> };
    expect((await refused(undefined)).fieldErrors).toEqual({ wrongAnswerMalus: "Indique le malus d'une mauvaise réponse." });
    expect((await refused("  ")).fieldErrors).toEqual({ wrongAnswerMalus: "Indique le malus d'une mauvaise réponse." });
    expect((await refused("0")).fieldErrors).toEqual({ wrongAnswerMalus: "Le malus doit être supérieur à 0." });
    expect((await refused("2.450")).fieldErrors).toEqual({ wrongAnswerMalus: (parseNumberInput("2.450") as { message: string }).message });
    expect((await refused("-5")).fieldErrors?.wrongAnswerMalus).toBeDefined();
    expect(await db.select().from(question)).toEqual([]);
  });

  it("a number question has no malus of a wrong answer, even when one is sent", async () => {
    expect(await created({ kind: "number", wrongAnswerMalus: "200" })).toMatchObject({ type: "number", wrongAnswerMalus: null });
  });

  it("a choice question needs at least 2 answers, non-empty and unique whatever the case", async () => {
    for (const options of [["Seule"], [], ["BBA", "bba"], ["BBA", "  "]]) {
      const result = await createQuestion(db, admin, base({ kind: "choice", options }), now);
      expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT", fieldErrors: { options: expect.any(String) } });
    }
    expect(await db.select().from(question)).toEqual([]);
  });

  it("requires a category, a title of 5 to 200 characters and a source", async () => {
    const result = await createQuestion(db, admin, { kind: "number", categoryId: "", title: "Abc", source: "  " }, now);
    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: {
        categoryId: "Choisis une catégorie.",
        title: "L'énoncé doit faire de 5 à 200 caractères.",
        source: "Indique d'où viendra la valeur réelle.",
      },
    });
  });

  it("refuses an archived category and a link that is not http(s)", async () => {
    const [archived] = await db.insert(category).values({ name: "Archivée", archivedAt: clock.at("-1d") }).returning();
    expect(await createQuestion(db, admin, base({ categoryId: archived.id }), now)).toMatchObject({
      ok: false,
      code: "CATEGORY_ARCHIVED",
    });
    expect(await createQuestion(db, admin, base({ helpBiUrl: "javascript:alert(1)" }), now)).toMatchObject({
      ok: false,
      fieldErrors: { helpBiUrl: "Le lien doit commencer par https:// ou http://." },
    });
  });

  it("reads the dates in Paris time and refuses inconsistent dates", async () => {
    const q = await created({ opensAt: "2026-10-14T09:00", closesAt: "2026-11-15T18:00", expectedResultAt: "" });
    expect(q.opensAt).toEqual(new Date("2026-10-14T07:00:00Z"));
    expect(q.closesAt).toEqual(new Date("2026-11-15T17:00:00Z"));
    expect(q.expectedResultAt).toBeNull();
    expect(await seasonLabelOf(q.seasonId)).toBe("2026-2027");

    expect(await createQuestion(db, admin, base({ opensAt: "2026-10-21T18:00", closesAt: "2026-10-14T09:00" }), now)).toMatchObject({
      ok: false,
      fieldErrors: { closesAt: "La clôture doit être après l'ouverture." },
    });
    expect(
      await createQuestion(db, admin, base({ closesAt: "2026-10-21T18:00", expectedResultAt: "2026-10-20T18:00" }), now),
    ).toMatchObject({ ok: false, fieldErrors: { expectedResultAt: "Le résultat prévu ne peut pas être avant la clôture." } });
    expect(await createQuestion(db, admin, base({ opensAt: "2026-02-30T10:00" }), now)).toMatchObject({
      ok: false,
      fieldErrors: { opensAt: "Date invalide." },
    });
  });
});

describe("season of a question (§5.1, vectors T4 and T5)", () => {
  it("is the season of the closing date, around midnight on the start day of a season, Paris time", async () => {
    const before = await created({ closesAt: "2026-09-27T23:59" });
    const after = await created({ closesAt: "2026-09-28T00:00" });
    const lastDayOfSeptember = await created({ closesAt: "2026-09-30T23:59" });
    expect(before.closesAt).toEqual(new Date("2026-09-27T21:59:00Z"));
    expect(await seasonLabelOf(before.seasonId)).toBe("2025-2026");
    expect(after.closesAt).toEqual(new Date("2026-09-27T22:00:00Z"));
    expect(await seasonLabelOf(after.seasonId)).toBe("2026-2027");
    // No more fixed switch on 1 October.
    expect(await seasonLabelOf(lastDayOfSeptember.seasonId)).toBe("2026-2027");
  });

  it("is the last season for any later date, and none before the first season (a draft only)", async () => {
    expect(await seasonLabelOf((await created({ closesAt: "2031-06-01T18:00" })).seasonId)).toBe("2026-2027");
    expect((await created({ closesAt: "2025-09-28T23:59" })).seasonId).toBeNull();
  });

  it("follows every change of the closing date, and is cleared with it on a draft", async () => {
    const q = await created({ closesAt: "2026-09-27T23:59" });
    expect(await updateQuestion(db, admin, { questionId: q.id, closesAt: "2026-09-28T00:00" }, now)).toMatchObject({ ok: true });
    expect(await seasonLabelOf((await load(q.id)).seasonId)).toBe("2026-2027");
    expect(await updateQuestion(db, admin, { questionId: q.id, closesAt: "" }, now)).toMatchObject({ ok: true });
    expect((await load(q.id)).seasonId).toBeNull();

    const late = makeClock("2026-09-20T10:00:00Z").now;
    const report = await setQuestionDates(
      db,
      admin,
      { questionIds: [q.id], opensAt: "2026-09-25T09:00", closesAt: "2026-09-27T23:59" },
      late,
    );
    expect(report).toMatchObject({ ok: true, data: { succeeded: [{ id: q.id }] } });
    expect(await seasonLabelOf((await load(q.id)).seasonId)).toBe("2025-2026");
  });
});

describe("publication (§5.11)", () => {
  it("publishes a complete draft; a question opening later is scheduled", async () => {
    const q = await created({ opensAt: "2026-10-14T09:00", closesAt: "2026-10-21T18:00" });
    const result = await publishQuestions(db, admin, { questionIds: [q.id] }, now);
    expect(result).toEqual({
      ok: true,
      data: { succeeded: [{ id: q.id, title: q.title }], unchanged: [], failed: [] },
    });
    expect(await load(q.id)).toMatchObject({ status: "published", updatedAt: now });
  });

  it("is refused when the closing has passed or a date is missing", async () => {
    const past = await insertQuestion(db, { categoryId, opensAt: clock.at("-3d"), closesAt: clock.at("-1ms") });
    const atNow = await insertQuestion(db, { categoryId, opensAt: clock.at("-3d"), closesAt: now });
    const noDates = await insertQuestion(db, { categoryId });
    const result = await publishQuestions(db, admin, { questionIds: [past.id, atNow.id, noDates.id] }, now);

    expect(result).toMatchObject({
      ok: true,
      data: {
        succeeded: [],
        failed: [
          { id: past.id, reasons: ["La clôture est déjà passée."] },
          { id: atNow.id, reasons: ["La clôture est déjà passée."] },
          { id: noDates.id, reasons: ["Il manque la date d'ouverture.", "Il manque la date de clôture."] },
        ],
      },
    });
    for (const id of [past.id, atNow.id, noDates.id]) expect((await load(id)).status).toBe("draft");
  });

  it("is refused when the opening is not before the closing (the database already forbids storing it)", () => {
    const rules = { type: "number" as const, expectedResultAt: null, coefficient: 1, seasonId: 1, wrongAnswerMalus: null };
    expect(publicationProblems({ ...rules, opensAt: clock.at("+2d"), closesAt: clock.at("+2d") }, [], now)).toEqual([
      "La clôture doit être après l'ouverture.",
    ]);
    expect(publicationProblems({ ...rules, opensAt: clock.at("+3d"), closesAt: clock.at("+2d") }, [], now)).toEqual([
      "La clôture doit être après l'ouverture.",
    ]);
    expect(publicationProblems({ ...rules, opensAt: clock.at("+1d"), closesAt: clock.at("+2d") }, [], now)).toEqual([]);
    expect(publicationProblems({ ...rules, type: "choice", opensAt: clock.at("+1d"), closesAt: clock.at("+2d") }, ["Seule"], now)).toEqual([
      "Une question à choix a de 2 à 10 réponses.",
    ]);
    // A choice question needs its malus of a wrong answer (v1.2; the database guarantees it too).
    const choice = { ...rules, type: "choice" as const, opensAt: clock.at("+1d"), closesAt: clock.at("+2d") };
    expect(publicationProblems(choice, ["Oui", "Non"], now)).toEqual(["Indique le malus d'une mauvaise réponse."]);
    expect(publicationProblems({ ...choice, wrongAnswerMalus: 50 }, ["Oui", "Non"], now)).toEqual([]);
  });

  it("is refused while no season covers the closing date (v1.1)", () => {
    const rules = { type: "number" as const, expectedResultAt: null, coefficient: 1, seasonId: null, wrongAnswerMalus: null };
    expect(publicationProblems({ ...rules, opensAt: clock.at("+1d"), closesAt: clock.at("+2d") }, [], now)).toEqual([
      "Aucune saison ne couvre cette date de clôture : crée d'abord la saison dans Saisons et lots.",
    ]);
    expect(publicationProblems({ ...rules, opensAt: null, closesAt: null }, [], now)).toEqual([
      "Il manque la date d'ouverture.",
      "Il manque la date de clôture.",
    ]);
  });

  it("reports already published questions apart, and refuses cancelled ones and an empty selection", async () => {
    const published = await insertQuestion(db, { categoryId, status: "published", opensAt: clock.at("-1d"), closesAt: clock.at("+1d") });
    const cancelled = await insertQuestion(db, { categoryId, status: "cancelled", opensAt: clock.at("-1d"), closesAt: clock.at("+1d") });
    expect(await publishQuestions(db, admin, { questionIds: [published.id, cancelled.id] }, now)).toMatchObject({
      ok: true,
      data: { succeeded: [], unchanged: [{ id: published.id }], failed: [{ id: cancelled.id, reasons: ["Question annulée."] }] },
    });
    expect(await publishQuestions(db, admin, { questionIds: [] }, now)).toMatchObject({
      ok: false,
      fieldErrors: { questionIds: "Sélectionne au moins une question." },
    });
  });

  it("checks the expected result date", async () => {
    const q = await insertQuestion(db, {
      categoryId,
      opensAt: clock.at("+1d"),
      closesAt: clock.at("+3d"),
      expectedResultAt: clock.at("+2d"),
    });
    expect(await publishQuestions(db, admin, { questionIds: [q.id] }, now)).toMatchObject({
      data: { failed: [{ id: q.id, reasons: ["Le résultat prévu ne peut pas être avant la clôture."] }] },
    });
  });
});

describe("dates in series (§5.11)", () => {
  it("applies the same dates to each question without prediction and reports the others", async () => {
    const draft = await insertQuestion(db, { categoryId, expectedResultAt: clock.at("+60d") });
    const scheduled = await insertQuestion(db, { categoryId, status: "published", opensAt: clock.at("+1d"), closesAt: clock.at("+2d") });
    const withPrediction = await openQuestionWithPrediction();
    const closed = await insertQuestion(db, { categoryId, status: "published", opensAt: clock.at("-3d"), closesAt: clock.at("-1d") });
    const cancelled = await insertQuestion(db, { categoryId, status: "cancelled", opensAt: clock.at("-1d"), closesAt: clock.at("+1d") });
    const earlyResult = await insertQuestion(db, { categoryId, expectedResultAt: clock.at("+10d") });

    const result = await setQuestionDates(
      db,
      admin,
      {
        questionIds: [draft.id, scheduled.id, withPrediction.id, closed.id, cancelled.id, earlyResult.id, 999],
        opensAt: "2026-10-14T09:00",
        closesAt: "2026-10-21T18:00",
        expectedResultAt: "",
      },
      now,
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        succeeded: [{ id: draft.id }, { id: scheduled.id }],
        failed: [
          { id: withPrediction.id, reasons: ["Des pronos existent : change ses dates depuis la page de la question."] },
          { id: closed.id, reasons: ["Question déjà clôturée."] },
          { id: cancelled.id, reasons: ["Question annulée."] },
          { id: earlyResult.id, reasons: ["Sa date de résultat prévue est avant la nouvelle clôture."] },
          { id: 999, reasons: ["Cette question n'existe pas."] },
        ],
      },
    });
    const opensAt = new Date("2026-10-14T07:00:00Z");
    const closesAt = new Date("2026-10-21T16:00:00Z");
    // An empty expected result date keeps each question's own.
    expect(await load(draft.id)).toMatchObject({ opensAt, closesAt, expectedResultAt: clock.at("+60d"), status: "draft" });
    expect(await load(scheduled.id)).toMatchObject({ opensAt, closesAt, status: "published" });
    expect(await load(withPrediction.id)).toMatchObject({ opensAt: clock.at("-1d"), closesAt: clock.at("+5d") });
  });

  it("sets the expected result date when given, then the selection can be published", async () => {
    const a = await insertQuestion(db, { categoryId });
    const b = await insertQuestion(db, { categoryId, type: "choice", unit: null, options: ["BBA", "MSc"] });
    const ids = [a.id, b.id];
    const dated = await setQuestionDates(
      db,
      admin,
      { questionIds: ids, opensAt: "2026-10-14T09:00", closesAt: "2026-10-21T18:00", expectedResultAt: "2027-06-01T12:00" },
      now,
    );
    expect(dated).toMatchObject({ ok: true, data: { succeeded: [{ id: a.id }, { id: b.id }], failed: [] } });
    expect((await load(a.id)).expectedResultAt).toEqual(new Date("2027-06-01T10:00:00Z"));
    expect(await publishQuestions(db, admin, { questionIds: ids }, now)).toMatchObject({
      data: { succeeded: [{ id: a.id }, { id: b.id }], failed: [] },
    });
  });

  it("refuses dates that cannot suit any question", async () => {
    const q = await insertQuestion(db, { categoryId });
    const call = (dates: Record<string, string>) => setQuestionDates(db, admin, { questionIds: [q.id], ...dates }, now);
    expect(await call({ opensAt: "", closesAt: "" })).toMatchObject({
      ok: false,
      fieldErrors: { opensAt: "Indique la date d'ouverture.", closesAt: "Indique la date de clôture." },
    });
    expect(await call({ opensAt: "2026-10-21T18:00", closesAt: "2026-10-14T09:00" })).toMatchObject({
      fieldErrors: { closesAt: "La clôture doit être après l'ouverture." },
    });
    expect(await call({ opensAt: "2026-10-01T09:00", closesAt: "2026-10-05T11:00" })).toMatchObject({
      fieldErrors: { closesAt: "La clôture doit être dans le futur." },
    });
    expect(
      await call({ opensAt: "2026-10-14T09:00", closesAt: "2026-10-21T18:00", expectedResultAt: "2026-10-20T09:00" }),
    ).toMatchObject({ fieldErrors: { expectedResultAt: "Le résultat prévu ne peut pas être avant la clôture." } });
  });
});

describe("editing locks (§5.11)", () => {
  it("without prediction, every field can change, the answers and the malus of a wrong answer included", async () => {
    const q = await created({ kind: "choice", options: ["A", "B"], wrongAnswerMalus: "100", opensAt: "2026-10-14T09:00", closesAt: "2026-10-21T18:00" });
    await publishQuestions(db, admin, { questionIds: [q.id] }, now);
    const result = await updateQuestion(
      db,
      admin,
      { questionId: q.id, kind: "choice", title: "Quel programme gagnera ?", options: ["BBA", "MSc", "Grande École"], coefficient: "2", wrongAnswerMalus: "150" },
      now,
    );
    expect(result).toEqual({ ok: true, data: { id: q.id } });
    expect(await load(q.id)).toMatchObject({ title: "Quel programme gagnera ?", coefficient: 2, wrongAnswerMalus: 150, options: ["BBA", "MSc", "Grande École"] });

    // A choice switched to a number loses its malus of a wrong answer (v1.2).
    expect(await updateQuestion(db, admin, { questionId: q.id, kind: "number", unit: "candidatures" }, now)).toMatchObject({ ok: true });
    expect(await load(q.id)).toMatchObject({ type: "number", unit: "candidatures", wrongAnswerMalus: null, options: [] });

    // A number switched to a choice needs one.
    expect(await updateQuestion(db, admin, { questionId: q.id, kind: "yesNo" }, now)).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { wrongAnswerMalus: "Indique le malus d'une mauvaise réponse." },
    });
    expect(await updateQuestion(db, admin, { questionId: q.id, kind: "yesNo", wrongAnswerMalus: "40" }, now)).toMatchObject({ ok: true });
    expect(await load(q.id)).toMatchObject({ type: "choice", wrongAnswerMalus: 40, options: ["Oui", "Non"] });
  });

  it("with a prediction, the malus of a wrong answer is locked; sent unchanged, it is accepted (v1.2)", async () => {
    const q = await openQuestionWithPrediction({ type: "choice", unit: null, wrongAnswerMalus: 80, options: ["Oui", "Non"] });
    expect(await updateQuestion(db, admin, { questionId: q.id, wrongAnswerMalus: "90" }, now)).toMatchObject({ ok: false, code: "QUESTION_LOCKED" });
    expect(await updateQuestion(db, admin, { questionId: q.id, kind: "yesNo", wrongAnswerMalus: "80", helpHint: "Nouvel indice" }, now)).toMatchObject({
      ok: true,
    });
    expect(await load(q.id)).toMatchObject({ wrongAnswerMalus: 80, helpHint: "Nouvel indice" });
  });

  it("with a prediction: title refused, help accepted, closing moved earlier refused, later accepted", async () => {
    const q = await openQuestionWithPrediction();

    expect(await updateQuestion(db, admin, { questionId: q.id, title: "Un autre énoncé ?" }, now)).toMatchObject({
      ok: false,
      code: "QUESTION_LOCKED",
      message: "Des pronos existent : ce champ ne peut plus changer. Pour le modifier, annule la question et crée une nouvelle question.",
    });
    for (const patch of [
      { kind: "choice", options: ["A", "B"], wrongAnswerMalus: "10" },
      { unit: "visiteurs" },
      { source: "Autre source" },
      { coefficient: 2 },
      { description: "Précision" },
    ]) {
      expect(await updateQuestion(db, admin, { questionId: q.id, ...patch }, now)).toMatchObject({ ok: false, code: "QUESTION_LOCKED" });
    }

    const newCategory = await createCategory(db, "Candidatures");
    expect(
      await updateQuestion(
        db,
        admin,
        { questionId: q.id, categoryId: newCategory.id, helpHint: "Nouvel indice", helpLastYear: "212", helpBiUrl: "" },
        now,
      ),
    ).toMatchObject({ ok: true });
    expect(await load(q.id)).toMatchObject({ categoryId: newCategory.id, helpHint: "Nouvel indice", helpLastYear: "212" });

    expect(await updateQuestion(db, admin, { questionId: q.id, closesAt: "2026-10-08T12:00" }, now)).toMatchObject({
      ok: false,
      code: "QUESTION_LOCKED",
      fieldErrors: { closesAt: "Des pronos existent : la clôture peut seulement être repoussée." },
    });
    expect(await updateQuestion(db, admin, { questionId: q.id, closesAt: "2026-10-12T18:00" }, now)).toMatchObject({ ok: true });
    expect((await load(q.id)).closesAt).toEqual(new Date("2026-10-12T16:00:00Z"));

    expect(await updateQuestion(db, admin, { questionId: q.id, opensAt: "2026-10-01T09:00" }, now)).toMatchObject({
      ok: false,
      code: "QUESTION_LOCKED",
    });
    expect(await updateQuestion(db, admin, { questionId: q.id, expectedResultAt: "2026-12-01T09:00" }, now)).toMatchObject({ ok: true });
  });

  it("with a prediction, fields sent unchanged are accepted", async () => {
    const q = await openQuestionWithPrediction();
    const same = { questionId: q.id, kind: "number", title: q.title, unit: q.unit, source: q.source, coefficient: 1, helpHint: "Indice" };
    expect(await updateQuestion(db, admin, same, now)).toMatchObject({ ok: true });
  });

  it("a date sent back from the form in the same minute is unchanged, even with seconds stored", async () => {
    const closesAt = new Date("2026-10-10T16:12:34.567Z");
    const q = await openQuestionWithPrediction({ opensAt: new Date("2026-10-04T09:30:12.345Z"), closesAt });
    const form = { questionId: q.id, opensAt: "2026-10-04T11:30", closesAt: "2026-10-10T18:12", helpHint: "Indice" };
    expect(await updateQuestion(db, admin, form, now)).toMatchObject({ ok: true });
    expect(await load(q.id)).toMatchObject({ opensAt: new Date("2026-10-04T09:30:12.345Z"), closesAt, helpHint: "Indice" });
  });

  it("with a prediction, the closing cannot move to another season", async () => {
    const lateSeason = makeClock("2026-09-24T10:00:00Z");
    const q = await openQuestionWithPrediction({ opensAt: lateSeason.at("-1d"), closesAt: lateSeason.at("+2d") });
    expect(await seasonLabelOf(q.seasonId)).toBe("2025-2026");
    for (const closesAt of ["2026-09-28T00:00", "2026-10-02T18:00"]) {
      expect(await updateQuestion(db, admin, { questionId: q.id, closesAt }, lateSeason.now)).toMatchObject({
        ok: false,
        fieldErrors: { closesAt: "Des pronos existent : la clôture ne peut pas passer sur une autre saison." },
      });
    }
    expect(await updateQuestion(db, admin, { questionId: q.id, closesAt: "2026-09-27T23:59" }, lateSeason.now)).toMatchObject({ ok: true });
    expect(await seasonLabelOf((await load(q.id)).seasonId)).toBe("2025-2026");
  });

  it("a published question keeps future dates", async () => {
    const q = await insertQuestion(db, { categoryId, status: "published", opensAt: clock.at("-1d"), closesAt: clock.at("+3d") });
    expect(await updateQuestion(db, admin, { questionId: q.id, closesAt: "2026-10-05T11:00" }, now)).toMatchObject({
      fieldErrors: { closesAt: "La clôture doit être dans le futur." },
    });
    expect(await updateQuestion(db, admin, { questionId: q.id, opensAt: "" }, now)).toMatchObject({
      fieldErrors: { opensAt: "Une question publiée garde sa date d'ouverture." },
    });
  });

  it("after the closing, only the category, the help and the expected result date change", async () => {
    const q = await insertQuestion(db, { categoryId, status: "published", opensAt: clock.at("-3d"), closesAt: clock.at("-1d") });
    expect(await updateQuestion(db, admin, { questionId: q.id, title: "Un autre énoncé ?" }, now)).toMatchObject({
      code: "QUESTION_CLOSED",
    });
    expect(await updateQuestion(db, admin, { questionId: q.id, closesAt: "2026-10-30T18:00" }, now)).toMatchObject({
      code: "QUESTION_CLOSED",
    });
    expect(await updateQuestion(db, admin, { questionId: q.id, helpHint: "Indice", expectedResultAt: "2026-11-01T10:00" }, now)).toMatchObject({
      ok: true,
    });
  });

  it("a cancelled question no longer changes", async () => {
    const q = await insertQuestion(db, { categoryId, status: "cancelled", opensAt: clock.at("-1d"), closesAt: clock.at("+1d") });
    expect(await updateQuestion(db, admin, { questionId: q.id, helpHint: "Indice" }, now)).toMatchObject({ code: "QUESTION_CANCELLED" });
  });

  it("refuses an archived category unless the question already has it", async () => {
    const [archived] = await db.insert(category).values({ name: "Archivée", archivedAt: clock.at("-1d") }).returning();
    const q = await insertQuestion(db, { categoryId });
    expect(await updateQuestion(db, admin, { questionId: q.id, categoryId: archived.id }, now)).toMatchObject({
      code: "CATEGORY_ARCHIVED",
    });
    const onArchived = await insertQuestion(db, { categoryId: archived.id });
    expect(await updateQuestion(db, admin, { questionId: onArchived.id, categoryId: archived.id, helpHint: "Indice" }, now)).toMatchObject({
      ok: true,
    });
  });

  it("answers an unknown question", async () => {
    expect(await updateQuestion(db, admin, { questionId: 999, helpHint: "Indice" }, now)).toMatchObject({
      code: "NOT_FOUND",
      message: "Cette question n'existe pas.",
    });
  });
});

describe("duplication (§5.11)", () => {
  it("copies the question and its answers as a draft without dates", async () => {
    const original = await insertQuestion(db, {
      categoryId,
      type: "choice",
      unit: null,
      title: "Quel programme gagnera ?",
      description: "En décembre.",
      source: "Tableau BI",
      helpHint: "Regarde l'an dernier.",
      helpLastYear: "BBA",
      coefficient: 3,
      wrongAnswerMalus: 75,
      status: "published",
      opensAt: clock.at("-1d"),
      closesAt: clock.at("+1d"),
      options: ["BBA", "MSc", "Grande École"],
    });
    // An extension of the original is not copied (§5.11).
    const player = await createUser(db);
    await db.insert(questionExtension).values({ questionId: original.id, userId: player.id, closesAt: clock.at("+3d"), grantedBy: admin.id, grantedAt: now });
    const result = await duplicateQuestion(db, admin, { questionId: original.id }, now);
    expect(result.ok).toBe(true);
    const copy = await load(result.ok ? result.data.id : 0);
    expect(copy).toMatchObject({
      categoryId,
      type: "choice",
      title: "Quel programme gagnera ?",
      description: "En décembre.",
      source: "Tableau BI",
      helpHint: "Regarde l'an dernier.",
      helpLastYear: "BBA",
      coefficient: 3,
      wrongAnswerMalus: 75,
      status: "draft",
      opensAt: null,
      closesAt: null,
      expectedResultAt: null,
      seasonId: null,
      duplicatedFromId: original.id,
      createdBy: admin.id,
      options: ["BBA", "MSc", "Grande École"],
    });
    expect(copy.id).not.toBe(original.id);
    expect(await db.select().from(questionExtension).where(eq(questionExtension.questionId, copy.id))).toEqual([]);
  });

  it("fills last year's value from the result of a resolved original", async () => {
    const resolved = { status: "published" as const, opensAt: clock.at("-9d"), closesAt: clock.at("-7d"), resolvedAt: clock.at("-1d") };
    const number = await insertQuestion(db, { categoryId, ...resolved, unit: "candidatures", resultNumber: 2450, helpLastYear: "2 318" });
    const choice = await insertQuestion(db, { categoryId, ...resolved, type: "choice", unit: null, options: ["Caen", "Le Havre"] });
    await db.update(question).set({ resultOptionId: choice.options[1].id }).where(eq(question.id, choice.id));
    const cancelled = await insertQuestion(db, { categoryId, ...resolved, status: "cancelled", resultNumber: 12, helpLastYear: "10" });

    const copyOf = async (id: number) => {
      const result = await duplicateQuestion(db, admin, { questionId: id }, now);
      return load(result.ok ? result.data.id : 0);
    };
    expect((await copyOf(number.id)).helpLastYear).toBe(`${formatNumber(2450)} candidatures`);
    expect((await copyOf(choice.id)).helpLastYear).toBe("Le Havre");
    expect((await copyOf(cancelled.id)).helpLastYear).toBe("10");
  });
});

describe("deletion and cancellation (§5.11)", () => {
  it("deletes a draft only; its copies forget where they came from", async () => {
    const draft = await insertQuestion(db, { categoryId, type: "choice", unit: null, options: ["A", "B"] });
    const copy = await duplicateQuestion(db, admin, { questionId: draft.id }, now);
    const published = await insertQuestion(db, { categoryId, status: "published", opensAt: clock.at("+1d"), closesAt: clock.at("+2d") });

    expect(await deleteDraftQuestion(db, admin, { questionId: published.id })).toMatchObject({ ok: false, code: "NOT_DELETABLE" });
    expect(await deleteDraftQuestion(db, admin, { questionId: draft.id })).toEqual({ ok: true, data: undefined });
    expect(await db.select().from(question).where(eq(question.id, draft.id))).toEqual([]);
    expect(await db.select().from(questionOption).where(eq(questionOption.questionId, draft.id))).toEqual([]);
    expect((await load(copy.ok ? copy.data.id : 0)).duplicatedFromId).toBeNull();
    expect(await deleteDraftQuestion(db, admin, { questionId: draft.id })).toMatchObject({ code: "NOT_FOUND" });
  });

  it("cancels a published question at any time, not a draft nor twice", async () => {
    const open = await openQuestionWithPrediction();
    expect(await cancelQuestion(db, admin, { questionId: open.id }, now)).toEqual({ ok: true, data: undefined });
    expect(await load(open.id)).toMatchObject({ status: "cancelled", cancelledAt: now });
    expect(await cancelQuestion(db, admin, { questionId: open.id }, now)).toMatchObject({ code: "ALREADY_CANCELLED" });

    const resolved = await insertQuestion(db, {
      categoryId,
      status: "published",
      opensAt: clock.at("-9d"),
      closesAt: clock.at("-7d"),
      resultNumber: 250,
      resolvedAt: clock.at("-1d"),
    });
    expect(await cancelQuestion(db, admin, { questionId: resolved.id }, now)).toMatchObject({ ok: true });

    const draft = await insertQuestion(db, { categoryId });
    expect(await cancelQuestion(db, admin, { questionId: draft.id }, now)).toMatchObject({
      code: "NOT_CANCELLABLE",
      message: "Un brouillon ne s'annule pas : supprime-le.",
    });
  });
});

describe("result (§5.11)", () => {
  it("is refused before the closing, accepted after; a correction sets corrected_at", async () => {
    const q = await insertQuestion(db, { categoryId, status: "published", opensAt: clock.at("-3d"), closesAt: clock.at("+1h") });
    expect(await resolveQuestion(db, admin, { questionId: q.id, rawValue: "250" }, now)).toMatchObject({
      ok: false,
      code: "RESULT_TOO_EARLY",
    });

    const afterClosing = clock.at("+1h");
    expect(await resolveQuestion(db, admin, { questionId: q.id, rawValue: "2 450,5" }, afterClosing)).toEqual({
      ok: true,
      data: { corrected: false, unchanged: false },
    });
    expect(await load(q.id)).toMatchObject({ resultNumber: 2450.5, resolvedAt: afterClosing, correctedAt: null });

    const later = clock.at("+2d");
    expect(await resolveQuestion(db, admin, { questionId: q.id, rawValue: "2450.50" }, later)).toEqual({
      ok: true,
      data: { corrected: false, unchanged: true },
    });
    expect((await load(q.id)).correctedAt).toBeNull();

    expect(await resolveQuestion(db, admin, { questionId: q.id, rawValue: "2 500" }, later)).toEqual({
      ok: true,
      data: { corrected: true, unchanged: false },
    });
    expect(await load(q.id)).toMatchObject({ resultNumber: 2500, resolvedAt: afterClosing, correctedAt: later });
  });

  it("reads the number like a prediction", async () => {
    const q = await insertQuestion(db, { categoryId, status: "published", opensAt: clock.at("-3d"), closesAt: clock.at("-1d") });
    expect(await resolveQuestion(db, admin, { questionId: q.id, rawValue: "2.450" }, now)).toMatchObject({
      ok: false,
      code: "INVALID_VALUE",
      fieldErrors: { rawValue: (parseNumberInput("2.450") as { message: string }).message },
    });
  });

  it("takes one of the question's own answers for a choice", async () => {
    const q = await insertQuestion(db, {
      categoryId,
      type: "choice",
      unit: null,
      status: "published",
      opensAt: clock.at("-3d"),
      closesAt: clock.at("-1d"),
      options: ["Caen", "Le Havre"],
    });
    const other = await insertQuestion(db, { categoryId, type: "choice", unit: null, options: ["Oui", "Non"] });
    expect(await resolveQuestion(db, admin, { questionId: q.id, optionId: other.options[0].id }, now)).toMatchObject({
      code: "INVALID_OPTION",
    });
    expect(await resolveQuestion(db, admin, { questionId: q.id, optionId: q.options[1].id }, now)).toMatchObject({ ok: true });
    expect(await load(q.id)).toMatchObject({ resultOptionId: q.options[1].id, resolvedAt: now });
  });

  it("is refused while an extension runs, accepted after its deadline or its cancellation (v1.2, PR7)", async () => {
    const q = await insertQuestion(db, { categoryId, status: "published", opensAt: clock.at("-3d"), closesAt: clock.at("-1d") });
    const player = await createUser(db);
    const deadline = new Date("2026-10-07T16:00:00Z");
    await db.insert(questionExtension).values({ questionId: q.id, userId: player.id, closesAt: deadline, grantedBy: admin.id, grantedAt: clock.at("-12h") });

    expect(await resolveQuestion(db, admin, { questionId: q.id, rawValue: "250" }, now)).toEqual({
      ok: false,
      code: "EXTENSION_RUNNING",
      message: "Un joueur a une prolongation jusqu'au mer. 7 oct. à 18 h : attends sa fin ou annule-la.",
    });
    expect((await load(q.id)).resolvedAt).toBeNull();
    // At the deadline (excluded), the extension is over.
    expect(await resolveQuestion(db, admin, { questionId: q.id, rawValue: "250" }, deadline)).toMatchObject({ ok: true });

    const other = await insertQuestion(db, { categoryId, status: "published", opensAt: clock.at("-3d"), closesAt: clock.at("-1d") });
    await db.insert(questionExtension).values({ questionId: other.id, userId: player.id, closesAt: deadline, grantedBy: admin.id, grantedAt: clock.at("-12h") });
    expect(await resolveQuestion(db, admin, { questionId: other.id, rawValue: "250" }, now)).toMatchObject({ code: "EXTENSION_RUNNING" });
    expect(await cancelQuestionExtension(db, admin, { questionId: other.id, userId: player.id }, now)).toMatchObject({ ok: true });
    expect(await resolveQuestion(db, admin, { questionId: other.id, rawValue: "250" }, now)).toMatchObject({ ok: true });
  });

  it("is refused on a draft, a scheduled or a cancelled question", async () => {
    const draft = await insertQuestion(db, { categoryId });
    const scheduled = await insertQuestion(db, { categoryId, status: "published", opensAt: clock.at("+1d"), closesAt: clock.at("+2d") });
    const cancelled = await insertQuestion(db, { categoryId, status: "cancelled", opensAt: clock.at("-3d"), closesAt: clock.at("-1d") });
    expect(await resolveQuestion(db, admin, { questionId: draft.id, rawValue: "1" }, now)).toMatchObject({ code: "RESULT_TOO_EARLY" });
    expect(await resolveQuestion(db, admin, { questionId: scheduled.id, rawValue: "1" }, now)).toMatchObject({ code: "RESULT_TOO_EARLY" });
    expect(await resolveQuestion(db, admin, { questionId: cancelled.id, rawValue: "1" }, now)).toMatchObject({
      code: "QUESTION_CANCELLED",
    });
  });
});
