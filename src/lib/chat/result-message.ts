import { formatCount, formatNumber } from "@/lib/format";

// Text of the automatic result message of the chat (architecture §5.15). It is computed on reading
// from the question and its predictions, so that a correction of the result changes it without a
// second message.

type Common = {
  title: string;
  /** The result was corrected after its first entry. */
  corrected: boolean;
  /** Number of predictions on the question. */
  predictions: number;
};

export type ResultMessageData =
  | (Common & {
      type: "number";
      resultNumber: number;
      unit: string | null;
      /** Names of the closest predictions: proximity rank 1, ties included (§5.5). */
      closest: string[];
    })
  | (Common & {
      type: "choice";
      rightAnswer: string;
      /** Predictions with the right answer. */
      rightAnswers: number;
    });

const byName = new Intl.Collator("fr", { sensitivity: "base" });

/** "Léa", "Hugo et Léa", "Élodie, Hugo et Léa". */
function joinNames(names: string[]): string {
  const sorted = [...names].sort(byName.compare);
  return sorted.length < 2 ? sorted.join("") : `${sorted.slice(0, -1).join(", ")} et ${sorted.at(-1)}`;
}

/**
 * « Résultat : <énoncé> → <valeur> <unité>. Le plus proche : <nom>. » for a number;
 * « Résultat : <énoncé> → <bonne réponse>. <n> bonne(s) réponse(s) sur <m> pronos. » for a choice.
 * Without any prediction, the second sentence is left out; « (corrigé) » follows « Résultat ».
 */
export function resultMessageText(data: ResultMessageData): string {
  const answer =
    data.type === "number" ? `${formatNumber(data.resultNumber)}${data.unit ? ` ${data.unit}` : ""}` : data.rightAnswer;
  const first = `Résultat${data.corrected ? " (corrigé)" : ""} : ${data.title} → ${answer}.`;
  if (data.predictions === 0) return first;
  if (data.type === "choice") {
    return `${first} ${formatCount(data.rightAnswers, "bonne réponse", "bonnes réponses")} sur ${formatCount(data.predictions, "prono")}.`;
  }
  if (data.closest.length === 0) return first;
  return `${first} ${data.closest.length === 1 ? "Le plus proche" : "Les plus proches"} : ${joinNames(data.closest)}.`;
}
