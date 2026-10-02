import type { PlayerQuestion } from "@/lib/data/questions";
import { formatNumber } from "@/lib/format";
import type { PredictionFormProps } from "./PredictionForm";

/** Props of PredictionForm for a question read on the server; the saved value is formatted here. */
export function predictionFormProps(q: PlayerQuestion): PredictionFormProps {
  return {
    questionId: q.id,
    type: q.type,
    kind: q.kind,
    unit: q.unit,
    wrongAnswerMalus: q.wrongAnswerMalus,
    options: q.options,
    state: q.state,
    mine: q.mine ? { optionId: q.mine.optionId, joker: q.mine.joker, validatedAt: q.mine.validatedAt, savedAt: q.mine.savedAt } : null,
    initialValue: q.mine?.valueNumber === null || q.mine?.valueNumber === undefined ? "" : formatNumber(q.mine.valueNumber),
    jokersLeft: q.jokersLeft,
  };
}
