"use client";

import { type FormEvent, useId, useOptimistic, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { type FormFeedback, FormMessage } from "@/components/ui/FormMessage";
import { type AnswerInput, savePredictionAction, setJokerAction, validatePredictionAction } from "@/lib/actions/predictions";
import { formatCount, formatDateTime, formatNumber } from "@/lib/format";
import { JOKER_DIVISOR } from "@/lib/game/constants";
import { parseNumberInput } from "@/lib/game/number-input";
import type { PredictionState } from "@/lib/game/prediction-state";
import type { Result } from "@/lib/services/result";
import type { QuestionKind } from "@/lib/validation/question";
import { StatusChip } from "./StatusChip";

// Prediction form of an open question (architecture §5.4, §8.2). "Enregistrer" keeps it editable;
// "Valider" asks for a confirmation showing the formatted value (a typing mistake would be final),
// then sends the value shown. The joker is posed or removed at once, on a saved prediction; it
// divides the malus by 2, and is absent from a season that does not allow jokers (v1.2).

export type PredictionFormProps = {
  questionId: number;
  type: "number" | "choice";
  kind: QuestionKind;
  unit: string | null;
  /** Malus of a wrong answer, recalled for a choice (v1.2). */
  wrongAnswerMalus: number | null;
  options: { id: number; label: string }[];
  state: PredictionState;
  mine: { optionId: number | null; joker: boolean; validatedAt: Date | null; savedAt: Date } | null;
  /** The saved value as the server formats it ("2 450"): the same text on both sides of the hydration. */
  initialValue: string;
  /** Jokers left in the season of the question, this question's own included; null without jokers this season. */
  jokersLeft: number | null;
};

const LABEL = "font-display text-[15px] font-bold uppercase tracking-[0.08em] text-muted";
const TILE =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-field border border-line-strong bg-surface px-3.5 py-2 text-[15px] font-semibold has-checked:border-2 has-checked:border-accent has-checked:bg-accent-soft has-disabled:cursor-default";
const BIG_TILE =
  "flex min-h-16 cursor-pointer items-center justify-center gap-2.5 rounded-field border border-line-strong bg-surface px-3.5 font-display text-2xl font-extrabold uppercase tracking-[0.04em] has-checked:border-2 has-checked:border-accent has-checked:bg-accent-soft has-disabled:cursor-default";

export function PredictionForm(props: PredictionFormProps) {
  const { questionId, type, kind, unit, wrongAnswerMalus, options, state, mine, initialValue, jokersLeft } = props;
  const id = useId();
  const inputId = `${id}-valeur`;
  const labelId = `${id}-libelle`;
  const errorId = `${id}-erreur`;

  const [raw, setRaw] = useState(initialValue);
  const [choice, setChoice] = useState<number | null>(mine?.optionId ?? null);
  const [feedback, setFeedback] = useState<FormFeedback>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [joker, setOptimisticJoker] = useOptimistic(mine?.joker ?? false);

  const validated = state === "validated";
  // Jokers available for this question: those left, plus this question's own if it has one.
  const available = (jokersLeft ?? 0) + (mine?.joker ? 1 : 0);
  const shownLeft = Math.max(0, available - (joker ? 1 : 0));

  const answer = (): AnswerInput =>
    type === "number" ? { questionId, rawValue: raw } : { questionId, optionId: choice ?? undefined };

  function report(result: Result<unknown>, success: string) {
    if (result.ok) {
      setFeedback({ tone: "success", text: success });
      return;
    }
    const message = result.fieldErrors?.rawValue ?? result.fieldErrors?.optionId;
    if (message) setFieldError(message);
    else setFeedback({ tone: "error", text: result.message });
  }

  function reset() {
    setFeedback(null);
    setFieldError(null);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    reset();
    startTransition(async () => report(await savePredictionAction(answer()), "Prono enregistré."));
  }

  /** The value as it will be validated; checked again by the server. */
  function askValidation() {
    reset();
    if (type === "number") {
      const parsed = parseNumberInput(raw);
      if (!parsed.ok) {
        setFieldError(parsed.message);
        return;
      }
      setConfirming(unit ? `${formatNumber(parsed.value)} ${unit}` : formatNumber(parsed.value));
      return;
    }
    const option = options.find(({ id: optionId }) => optionId === choice);
    if (!option) {
      setFieldError("Choisis une réponse.");
      return;
    }
    setConfirming(option.label);
  }

  function validate() {
    startTransition(async () => {
      const result = await validatePredictionAction(answer());
      setConfirming(null);
      report(result, "Prono validé.");
    });
  }

  function toggleJoker(enabled: boolean) {
    reset();
    startTransition(async () => {
      setOptimisticJoker(enabled);
      report(await setJokerAction({ questionId, enabled }), enabled ? "Joker posé." : "Joker retiré.");
    });
  }

  const describedBy = fieldError ? errorId : undefined;
  const value =
    type === "number" ? (
      <div className="flex h-15.5 items-center gap-2.5 rounded-field border-2 border-accent bg-bg px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
        <input
          id={inputId}
          name="rawValue"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          readOnly={validated}
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={describedBy}
          // w-0: the field takes the room left by the unit; its own width (20 characters at 36 px)
          // would widen the card beyond a phone screen.
          className="w-0 min-w-0 grow bg-transparent font-display text-4xl font-bold tabular-nums text-ink outline-none read-only:text-ink-2"
        />
        {unit ? <span className="shrink-0 text-sm text-muted">{unit}</span> : null}
      </div>
    ) : (
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-invalid={fieldError ? true : undefined}
        aria-describedby={describedBy}
        className={kind === "yesNo" ? "grid grid-cols-2 gap-2.5" : "flex flex-col gap-2"}
      >
        {options.map((option) => (
          <label key={option.id} className={kind === "yesNo" ? BIG_TILE : TILE}>
            <input
              type="radio"
              name={`reponse-${questionId}`}
              value={option.id}
              checked={choice === option.id}
              onChange={() => setChoice(option.id)}
              disabled={validated}
              className="size-4 shrink-0 accent-accent"
            />
            {option.label}
          </label>
        ))}
      </div>
    );

  return (
    <form onSubmit={save} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {type === "number" ? (
          <label id={labelId} htmlFor={inputId} className={LABEL}>
            Ton prono
          </label>
        ) : (
          <span id={labelId} className={LABEL}>
            Ton prono
          </span>
        )}
        <StatusChip state={state} />
      </div>
      {value}
      {type === "choice" && wrongAnswerMalus !== null ? (
        <p className="text-sm text-ink-2">Mauvaise réponse : {formatNumber(wrongAnswerMalus)} de malus</p>
      ) : null}
      {fieldError ? (
        <p id={errorId} className="text-sm font-medium text-hot">
          {fieldError}
        </p>
      ) : null}

      {validated ? (
        <>
          {mine?.joker ? (
            <p className="font-display text-[17px] font-extrabold uppercase tracking-[0.06em] text-accent-text">
              Joker ÷{JOKER_DIVISOR} posé
            </p>
          ) : null}
          <p className="text-[13px] text-muted">
            {mine?.validatedAt ? `Validé le ${formatDateTime(mine.validatedAt)}. ` : ""}
            Ton prono est définitif : seul l&apos;admin peut le déverrouiller, à ta demande, avant la clôture.
          </p>
        </>
      ) : (
        <>
          {jokersLeft !== null ? (
            <label className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-field border border-dashed border-line-strong px-3 py-2.5 text-[15px] text-ink-2 has-disabled:cursor-not-allowed">
              <input
                type="checkbox"
                checked={joker}
                onChange={(event) => toggleJoker(event.target.checked)}
                disabled={pending || !mine || (!joker && available === 0)}
                className="size-4.5 accent-accent"
              />
              <span className="font-display text-[17px] font-extrabold tracking-[0.06em] text-accent-text">JOKER ÷{JOKER_DIVISOR}</span>
              Divise ton malus par deux ·{" "}
              {mine ? `${formatCount(shownLeft, "restant")} cette saison` : "Enregistre d'abord ton prono."}
            </label>
          ) : null}
          <div className="flex gap-2.5">
            <Button type="submit" variant="secondary" size="lg" pending={pending} className="grow">
              Enregistrer
            </Button>
            <Button size="lg" pending={pending} onClick={askValidation} className="grow">
              Valider
            </Button>
          </div>
          <p className="text-[13px] text-muted">
            {mine ? `Enregistré le ${formatDateTime(mine.savedAt)}. ` : ""}
            Une fois validé, ton prono est définitif.
          </p>
        </>
      )}
      <FormMessage feedback={feedback} />

      <Dialog open={confirming !== null} onClose={() => setConfirming(null)} title="Valider ton prono ?">
        <p className="font-display text-[40px] leading-none font-extrabold tabular-nums">{confirming}</p>
        {joker ? (
          <p className="font-display text-[17px] font-extrabold uppercase tracking-[0.06em] text-accent-text">Joker posé</p>
        ) : null}
        <p className="text-[15px] text-ink-2">Une fois validé, tu ne pourras plus le modifier.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(null)}>
            Annuler
          </Button>
          <Button pending={pending} onClick={validate}>
            Valider définitivement
          </Button>
        </div>
      </Dialog>
    </form>
  );
}
