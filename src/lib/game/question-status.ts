// Status of a question at a given instant (architecture §5.2). Opening is included, closing excluded.
// For one player, an extension (v1.2, §5.14) keeps the question open until their own deadline.

/** Stored status of a question (column `question.status`). */
export type StoredQuestionStatus = "draft" | "published" | "cancelled";

/** Status computed from the dates: nothing ever "happens" at opening or closing time (§1.1). */
export type QuestionStatus = "draft" | "scheduled" | "open" | "closed" | "resolved" | "cancelled";

export type StatusInput = {
  status: StoredQuestionStatus;
  opensAt: Date | null;
  closesAt: Date | null;
  resolvedAt: Date | null;
};

export function questionStatus(question: StatusInput, now: Date): QuestionStatus {
  if (question.status === "cancelled") return "cancelled";
  // The database forbids a published question without dates; if one ever appeared, keep it hidden.
  if (question.status === "draft" || !question.opensAt || !question.closesAt) return "draft";
  if (question.resolvedAt) return "resolved";
  if (now < question.opensAt) return "scheduled";
  if (now < question.closesAt) return "open";
  return "closed";
}

/** A player's extension of a question: their own deadline, excluded like a closing (§5.14). */
export type ExtensionInput = { closesAt: Date };

/**
 * Status of a question for one player (§5.2, v1.2): an open or closed question is open for a player
 * whose extension still runs. Every other status is the question's own. Used for the owner of a
 * prediction by the services, and for the viewer by the reads.
 */
export function questionStatusFor(question: StatusInput, extension: ExtensionInput | null, now: Date): QuestionStatus {
  const status = questionStatus(question, now);
  if ((status === "open" || status === "closed") && extension && now < extension.closesAt) return "open";
  return status;
}
