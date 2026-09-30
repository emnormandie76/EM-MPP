import type { QuestionStatus } from "./question-status";

// State of a prediction as shown to its owner and to the admin (architecture §5.4).

export type PredictionState = "todo" | "saved" | "validated";

const FINISHED: readonly QuestionStatus[] = ["closed", "resolved", "cancelled"];

/** A saved prediction counts as validated as soon as the question closes, with no write. */
export function predictionState(
  prediction: { validatedAt: Date | null } | null,
  status: QuestionStatus,
): PredictionState {
  if (!prediction) return "todo";
  if (prediction.validatedAt || FINISHED.includes(status)) return "validated";
  return "saved";
}
