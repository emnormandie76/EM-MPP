import { generateId } from "better-auth";
import { hashPassword } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";
import { defaultAvatarFor } from "../../src/lib/avatars";
import type { Database } from "../../src/lib/db/client";
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
  user,
} from "../../src/lib/db/schema";
import { computeStandings, type StandingsPrediction, type StandingsQuestion } from "../../src/lib/game/standings";
import { seasonAt } from "../../src/lib/game/time";
import { isMarkedAsProduction } from "./db";
import { seedSeasons } from "./seed-seasons";

// Development and end-to-end data set (architecture §9.6). It ERASES every row (application and
// accounts, not app_meta) and inserts the data below, in one transaction.
//
// The seed creates its own three seasons (§9.6), starting on 1 October and named "YYYY-YYYY": the
// current one, the previous one (proclaimed, with its palmarès) and an older one, all resolved but
// not proclaimed, to try the proclamation (decision of 30/09/2026). It does not create the next
// one: the current season has no end, as in production until the admin creates the next season.
//
// Dates are relative to `now`. The past questions of the current season must close after its
// start: just after 1 October, the past gaps are shrunk to fit, so the data set stays consistent
// on any day. Otherwise "3 days ago" is exactly 3 days ago, and future dates are always exact.
//
// v1.2 (step 8c): malus, every choice question with its malus of a wrong answer, jokers allowed in
// the three seasons, and the closed webinar question with a witness value, an extension and players
// without a prediction (§9.6). Step 8d: a chat over two days, with emojis, a deleted message, the
// result message of a resolved question, and a few accounts that read part of it.

export const SEED_PASSWORD = "Test-1234!";
/** Value of another player's prediction on an open question: must never reach the page (§9.3). */
export const WITNESS_VALUE = 987654;
/**
 * Value of a prediction on the closed webinar question: it must never reach the page of a player who
 * did not predict it, nor of the player whose extension runs on it (v1.2, §9.3).
 */
export const CLOSED_WITNESS_VALUE = 876543;

export class SeedRefusedError extends Error {}

type Env = Record<string, string | undefined>;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Past offsets of the current season are expressed in days out of this span. */
const PAST_SPAN_DAYS = 30;

/** Why seeding this database is forbidden, or null. */
export async function seedRefusal(db: Database, env: Env): Promise<string | null> {
  if (env.VERCEL_ENV === "production") return "VERCEL_ENV=production : le seed est interdit en production.";
  if (await isMarkedAsProduction(db)) return "cette base est marquée comme base de production : le seed y est interdit.";
  return null;
}

const PEOPLE = {
  admin: { email: "admin@example.test", name: "Admin", role: "admin" },
  sarah: { email: "joueur1@example.test", name: "Sarah" },
  julien: { email: "joueur2@example.test", name: "Julien" },
  ines: { email: "joueur3@example.test", name: "Inès" },
  camille: { email: "joueur4@example.test", name: "Camille" },
  thomas: { email: "joueur5@example.test", name: "Thomas" },
  mehdi: { email: "joueur6@example.test", name: "Mehdi" },
  lea: { email: "joueur7@example.test", name: "Léa" },
  hugo: { email: "joueur8@example.test", name: "Hugo" },
  nora: { email: "desactive@example.test", name: "Nora", banned: true },
} as const satisfies Record<string, { email: string; name: string; role?: "admin"; banned?: boolean }>;

type Person = keyof typeof PEOPLE;

/** On the allow list without an account: for the sign-up test. nouveau2@example.test is left out:
 * the admin adds it in e2e/auth.spec.ts (decision of 30/09/2026). */
const NEW_EMAILS = ["nouveau1@example.test"];

export type SeedSummary = {
  users: number;
  allowedEmails: number;
  categories: number;
  seasons: { older: string; previous: string; current: string };
  questions: number;
  predictions: number;
  events: number;
  announcements: number;
  prizes: number;
  standings: number;
  extensions: number;
  chatMessages: number;
  chatReads: number;
};

/** Erases every table of the public schema except app_meta, and restarts the identities. */
async function clearDatabase(db: Database): Promise<void> {
  const result = (await db.execute(
    sql`select tablename from pg_tables where schemaname = 'public' and tablename <> 'app_meta'`,
  )) as unknown as { rows: { tablename: string }[] };
  if (result.rows.length === 0) return;
  const tables = sql.join(
    result.rows.map(({ tablename }) => sql.identifier(tablename)),
    sql`, `,
  );
  await db.execute(sql`truncate table ${tables} restart identity cascade`);
}

function seedCalendar(now: Date) {
  const { older, previous, current } = seedSeasons(now);
  const pastSpan = Math.min(now.getTime() - current.startsAt.getTime(), PAST_SPAN_DAYS * DAY);
  const shift = (ms: number) => new Date(now.getTime() + ms);
  return {
    older,
    previous,
    current,
    /** Exact offset from now, for dates that do not decide a season. */
    shift,
    /** In the current season, `days` (≤ 30) before now. */
    daysAgo: (days: number) => shift(-(days / PAST_SPAN_DAYS) * pastSpan),
    /** `days` after now: still the current season, which has no end. */
    daysAhead: (days: number) => shift(days * DAY),
    /** `days` after the start of the previous season. */
    previousSeasonDay: (days: number) => new Date(previous.startsAt.getTime() + days * DAY),
    /** `days` after the start of the older season. */
    olderSeasonDay: (days: number) => new Date(older.startsAt.getTime() + days * DAY),
    /** A month before the older season: the accounts belong to every seeded season (§5.6). */
    accountsCreatedAt: new Date(older.startsAt.getTime() - PAST_SPAN_DAYS * DAY),
  };
}

type QuestionSpec = {
  category: string;
  type: "number" | "choice";
  /** Malus of a wrong answer, required for a choice question (v1.2). */
  wrongAnswerMalus?: number;
  title: string;
  description?: string;
  unit?: string;
  source: string;
  help?: { biUrl?: string; lastYear?: string; hint?: string };
  coefficient?: 1 | 2 | 3;
  status: "draft" | "published" | "cancelled";
  opensAt?: Date;
  closesAt?: Date;
  expectedResultAt?: Date;
  options?: string[];
  result?: number | string;
  resolvedAt?: Date;
  correctedAt?: Date;
  cancelledAt?: Date;
};

type SeededQuestion = {
  id: number;
  optionIds: Map<string, number>;
  /** Scoring data, for a resolved question. */
  scoring: StandingsQuestion | null;
};

type PredictionSpec = {
  person: Person;
  /** A number, or the label of an option. */
  answer: number | string;
  joker?: boolean;
  validated?: boolean;
};

export async function seedDatabase(db: Database, { now, env }: { now: Date; env: Env }): Promise<SeedSummary> {
  const refusal = await seedRefusal(db, env);
  if (refusal) throw new SeedRefusedError(refusal);

  const calendar = seedCalendar(now);
  const { shift, daysAgo, daysAhead, previousSeasonDay, olderSeasonDay } = calendar;
  const passwordHash = await hashPassword(SEED_PASSWORD);

  return db.transaction(async (tx) => {
    await clearDatabase(tx);

    // Accounts: the same password for everyone, hashed the way Better Auth does.
    const ids = Object.fromEntries(Object.keys(PEOPLE).map((person) => [person, generateId()])) as Record<Person, string>;
    await tx.insert(user).values(
      (Object.entries(PEOPLE) as [Person, (typeof PEOPLE)[Person]][]).map(([person, data]) => ({
        id: ids[person],
        name: data.name,
        email: data.email,
        role: "role" in data ? data.role : "player",
        banned: "banned" in data ? data.banned : false,
        banReason: "banned" in data ? "A quitté l'équipe" : null,
        avatar: defaultAvatarFor(ids[person]),
        // The team was there before the seeded seasons: every account belongs to their standings.
        createdAt: calendar.accountsCreatedAt,
        // Camille last came 2 hours ago: the question opened 1 hour ago is new to her (§5.9).
        lastSeenAt: person === "camille" ? shift(-2 * HOUR) : null,
      })),
    );
    await tx.insert(account).values(
      Object.values(ids).map((userId) => ({
        id: generateId(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: passwordHash,
        updatedAt: now,
      })),
    );
    const allowed = [
      ...Object.values(PEOPLE)
        .filter((data) => !("role" in data))
        .map(({ email }) => email),
      ...NEW_EMAILS,
    ];
    await tx.insert(allowedEmail).values(allowed.map((email) => ({ email, createdBy: ids.admin })));

    const categories = await tx
      .insert(category)
      .values([
        { name: "JPO" },
        { name: "Candidatures" },
        { name: "Intégration" },
        { name: "Archivée", archivedAt: shift(-30 * DAY) },
      ])
      .returning();
    const categoryId = new Map(categories.map(({ id, name }) => [name, id]));

    const seasons = await tx
      .insert(season)
      .values([calendar.older, { ...calendar.previous, proclaimedAt: previousSeasonDay(150) }, calendar.current])
      .returning();
    const seasonIdOf = (label: string) => seasons.find((row) => row.label === label)!.id;
    const previousSeasonId = seasonIdOf(calendar.previous.label);
    const currentSeasonId = seasonIdOf(calendar.current.label);

    let questionCount = 0;
    let predictionCount = 0;
    let eventCount = 0;

    async function addQuestion(spec: QuestionSpec): Promise<SeededQuestion> {
      const questionSeason = spec.closesAt ? seasonAt(seasons, spec.closesAt) : null;
      if (spec.closesAt && !questionSeason) throw new Error(`Seed question outside the seeded seasons: ${spec.title}`);
      const [row] = await tx
        .insert(question)
        .values({
          seasonId: questionSeason?.id ?? null,
          categoryId: categoryId.get(spec.category)!,
          type: spec.type,
          wrongAnswerMalus: spec.wrongAnswerMalus ?? null,
          title: spec.title,
          description: spec.description ?? null,
          unit: spec.unit ?? null,
          source: spec.source,
          helpBiUrl: spec.help?.biUrl ?? null,
          helpLastYear: spec.help?.lastYear ?? null,
          helpHint: spec.help?.hint ?? null,
          opensAt: spec.opensAt ?? null,
          closesAt: spec.closesAt ?? null,
          expectedResultAt: spec.expectedResultAt ?? null,
          coefficient: spec.coefficient ?? 1,
          status: spec.status,
          resultNumber: typeof spec.result === "number" ? spec.result : null,
          resolvedAt: spec.resolvedAt ?? null,
          correctedAt: spec.correctedAt ?? null,
          cancelledAt: spec.cancelledAt ?? null,
          createdBy: ids.admin,
        })
        .returning();

      const options = spec.options?.length
        ? await tx
            .insert(questionOption)
            .values(spec.options.map((optionLabel, index) => ({ questionId: row.id, label: optionLabel, position: index + 1 })))
            .returning()
        : [];
      const optionIds = new Map(options.map(({ id, label: optionLabel }) => [optionLabel, id]));

      let resultOptionId: number | null = null;
      if (typeof spec.result === "string") {
        resultOptionId = optionIds.get(spec.result)!;
        await tx.update(question).set({ resultOptionId }).where(eq(question.id, row.id));
      }
      questionCount += 1;
      const { id, type, coefficient, resultNumber, wrongAnswerMalus, resolvedAt } = row;
      const scoring = resolvedAt ? { id, type, coefficient, resultNumber, resultOptionId, wrongAnswerMalus, resolvedAt } : null;
      return { id, optionIds, scoring };
    }

    /** Predictions made at `playedAt`, with their events: saved, then joker_on, then validated. */
    async function addPredictions(q: SeededQuestion, playedAt: Date, specs: PredictionSpec[]): Promise<StandingsPrediction[]> {
      const made: StandingsPrediction[] = [];
      for (const spec of specs) {
        const valueNumber = typeof spec.answer === "number" ? spec.answer : null;
        const optionId = typeof spec.answer === "string" ? q.optionIds.get(spec.answer)! : null;
        const joker = spec.joker ?? false;
        const jokerAt = new Date(playedAt.getTime() + 2 * MINUTE);
        const validatedAt = spec.validated ? new Date(playedAt.getTime() + 10 * MINUTE) : null;
        const [row] = await tx
          .insert(prediction)
          .values({
            questionId: q.id,
            userId: ids[spec.person],
            valueNumber,
            optionId,
            joker,
            validatedAt,
            createdAt: playedAt,
            updatedAt: validatedAt ?? (joker ? jokerAt : playedAt),
          })
          .returning();
        const event = { predictionId: row.id, questionId: q.id, ownerId: row.userId, actorId: row.userId, valueNumber, optionId };
        const events: (typeof predictionEvent.$inferInsert)[] = [{ ...event, type: "saved", joker: false, createdAt: playedAt }];
        if (joker) events.push({ ...event, type: "joker_on", joker: true, createdAt: jokerAt });
        if (validatedAt) events.push({ ...event, type: "validated", joker, createdAt: validatedAt });
        await tx.insert(predictionEvent).values(events);
        predictionCount += 1;
        eventCount += events.length;
        made.push({ questionId: q.id, userId: row.userId, valueNumber, optionId, joker });
      }
      return made;
    }

    /** Predictions are made a day after the opening of past questions (opened a week before closing). */
    const weekBefore = (closesAt: Date) => new Date(closesAt.getTime() - 7 * DAY);
    const playedOn = (closesAt: Date) => new Date(closesAt.getTime() - 6 * DAY);
    const openOpening = shift(-3 * DAY);
    const openPlay = shift(-2 * DAY);

    // Older season: one resolved question and no palmarès, ready to be proclaimed.
    const oldCloses = olderSeasonDay(70);
    const old = await addQuestion({
      category: "JPO",
      type: "number",
      title: "Combien de participants à la JPO de décembre ?",
      unit: "participants",
      source: "Tableau BI « JPO », feuilles d'émargement de décembre",
      status: "published",
      opensAt: weekBefore(oldCloses),
      closesAt: oldCloses,
      expectedResultAt: olderSeasonDay(80),
      result: 180,
      resolvedAt: olderSeasonDay(80),
    });
    // 180 participants: Camille 185 (malus 5), Sarah 170 (10), Julien 200 (20), Thomas 150 (30, the
    // worst: 30 for each absent player).
    await addPredictions(old, playedOn(oldCloses), [
      { person: "camille", answer: 185, validated: true },
      { person: "sarah", answer: 170, validated: true },
      { person: "julien", answer: 200 },
      { person: "thomas", answer: 150, validated: true },
    ]);

    // Previous season: proclaimed, 2 resolved questions and its palmarès.
    const pr1Closes = previousSeasonDay(27);
    const pr1 = await addQuestion({
      category: "Candidatures",
      type: "number",
      title: "Combien de candidatures Grande École au 31 mars ?",
      unit: "candidatures",
      source: "Tableau BI « Candidatures », total au 31/03 à minuit",
      status: "published",
      opensAt: weekBefore(pr1Closes),
      closesAt: pr1Closes,
      expectedResultAt: previousSeasonDay(60),
      result: 1200,
      resolvedAt: previousSeasonDay(60),
    });
    const pr2Closes = previousSeasonDay(97);
    const pr2 = await addQuestion({
      category: "Intégration",
      type: "choice",
      title: "Le campus du Havre dépassera-t-il 400 intégrés à la rentrée ?",
      source: "Tableau BI « Intégration », effectif au 15/09",
      wrongAnswerMalus: 50,
      status: "published",
      opensAt: weekBefore(pr2Closes),
      closesAt: pr2Closes,
      options: ["Oui", "Non"],
      result: "Oui",
      resolvedAt: previousSeasonDay(120),
    });
    const previousPredictions = [
      ...(await addPredictions(pr1, playedOn(pr1Closes), [
        { person: "sarah", answer: 1210, validated: true },
        { person: "ines", answer: 1180, validated: true },
        { person: "julien", answer: 1100 },
        { person: "camille", answer: 1500, validated: true },
        { person: "thomas", answer: 900 },
      ])),
      ...(await addPredictions(pr2, playedOn(pr2Closes), [
        { person: "sarah", answer: "Non", validated: true },
        { person: "ines", answer: "Oui", validated: true },
        { person: "julien", answer: "Oui" },
        { person: "camille", answer: "Oui", validated: true },
        { person: "thomas", answer: "Non", validated: true },
        { person: "mehdi", answer: "Oui" },
      ])),
    ];

    // Current season, resolved: vector P1 (proximity ranks with ties), vector A1 (an absent player's
    // malus, a joker) and a choice. Sarah keeps her 2 jokers of the season for e2e/player.spec.ts.
    const r1Closes = daysAgo(20);
    const r1 = await addQuestion({
      category: "JPO",
      type: "number",
      title: "Combien de participants à la JPO de septembre ?",
      unit: "participants",
      source: "Tableau BI « JPO », feuilles d'émargement",
      status: "published",
      opensAt: weekBefore(r1Closes),
      closesAt: r1Closes,
      expectedResultAt: daysAgo(15),
      result: 250,
      resolvedAt: daysAgo(15),
    });
    const r2Closes = daysAgo(12);
    const r2 = await addQuestion({
      category: "Candidatures",
      type: "number",
      title: "Combien de candidatures BBA pendant la semaine de rentrée ?",
      unit: "candidatures",
      source: "Tableau BI « Candidatures », semaine 37",
      coefficient: 2,
      status: "published",
      opensAt: weekBefore(r2Closes),
      closesAt: r2Closes,
      expectedResultAt: daysAgo(8),
      result: 1000,
      resolvedAt: daysAgo(8),
      correctedAt: daysAgo(7),
    });
    const r3Closes = daysAgo(6);
    const r3ResolvedAt = daysAgo(3);
    const r3 = await addQuestion({
      category: "Intégration",
      type: "choice",
      title: "Quel campus comptera le plus d'intégrés en Bachelor ?",
      source: "Tableau BI « Intégration », effectifs par campus",
      coefficient: 2,
      wrongAnswerMalus: 100,
      status: "published",
      opensAt: weekBefore(r3Closes),
      closesAt: r3Closes,
      options: ["Caen", "Le Havre", "Paris"],
      result: "Le Havre",
      resolvedAt: r3ResolvedAt,
    });
    await addPredictions(r1, playedOn(r1Closes), [
      { person: "sarah", answer: 240, validated: true },
      { person: "julien", answer: 262, joker: true, validated: true },
      { person: "ines", answer: 235, validated: true },
      { person: "camille", answer: 235 },
      { person: "thomas", answer: 300, validated: true },
    ]);
    // Vector A1 (real 1 000, coefficient 2): Mehdi 900 (200), Léa 1 300 with a joker (300), Sarah
    // 1 050 (100); the worst gap, 300 × 2 = 600, for each absent player.
    await addPredictions(r2, playedOn(r2Closes), [
      { person: "mehdi", answer: 900, validated: true },
      { person: "lea", answer: 1300, joker: true, validated: true },
      { person: "sarah", answer: 1050 },
    ]);
    await addPredictions(r3, playedOn(r3Closes), [
      { person: "sarah", answer: "Caen", validated: true },
      { person: "julien", answer: "Le Havre", validated: true },
      { person: "ines", answer: "Le Havre", validated: true },
      { person: "camille", answer: "Paris" },
      { person: "thomas", answer: "Le Havre", joker: true, validated: true },
      { person: "hugo", answer: "Le Havre", validated: true },
      { person: "admin", answer: "Caen", validated: true },
      { person: "nora", answer: "Le Havre", validated: true },
    ]);

    // Current season, closed and waiting for its result.
    const closedCloses = daysAgo(2);
    const closed = await addQuestion({
      category: "JPO",
      type: "number",
      title: "Combien de visiteurs sur le stand du salon Studyrama ?",
      unit: "visiteurs",
      source: "Compteur du stand, relevé par l'équipe salons",
      status: "published",
      opensAt: weekBefore(closedCloses),
      closesAt: closedCloses,
      expectedResultAt: shift(30 * DAY),
    });
    await addPredictions(closed, playedOn(closedCloses), [
      { person: "sarah", answer: 180, validated: true },
      { person: "julien", answer: 220 },
      { person: "ines", answer: 250, validated: true },
      { person: "camille", answer: 205 },
      { person: "thomas", answer: 300, validated: true },
      { person: "mehdi", answer: 240 },
      { person: "hugo", answer: 262, validated: true },
    ]);
    // A second one, left without result by every test: e2e/admin-questions.spec.ts resolves the first.
    // v1.2: Camille has the witness value, Mehdi an extension (no prediction), Hugo neither.
    const webinarCloses = daysAgo(1);
    const webinar = await addQuestion({
      category: "Candidatures",
      type: "number",
      title: "Combien d'inscrits au webinaire Grande École de septembre ?",
      unit: "inscrits",
      source: "Plateforme de webinaires, inscrits à la date du direct",
      status: "published",
      opensAt: weekBefore(webinarCloses),
      closesAt: webinarCloses,
      expectedResultAt: shift(10 * DAY),
    });
    await addPredictions(webinar, playedOn(webinarCloses), [
      { person: "sarah", answer: 140, validated: true },
      { person: "julien", answer: 120 },
      { person: "ines", answer: 150, joker: true, validated: true },
      { person: "thomas", answer: 95, validated: true },
      { person: "lea", answer: 130 },
      { person: "admin", answer: 110, validated: true },
      { person: "camille", answer: CLOSED_WITNESS_VALUE, validated: true },
    ]);
    // Mehdi was away: the admin reopened the question for him until 2 days from now (§5.14).
    await tx.insert(questionExtension).values({
      questionId: webinar.id,
      userId: ids.mehdi,
      closesAt: shift(2 * DAY),
      grantedBy: ids.admin,
      // Between the closing and now, whatever the day (the past gaps shrink near 1 October).
      grantedAt: new Date((webinarCloses.getTime() + now.getTime()) / 2),
    });

    // Current season, open: closing in 1 day (urgent), 3, 5 and 6 days.
    const o1 = await addQuestion({
      category: "JPO",
      type: "number",
      title: "Combien de participants à la JPO du 15 novembre ?",
      description: "Participants présents, tous programmes confondus, accompagnants exclus.",
      unit: "participants",
      source: "Tableau BI « JPO », feuilles d'émargement du 15 novembre",
      help: {
        biUrl: "https://bi.example.test/jpo",
        lastYear: "212",
        hint: "Compare le nombre d'inscrits à J-7 avec celui de l'an dernier.",
      },
      status: "published",
      opensAt: openOpening,
      closesAt: daysAhead(1),
      expectedResultAt: shift(45 * DAY),
    });
    const o2 = await addQuestion({
      category: "Candidatures",
      type: "number",
      title: "Combien de candidatures Grande École au 31 mai ?",
      unit: "candidatures",
      source: "Tableau BI « Candidatures », total au 31/05 à minuit",
      help: { biUrl: "https://bi.example.test/candidatures", lastYear: "2 318" },
      coefficient: 2,
      status: "published",
      opensAt: openOpening,
      closesAt: daysAhead(3),
      expectedResultAt: shift(240 * DAY),
    });
    const o3 = await addQuestion({
      category: "Candidatures",
      type: "choice",
      title: "Quel programme recevra le plus de candidatures en décembre ?",
      source: "Tableau BI « Candidatures », total de décembre par programme",
      help: { hint: "Regarde la saisonnalité des trois dernières années." },
      wrongAnswerMalus: 100,
      status: "published",
      opensAt: openOpening,
      closesAt: daysAhead(5),
      expectedResultAt: shift(95 * DAY),
      options: ["BBA", "Grande École", "MSc"],
    });
    const o4 = await addQuestion({
      category: "Intégration",
      type: "choice",
      title: "Le taux d'intégration du Bachelor dépassera-t-il 60 % ?",
      source: "Tableau BI « Intégration », taux au 30/09",
      wrongAnswerMalus: 50,
      status: "published",
      // Opened 1 hour ago: new to Camille, whose last visit was 2 hours ago.
      opensAt: shift(-HOUR),
      closesAt: daysAhead(6),
      options: ["Oui", "Non"],
    });
    await addPredictions(o1, openPlay, [
      { person: "ines", answer: 240 },
      { person: "camille", answer: 260, validated: true },
      { person: "thomas", answer: 300, joker: true },
      { person: "mehdi", answer: 210, validated: true },
      { person: "hugo", answer: WITNESS_VALUE, joker: true, validated: true },
      { person: "admin", answer: 250 },
    ]);
    await addPredictions(o2, openPlay, [
      { person: "ines", answer: 2400, joker: true, validated: true },
      { person: "lea", answer: 2300 },
      { person: "camille", answer: 2150 },
    ]);
    await addPredictions(o3, openPlay, [
      { person: "ines", answer: "Grande École" },
      { person: "mehdi", answer: "BBA", joker: true, validated: true },
      { person: "admin", answer: "MSc" },
    ]);
    await addPredictions(o4, shift(-45 * MINUTE), [{ person: "thomas", answer: "Oui", validated: true }]);

    // Current season, scheduled: invisible to players until it opens.
    await addQuestion({
      category: "JPO",
      type: "number",
      title: "Combien de participants à la JPO de janvier ?",
      unit: "participants",
      source: "Tableau BI « JPO », feuilles d'émargement de janvier",
      status: "published",
      opensAt: daysAhead(2),
      closesAt: daysAhead(6.5),
    });

    // Current season, cancelled while open, with a joker that is given back.
    const cancelled = await addQuestion({
      category: "Candidatures",
      type: "number",
      title: "Combien de dossiers complets au 15 octobre ?",
      unit: "dossiers",
      source: "Tableau BI « Candidatures », dossiers complets",
      status: "cancelled",
      opensAt: openOpening,
      closesAt: daysAhead(4),
      cancelledAt: shift(-DAY),
    });
    await addPredictions(cancelled, openPlay, [{ person: "hugo", answer: 1500, joker: true }]);

    // A draft, without dates.
    await addQuestion({
      category: "Intégration",
      type: "number",
      title: "Combien d'intégrés en alternance à la rentrée de janvier ?",
      unit: "intégrés",
      source: "Tableau BI « Intégration », alternants",
      status: "draft",
    });

    // Palmarès of the previous season, computed as the proclamation does (§5.12).
    const players = (Object.entries(PEOPLE) as [Person, (typeof PEOPLE)[Person]][]).map(([person, data]) => ({
      id: ids[person],
      name: data.name,
      banned: "banned" in data ? data.banned : false,
    }));
    const previousQuestions = [pr1.scoring!, pr2.scoring!];
    const standings = computeStandings({ questions: previousQuestions, predictions: previousPredictions, players });
    await tx.insert(seasonStanding).values(
      standings.map((row) => ({
        seasonId: previousSeasonId,
        userId: row.userId,
        rank: row.rank,
        malus: row.malus / 100,
        bullseyes: row.bullseyes,
        meanError: row.meanError,
        questionsPlayed: row.questionsPlayed,
        nameSnapshot: row.name,
      })),
    );

    const announcements = await tx.insert(announcement).values([
      {
        body: "Bienvenue sur Les petits pronos de la promo ! Les questions de la campagne d'octobre sont ouvertes : valide tes pronos avant la clôture.",
        createdBy: ids.admin,
        createdAt: shift(-2 * DAY),
        updatedAt: shift(-2 * DAY),
      },
      {
        body: "Le résultat du Bachelor est tombé : va voir le classement !",
        createdBy: ids.admin,
        createdAt: shift(-3 * HOUR),
        updatedAt: shift(-3 * HOUR),
      },
    ]).returning();
    const prizes = await tx.insert(prize).values([
      { seasonId: currentSeasonId, rankLabel: "1er", description: "Un déjeuner d'équipe offert", position: 1 },
      { seasonId: currentSeasonId, rankLabel: "2e", description: "Un sweat de l'école", position: 2 },
      { seasonId: currentSeasonId, rankLabel: "3e", description: "Un mug de l'école", position: 3 },
    ]).returning();

    // Chat (§9.6): a dozen messages over two days, in the order of their dates (the ids give the
    // order of the thread), Thomas's deleted, and the result message of the Bachelor campus
    // question, posted when it was resolved.
    type ChatSpec = { at: Date; person?: Person; body?: string; deleted?: boolean; resultOf?: number };
    const chatSpecs: ChatSpec[] = [
      { at: r3ResolvedAt, resultOf: r3.id },
      { at: shift(-26 * HOUR), person: "sarah", body: "Salut l'équipe 👋 Qui a déjà validé ses pronos de la semaine ?" },
      { at: shift(-25.5 * HOUR), person: "julien", body: "Moi ! J'ai tenté le coup sur la JPO 🎯" },
      { at: shift(-25 * HOUR), person: "lea", body: "Le résultat du campus Bachelor m'a surprise 😮\nJe n'aurais jamais dit Le Havre." },
      { at: shift(-24 * HOUR), person: "thomas", deleted: true },
      { at: shift(-22 * HOUR), person: "admin", body: "Rappel : ne donnez pas vos pronos dans le chat avant la clôture 😉" },
      { at: shift(-5 * HOUR), person: "hugo", body: "Bravo à ceux qui avaient trouvé Le Havre 👏👏" },
      { at: shift(-3 * HOUR), person: "ines", body: "Le webinaire a cartonné, à mon avis on sera tous loin 📈" },
      { at: shift(-2 * HOUR), person: "mehdi", body: "De retour de congés, j'ai du retard sur mes pronos 😅" },
      { at: shift(-40 * MINUTE), person: "sarah", body: "Qui vient au salon de Caen samedi ? ☕" },
      { at: shift(-15 * MINUTE), person: "lea", body: "Moi ! 🙌" },
    ];
    chatSpecs.sort((a, b) => a.at.getTime() - b.at.getTime());
    const chatIds: number[] = [];
    for (const spec of chatSpecs) {
      const [row] = await tx
        .insert(chatMessage)
        .values(
          spec.resultOf !== undefined
            ? { kind: "result", questionId: spec.resultOf, createdAt: spec.at }
            : {
                kind: "message",
                userId: ids[spec.person!],
                body: spec.deleted ? null : spec.body!,
                createdAt: spec.at,
                ...(spec.deleted ? { deletedAt: new Date(spec.at.getTime() + 5 * MINUTE), deletedBy: ids[spec.person!] } : {}),
              },
        )
        .returning({ id: chatMessage.id });
      chatIds.push(row.id);
    }
    // Sarah read everything; Julien and the admin, up to the admin's reminder; the others never
    // opened the chat (every message unread, their own aside).
    const reminderId = chatIds[chatSpecs.findIndex(({ person }) => person === "admin")];
    const chatReads = await tx
      .insert(chatRead)
      .values([
        { userId: ids.sarah, lastReadId: chatIds.at(-1)!, updatedAt: shift(-10 * MINUTE) },
        { userId: ids.julien, lastReadId: reminderId, updatedAt: shift(-21 * HOUR) },
        { userId: ids.admin, lastReadId: reminderId, updatedAt: shift(-21 * HOUR) },
      ])
      .returning();

    return {
      users: Object.keys(PEOPLE).length,
      allowedEmails: allowed.length,
      categories: categories.length,
      seasons: { older: calendar.older.label, previous: calendar.previous.label, current: calendar.current.label },
      questions: questionCount,
      predictions: predictionCount,
      events: eventCount,
      announcements: announcements.length,
      prizes: prizes.length,
      standings: standings.length,
      extensions: 1,
      chatMessages: chatIds.length,
      chatReads: chatReads.length,
    };
  });
}
