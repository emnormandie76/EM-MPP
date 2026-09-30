// Status of a question at a given instant (architecture §5.2). Opening is included, closing excluded.

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
