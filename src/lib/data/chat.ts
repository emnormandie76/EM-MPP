import "server-only";
import { and, asc, count, desc, eq, gt, inArray, isNull, lt, ne, or, type SQL, sql } from "drizzle-orm";
import type { Viewer } from "@/lib/auth/session";
import { type AvatarKey, isAvatarKey } from "@/lib/avatars";
import { CHAT_PAGE_SIZE, CHAT_UPDATES_LIMIT } from "@/lib/chat/constants";
import { resultMessageText } from "@/lib/chat/result-message";
import type { Database } from "@/lib/db/client";
import { chatMessage, chatRead, prediction, question, questionOption, user } from "@/lib/db/schema";
import { scoreQuestion } from "@/lib/game/scoring";

// Reads of the general chat (architecture §5.15, v1.2, step 8d), the same for every signed-in
// account. A result message has no stored text: it is computed here from its question, whose values
// are public once resolved (§6.6), so that a correction shows in it. It is no longer shown once its
// question is cancelled. A deleted message keeps its author and date, never its text.

type ViewerRole = Pick<Viewer, "id" | "role">;

export type ChatAuthorView = {
  id: string;
  name: string;
  avatar: AvatarKey;
  /** Disabled or anonymized account. */
  inactive: boolean;
};

export type ChatMessageView = {
  id: number;
  kind: "message" | "result";
  /** ISO date: the views also travel as JSON (`GET /api/chat`). */
  createdAt: string;
  /** The author of a player's message; null for a result message. */
  author: ChatAuthorView | null;
  /** Text of a player's message; null for a result message and once deleted. */
  body: string | null;
  deleted: boolean;
  /** A result message: its question and its text; null once deleted. */
  result: { questionId: number; text: string } | null;
  /** The viewer may delete it: their own message, or any message for an admin. */
  canDelete: boolean;
};

export type ChatPage = {
  /** Oldest first. */
  messages: ChatMessageView[];
  /** Older messages exist (« Messages plus anciens »). */
  hasMore: boolean;
  /** ISO date of the read: the `since` of the first poll. */
  serverTime: string;
};

export type ChatUpdates = {
  /** New messages, oldest first. */
  messages: ChatMessageView[];
  /** Messages deleted since `since`. */
  deletedIds: number[];
  /** ISO date of the read, to send back as `since` on the next poll. */
  serverTime: string;
};

/**
 * Margin of the polls: a message (or a deletion) dated just before a poll may be committed just
 * after it, and an id may be committed after a larger one. Each poll sends again what changed over
 * the last minute; the page merges by id.
 */
const UPDATES_OVERLAP_MS = 60_000;

/** A player's message, or a result message whose question is not cancelled. */
const SHOWN: SQL = or(eq(chatMessage.kind, "message"), ne(question.status, "cancelled"))!;

const COLUMNS = {
  id: chatMessage.id,
  kind: chatMessage.kind,
  createdAt: chatMessage.createdAt,
  body: chatMessage.body,
  deletedAt: chatMessage.deletedAt,
  userId: chatMessage.userId,
  questionId: chatMessage.questionId,
  authorName: user.name,
  authorAvatar: user.avatar,
  authorBanned: user.banned,
};

type Row = {
  id: number;
  kind: "message" | "result";
  createdAt: Date;
  body: string | null;
  deletedAt: Date | null;
  userId: string | null;
  questionId: number | null;
  authorName: string | null;
  authorAvatar: string | null;
  authorBanned: boolean | null;
};

function selectMessages(db: Database, where: SQL | undefined) {
  return db
    .select(COLUMNS)
    .from(chatMessage)
    .leftJoin(user, eq(user.id, chatMessage.userId))
    .leftJoin(question, eq(question.id, chatMessage.questionId))
    .where(and(SHOWN, where));
}

/** Text of the result message of each of these resolved questions (§5.15). */
async function resultTexts(db: Database, questionIds: number[]): Promise<Map<number, string>> {
  const texts = new Map<number, string>();
  if (questionIds.length === 0) return texts;
  const questions = await db
    .select({
      id: question.id,
      title: question.title,
      type: question.type,
      unit: question.unit,
      coefficient: question.coefficient,
      resultNumber: question.resultNumber,
      resultOptionId: question.resultOptionId,
      wrongAnswerMalus: question.wrongAnswerMalus,
      correctedAt: question.correctedAt,
      rightAnswer: questionOption.label,
    })
    .from(question)
    .leftJoin(questionOption, eq(questionOption.id, question.resultOptionId))
    .where(inArray(question.id, questionIds));
  const predictions = await db
    .select({ questionId: prediction.questionId, valueNumber: prediction.valueNumber, optionId: prediction.optionId, joker: prediction.joker, name: user.name })
    .from(prediction)
    .innerJoin(user, eq(user.id, prediction.userId))
    .where(inArray(prediction.questionId, questionIds));

  for (const q of questions) {
    const own = predictions.filter(({ questionId }) => questionId === q.id);
    const common = { title: q.title, corrected: q.correctedAt !== null, predictions: own.length };
    if (q.type === "number" && q.resultNumber !== null) {
      const { scores } = scoreQuestion(q, own);
      const closest = scores.filter(({ podiumRank }) => podiumRank === 1).map(({ prediction: { name } }) => name);
      texts.set(q.id, resultMessageText({ ...common, type: "number", resultNumber: q.resultNumber, unit: q.unit, closest }));
    } else if (q.type === "choice" && q.rightAnswer !== null) {
      const rightAnswers = own.filter(({ optionId }) => optionId === q.resultOptionId).length;
      texts.set(q.id, resultMessageText({ ...common, type: "choice", rightAnswer: q.rightAnswer, rightAnswers }));
    }
  }
  return texts;
}

/** Views of these rows, in the same order. */
async function toViews(db: Database, viewer: ViewerRole, rows: Row[]): Promise<ChatMessageView[]> {
  const resolved = rows.filter(({ kind, deletedAt }) => kind === "result" && deletedAt === null).map(({ questionId }) => questionId!);
  const texts = await resultTexts(db, [...new Set(resolved)]);
  return rows.map((row) => {
    const deleted = row.deletedAt !== null;
    const text = row.kind === "result" && !deleted ? texts.get(row.questionId!) : undefined;
    return {
      id: row.id,
      kind: row.kind,
      createdAt: row.createdAt.toISOString(),
      author:
        row.userId === null
          ? null
          : {
              id: row.userId,
              name: row.authorName ?? "",
              avatar: row.authorAvatar && isAvatarKey(row.authorAvatar) ? row.authorAvatar : "maillot-bleu-uni",
              inactive: row.authorBanned === true,
            },
      body: deleted ? null : row.body,
      deleted,
      result: text === undefined ? null : { questionId: row.questionId!, text },
      canDelete: !deleted && (viewer.role === "admin" || (row.kind === "message" && row.userId === viewer.id)),
    };
  });
}

/**
 * The `CHAT_PAGE_SIZE` (50) messages before `beforeId`, or the latest ones, oldest first (§5.15).
 * `hasMore` tells whether older ones exist.
 */
export async function getChatMessages(
  db: Database,
  viewer: ViewerRole,
  { beforeId }: { beforeId?: number },
  now: Date,
): Promise<ChatPage> {
  const rows = await selectMessages(db, beforeId === undefined ? undefined : lt(chatMessage.id, beforeId))
    .orderBy(desc(chatMessage.id))
    .limit(CHAT_PAGE_SIZE + 1);
  const page = rows.slice(0, CHAT_PAGE_SIZE).reverse();
  return { messages: await toViews(db, viewer, page), hasMore: rows.length > CHAT_PAGE_SIZE, serverTime: now.toISOString() };
}

/**
 * What changed since the previous poll (§5.15): the messages after `afterId` (100 at most), the
 * messages deleted since `since`, and the time of this read. Both lists also repeat the last
 * minute (`UPDATES_OVERLAP_MS`), so that a message committed late is not missed.
 */
export async function getChatUpdates(
  db: Database,
  viewer: ViewerRole,
  { afterId, since }: { afterId: number; since: Date },
  now: Date,
): Promise<ChatUpdates> {
  const recent = new Date(since.getTime() - UPDATES_OVERLAP_MS);
  const rows = await selectMessages(db, or(gt(chatMessage.id, afterId), gt(chatMessage.createdAt, recent)))
    .orderBy(asc(chatMessage.id))
    .limit(CHAT_UPDATES_LIMIT);
  const deleted = await db
    .select({ id: chatMessage.id })
    .from(chatMessage)
    .where(gt(chatMessage.deletedAt, recent))
    .orderBy(asc(chatMessage.id));
  return { messages: await toViews(db, viewer, rows), deletedIds: deleted.map(({ id }) => id), serverTime: now.toISOString() };
}

/**
 * Unread messages, for the badge of the Chat tab (§8.2): after the latest one read (all of them
 * before the first visit of the chat), except the viewer's own and the deleted ones.
 */
export async function getUnreadChatCount(db: Database, viewer: ViewerRole): Promise<number> {
  const lastRead = db.select({ id: chatRead.lastReadId }).from(chatRead).where(eq(chatRead.userId, viewer.id));
  const [row] = await db
    .select({ unread: count() })
    .from(chatMessage)
    .leftJoin(question, eq(question.id, chatMessage.questionId))
    .where(
      and(
        SHOWN,
        gt(chatMessage.id, sql`coalesce((${lastRead}), 0)`),
        isNull(chatMessage.deletedAt),
        or(isNull(chatMessage.userId), ne(chatMessage.userId, viewer.id)),
      ),
    );
  return row.unread;
}
