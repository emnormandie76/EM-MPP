import { z } from "zod";
import { COEFFICIENTS } from "@/lib/game/constants";
import { parisLocalToUtc } from "@/lib/game/time";

// Question inputs shared by the services and the back-office forms (architecture §5.11, §8.3).
// Dates are typed in Paris time (`<input type="datetime-local">`) and converted here.

export const QUESTION_LIMITS = {
  titleMin: 5,
  titleMax: 200,
  descriptionMax: 2000,
  unitMax: 40,
  sourceMax: 300,
  helpBiUrlMax: 500,
  helpLastYearMax: 100,
  helpHintMax: 500,
  optionLabelMax: 80,
  optionsMin: 2,
  optionsMax: 10,
} as const;

/** The four kinds of the form: a number, a "Juste Prix" number, a choice, or the yes/no template. */
export const QUESTION_KINDS = ["number", "priceIsRight", "choice", "yesNo"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  number: "Nombre",
  priceIsRight: "Nombre Juste Prix",
  choice: "Choix",
  yesNo: "Oui/Non",
};

/** Answers created by the yes/no template (§5.11). */
export const YES_NO_OPTIONS = ["Oui", "Non"] as const;

/** Shown by the question form while the admin has not created any season (§5.13). */
export const NO_SEASON_YET =
  "Aucune saison n'existe encore : la question peut être enregistrée en brouillon, mais elle ne pourra être publiée qu'une fois la première saison créée.";

const L = QUESTION_LIMITS;

export const QUESTION_MESSAGES = {
  kind: "Choisis un type de question.",
  category: "Choisis une catégorie.",
  title: `L'énoncé doit faire de ${L.titleMin} à ${L.titleMax} caractères.`,
  description: `La description doit faire ${L.descriptionMax} caractères au plus.`,
  unit: `L'unité doit faire ${L.unitMax} caractères au plus.`,
  source: "Indique d'où viendra la valeur réelle.",
  sourceLength: `La source doit faire ${L.sourceMax} caractères au plus.`,
  coefficient: "Le coefficient vaut 1, 2 ou 3.",
  helpBiUrl: "Le lien doit commencer par https:// ou http://.",
  helpLastYear: `La valeur de l'an dernier doit faire ${L.helpLastYearMax} caractères au plus.`,
  helpHint: `L'indice doit faire ${L.helpHintMax} caractères au plus.`,
  date: "Date invalide.",
  optionsCount: `Une question à choix a de ${L.optionsMin} à ${L.optionsMax} réponses.`,
  optionEmpty: "Chaque réponse doit avoir un libellé.",
  optionLength: `Une réponse fait ${L.optionLabelMax} caractères au plus.`,
  optionsDuplicate: "Deux réponses ont le même libellé.",
  closesBeforeOpens: "La clôture doit être après l'ouverture.",
  resultBeforeCloses: "Le résultat prévu ne peut pas être avant la clôture.",
  closesInPast: "La clôture doit être dans le futur.",
} as const;

const M = QUESTION_MESSAGES;

/** Free text: trimmed, empty means null. */
function optionalText(max: number, message: string) {
  return z
    .string(message)
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));
}

/** `<input type="datetime-local">` value, read as Paris time; empty means null. */
export const localDateTimeSchema = z
  .string(M.date)
  .nullable()
  .transform((value, ctx) => {
    const text = value?.trim() ?? "";
    if (text === "") return null;
    try {
      return parisLocalToUtc(text);
    } catch {
      ctx.addIssue({ code: "custom", message: M.date });
      return z.NEVER;
    }
  });

const HTTP_URL = /^https?:\/\/[^\s]+$/i;

/** Every field of the question form, each one optional: an update only sends what it changes. */
export const questionFieldsSchema = z.object({
  kind: z.enum(QUESTION_KINDS, M.kind),
  categoryId: z.coerce.number(M.category).int(M.category).positive(M.category),
  title: z.string(M.title).trim().min(L.titleMin, M.title).max(L.titleMax, M.title),
  description: optionalText(L.descriptionMax, M.description),
  unit: optionalText(L.unitMax, M.unit),
  options: z.array(z.string(M.optionEmpty).trim(), M.optionsCount).max(L.optionsMax, M.optionsCount),
  source: z.string(M.source).trim().min(1, M.source).max(L.sourceMax, M.sourceLength),
  coefficient: z.coerce
    .number(M.coefficient)
    .refine((value) => (COEFFICIENTS as readonly number[]).includes(value), M.coefficient),
  helpBiUrl: optionalText(L.helpBiUrlMax, M.helpBiUrl).refine((value) => value === null || HTTP_URL.test(value), M.helpBiUrl),
  helpLastYear: optionalText(L.helpLastYearMax, M.helpLastYear),
  helpHint: optionalText(L.helpHintMax, M.helpHint),
  opensAt: localDateTimeSchema,
  closesAt: localDateTimeSchema,
  expectedResultAt: localDateTimeSchema,
});

export type QuestionFields = z.infer<typeof questionFieldsSchema>;

/** Creation: kind, category, title and source are required (§5.11); the rest may stay empty. */
export const createQuestionSchema = questionFieldsSchema
  .partial()
  .required({ kind: true, categoryId: true, title: true, source: true });

export const updateQuestionSchema = questionFieldsSchema.partial().extend({
  questionId: z.coerce.number().int().positive(),
});

export type QuestionShape = {
  type: "number" | "choice";
  priceIsRight: boolean;
  unit: string | null;
  options: string[];
};

/**
 * Type, "Juste Prix", unit and answers of a kind (§4.5): a number has a unit and no answers; a
 * choice has 2 to 10 answers, non-empty and unique whatever the case, and no unit.
 */
export function shapeOf(
  kind: QuestionKind,
  unit: string | null | undefined,
  options: readonly string[] | undefined,
): { ok: true; shape: QuestionShape } | { ok: false; message: string } {
  if (kind === "number" || kind === "priceIsRight") {
    return { ok: true, shape: { type: "number", priceIsRight: kind === "priceIsRight", unit: unit ?? null, options: [] } };
  }
  const labels = kind === "yesNo" ? [...YES_NO_OPTIONS] : (options ?? []).map((label) => label.trim());
  if (labels.length < L.optionsMin || labels.length > L.optionsMax) return { ok: false, message: M.optionsCount };
  if (labels.some((label) => label === "")) return { ok: false, message: M.optionEmpty };
  if (labels.some((label) => label.length > L.optionLabelMax)) return { ok: false, message: M.optionLength };
  const keys = new Set(labels.map((label) => label.toLocaleLowerCase("fr")));
  if (keys.size !== labels.length) return { ok: false, message: M.optionsDuplicate };
  return { ok: true, shape: { type: "choice", priceIsRight: false, unit: null, options: labels } };
}

/** Kind shown in the form for a stored question: a choice answered "Oui", "Non" reads as yes/no. */
export function kindOf(question: { type: "number" | "choice"; priceIsRight: boolean }, optionLabels: readonly string[]): QuestionKind {
  if (question.type === "number") return question.priceIsRight ? "priceIsRight" : "number";
  const yesNo = optionLabels.length === 2 && optionLabels[0] === YES_NO_OPTIONS[0] && optionLabels[1] === YES_NO_OPTIONS[1];
  return yesNo ? "yesNo" : "choice";
}

export type QuestionDates = { opensAt: Date | null; closesAt: Date | null; expectedResultAt: Date | null };

/** Date consistency, whatever the status: opening before closing, expected result not before closing. */
export function dateErrors({ opensAt, closesAt, expectedResultAt }: QuestionDates): Record<string, string> {
  const errors: Record<string, string> = {};
  if (opensAt && closesAt && opensAt >= closesAt) errors.closesAt = M.closesBeforeOpens;
  if (closesAt && expectedResultAt && expectedResultAt < closesAt) errors.expectedResultAt = M.resultBeforeCloses;
  return errors;
}
