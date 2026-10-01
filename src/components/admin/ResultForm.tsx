"use client";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { useFormAction } from "@/components/ui/useFormAction";
import type { FormState } from "@/lib/actions/form-state";
import { resolveQuestionAction } from "@/lib/actions/questions";

const TILE =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-field border border-line-strong px-3.5 py-2 text-[15px] font-semibold has-checked:border-2 has-checked:border-accent has-checked:bg-accent-soft";

/**
 * Real value or right answer of a closed question (§5.11): the number is read like a prediction
 * (§5.3). A later different entry is a correction, shown on the question's page.
 */
export function ResultForm({
  questionId,
  type,
  unit,
  options,
  currentValue,
  currentOptionId,
  resolved,
}: {
  questionId: number;
  type: "number" | "choice";
  unit: string | null;
  options: { id: number; label: string }[];
  /** Current real value, as typed ("2450,5"), or empty. */
  currentValue: string;
  currentOptionId: number | null;
  resolved: boolean;
}) {
  const [state, onSubmit, pending] = useFormAction<FormState>(resolveQuestionAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="questionId" value={questionId} />
      {type === "number" ? (
        <Field
          name="rawValue"
          label={unit ? `Valeur réelle (${unit})` : "Valeur réelle"}
          inputMode="decimal"
          autoComplete="off"
          defaultValue={currentValue}
          hint="Par exemple 2 450 ou 12,5."
          error={errors.rawValue}
          className="max-w-80"
        />
      ) : (
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-1.5 font-display text-[15px] font-bold uppercase tracking-[0.08em] text-muted">
            Bonne réponse
          </legend>
          {options.map(({ id, label }) => (
            <label key={id} className={TILE}>
              <input type="radio" name="optionId" value={id} defaultChecked={currentOptionId === id} className="size-4 accent-accent" />
              {label}
            </label>
          ))}
        </fieldset>
      )}
      <FormMessage
        feedback={state ? { tone: state.ok ? "success" : "error", text: state.message } : null}
        // The error of the value is already shown under the field: here, it is only announced.
        className={state && !state.ok && state.fieldErrors?.rawValue ? "sr-only" : undefined}
      />
      <Button type="submit" pending={pending} className="self-start">
        {resolved ? "Corriger le résultat" : "Enregistrer le résultat"}
      </Button>
      {resolved ? (
        <p className="text-[13px] text-muted">
          Une correction recalcule les points ; la page de la question indique la date de la correction.
        </p>
      ) : null}
    </form>
  );
}
