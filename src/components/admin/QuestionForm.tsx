"use client";

import { ArrowDown, ArrowUp, Plus, Trash } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, SelectField, TextAreaField } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { useFormAction } from "@/components/ui/useFormAction";
import type { FormState } from "@/lib/actions/form-state";
import { saveQuestionAction } from "@/lib/actions/questions";
import { COEFFICIENTS } from "@/lib/game/constants";
import {
  QUESTION_KIND_LABELS,
  QUESTION_KINDS,
  QUESTION_LIMITS,
  type QuestionKind,
  YES_NO_OPTIONS,
} from "@/lib/validation/question";

// Question form of the back office (architecture §8.3): creation and editing. A locked field
// (§5.11) is disabled, with its reason; disabled fields are not sent and keep their value.

export type QuestionFormValues = {
  kind: QuestionKind;
  categoryId: number | null;
  title: string;
  description: string;
  unit: string;
  options: string[];
  source: string;
  coefficient: number;
  helpBiUrl: string;
  helpLastYear: string;
  helpHint: string;
  /** `datetime-local` values, Paris time. */
  opensAt: string;
  closesAt: string;
  expectedResultAt: string;
};

/** Why a group of fields is locked, or null. */
export type QuestionFormLocks = {
  content: string | null;
  other: string | null;
  opensAt: string | null;
  closesAt: string | null;
  /** Shown under an editable closing date (for example: it can only move later). */
  closesHint: string | null;
};

const NO_LOCKS: QuestionFormLocks = { content: null, other: null, opensAt: null, closesAt: null, closesHint: null };

const SECTION_TITLE = "font-display text-[26px] font-extrabold uppercase leading-none";
const LEGEND = "font-display text-[15px] font-bold uppercase tracking-[0.08em] text-muted";
const TILE =
  "flex h-11 cursor-pointer items-center gap-2.5 rounded-field border border-line-strong px-3.5 text-[15px] font-semibold has-checked:border-2 has-checked:border-accent has-checked:bg-accent-soft has-disabled:cursor-not-allowed has-disabled:opacity-60";
const ICON = { "aria-hidden": true, size: 16, strokeWidth: 2.4 } as const;

function LockNote({ reason }: { reason: string | null }) {
  return reason ? <p className="rounded-field bg-raised px-3 py-2 text-sm text-ink-2">{reason}</p> : null;
}

type OptionRow = { key: number; label: string };

function OptionsEditor({ initial, disabled, error }: { initial: string[]; disabled: boolean; error?: string }) {
  const [rows, setRows] = useState<OptionRow[]>(() =>
    (initial.length > 0 ? initial : ["", ""]).map((label, key) => ({ key, label })),
  );
  const [nextKey, setNextKey] = useState(Math.max(initial.length, 2));
  const errorId = error ? "options-error" : undefined;

  function move(index: number, delta: number) {
    const next = [...rows];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setRows(next);
  }

  // min-w-0: a fieldset is otherwise as wide as its fields, wider than a phone screen.
  return (
    <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={errorId}>
      <legend className={`${LEGEND} mb-1.5`}>Réponses possibles</legend>
      <ol className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={row.key} className="flex flex-wrap items-center gap-1.5">
            <label htmlFor={`option-${row.key}`} className="w-full shrink-0 text-sm font-semibold text-ink-2 sm:w-24">
              Réponse {index + 1}
            </label>
            <input
              id={`option-${row.key}`}
              name="options"
              value={row.label}
              maxLength={QUESTION_LIMITS.optionLabelMax}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              onChange={(event) =>
                setRows(rows.map((item) => (item.key === row.key ? { ...item, label: event.target.value } : item)))
              }
              className="h-11 min-w-0 grow rounded-field border border-line-strong bg-surface px-3 text-base text-ink focus:border-accent disabled:cursor-not-allowed disabled:bg-raised disabled:text-muted"
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Monter la réponse ${index + 1}`}
              disabled={disabled || index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp {...ICON} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Descendre la réponse ${index + 1}`}
              disabled={disabled || index === rows.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown {...ICON} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Retirer la réponse ${index + 1}`}
              disabled={disabled}
              onClick={() => setRows(rows.filter((item) => item.key !== row.key))}
            >
              <Trash {...ICON} />
            </Button>
          </li>
        ))}
      </ol>
      <Button
        variant="secondary"
        className="self-start"
        disabled={disabled || rows.length >= QUESTION_LIMITS.optionsMax}
        onClick={() => {
          setRows([...rows, { key: nextKey, label: "" }]);
          setNextKey(nextKey + 1);
        }}
      >
        <Plus {...ICON} />
        Ajouter une réponse
      </Button>
      <p className="text-[13px] text-muted">
        De {QUESTION_LIMITS.optionsMin} à {QUESTION_LIMITS.optionsMax} réponses, toutes différentes.
      </p>
      {error ? (
        <p id={errorId} className="text-sm font-medium text-hot">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

export function QuestionForm({
  questionId,
  initial,
  categories,
  locks = NO_LOCKS,
  canPublish = false,
  readOnly = false,
  seasonNotice = null,
}: {
  /** Absent: creation of a draft. */
  questionId?: number;
  initial: QuestionFormValues;
  categories: { id: number; name: string; archived: boolean }[];
  locks?: QuestionFormLocks;
  /** A draft: "Publier" saves, then publishes. */
  canPublish?: boolean;
  /** A cancelled question: nothing can change. */
  readOnly?: boolean;
  /** Why the question cannot be published for lack of a season (§5.13), shown with the dates. */
  seasonNotice?: string | null;
}) {
  const [state, onSubmit, pending] = useFormAction<FormState>(saveQuestionAction, null);
  const [kind, setKind] = useState<QuestionKind>(initial.kind);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const contentLocked = readOnly || locks.content !== null;
  const otherLocked = readOnly || locks.other !== null;
  const isNumber = kind === "number" || kind === "priceIsRight";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {questionId !== undefined ? <input type="hidden" name="questionId" value={questionId} /> : null}

      <Card as="section" className="flex flex-col gap-4">
        <h2 className={SECTION_TITLE}>Question</h2>
        <LockNote reason={locks.content} />
        <fieldset className="flex min-w-0 flex-col gap-1.5" aria-describedby={errors.kind ? "kind-error" : undefined}>
          <legend className={`${LEGEND} mb-1.5`}>Type</legend>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {QUESTION_KINDS.map((value) => (
              <label key={value} className={TILE}>
                <input
                  type="radio"
                  name="kind"
                  value={value}
                  checked={kind === value}
                  disabled={contentLocked}
                  onChange={() => setKind(value)}
                  className="size-4 accent-accent"
                />
                {QUESTION_KIND_LABELS[value]}
              </label>
            ))}
          </div>
          {kind === "priceIsRight" ? (
            <p className="text-[13px] text-muted">Juste Prix : le plus proche sans dépasser la valeur réelle.</p>
          ) : null}
          {errors.kind ? (
            <p id="kind-error" className="text-sm font-medium text-hot">
              {errors.kind}
            </p>
          ) : null}
        </fieldset>

        <SelectField
          name="categoryId"
          label="Catégorie"
          defaultValue={initial.categoryId ?? ""}
          disabled={otherLocked}
          error={errors.categoryId}
          hint={categories.length === 0 ? "Crée d'abord une catégorie dans l'onglet Catégories." : undefined}
        >
          <option value="">Choisir…</option>
          {categories.map(({ id, name, archived }) => (
            <option key={id} value={id}>
              {archived ? `${name} (archivée)` : name}
            </option>
          ))}
        </SelectField>
        <Field
          name="title"
          label="Énoncé"
          hint="Une seule question, sans ambiguïté, avec la date. Par exemple : « Combien de candidatures au 31 mai 2027 ? »"
          maxLength={QUESTION_LIMITS.titleMax}
          defaultValue={initial.title}
          disabled={contentLocked}
          error={errors.title}
        />
        <TextAreaField
          name="description"
          label="Description (facultative)"
          hint="Le périmètre exact : filières, date, ce qui est exclu."
          maxLength={QUESTION_LIMITS.descriptionMax}
          defaultValue={initial.description}
          disabled={contentLocked}
          error={errors.description}
          className="[&_textarea]:min-h-24"
        />
        {isNumber ? (
          <Field
            name="unit"
            label="Unité"
            hint="Au pluriel, par exemple « candidatures »."
            maxLength={QUESTION_LIMITS.unitMax}
            defaultValue={initial.unit}
            disabled={contentLocked}
            error={errors.unit}
          />
        ) : kind === "yesNo" ? (
          <p className="text-[15px] text-ink-2">
            Réponses : <strong>{YES_NO_OPTIONS.join(" et ")}</strong>.
          </p>
        ) : (
          <OptionsEditor initial={initial.options} disabled={contentLocked} error={errors.options} />
        )}
        {errors.options && kind === "yesNo" ? <p className="text-sm font-medium text-hot">{errors.options}</p> : null}

        <fieldset className="flex min-w-0 flex-col gap-1.5">
          <legend className={`${LEGEND} mb-1.5`}>Coefficient</legend>
          <div className="flex flex-wrap gap-2">
            {COEFFICIENTS.map((value) => (
              <label key={value} className={`${TILE} w-24 justify-center`}>
                <input
                  type="radio"
                  name="coefficient"
                  value={value}
                  defaultChecked={initial.coefficient === value}
                  disabled={contentLocked}
                  className="size-4 accent-accent"
                />
                ×{value}
              </label>
            ))}
          </div>
          <p className="text-[13px] text-muted">Réserve le ×3 à une ou deux grosses questions.</p>
        </fieldset>
      </Card>

      <Card as="section" className="flex flex-col gap-4">
        <h2 className={SECTION_TITLE}>Source de la valeur réelle</h2>
        <Field
          name="source"
          label="Source"
          hint="Une source unique et incontestable, par exemple « Tableau BI Candidatures, total au 31/05 à minuit »."
          maxLength={QUESTION_LIMITS.sourceMax}
          defaultValue={initial.source}
          disabled={contentLocked}
          error={errors.source}
        />
      </Card>

      <Card as="section" className="flex flex-col gap-4">
        <h2 className={SECTION_TITLE}>Pour t&apos;aider</h2>
        <p className="text-[15px] text-ink-2">Facultatif. Ces champs restent modifiables après les premiers pronos.</p>
        <Field
          name="helpBiUrl"
          type="url"
          label="Lien vers le tableau BI"
          hint="Le tableau exact, pas l'accueil du BI."
          maxLength={QUESTION_LIMITS.helpBiUrlMax}
          defaultValue={initial.helpBiUrl}
          disabled={otherLocked}
          error={errors.helpBiUrl}
        />
        <Field
          name="helpLastYear"
          label="Valeur de l'an dernier"
          hint="Même périmètre et même date que la question."
          maxLength={QUESTION_LIMITS.helpLastYearMax}
          defaultValue={initial.helpLastYear}
          disabled={otherLocked}
          error={errors.helpLastYear}
        />
        <TextAreaField
          name="helpHint"
          label="Indice"
          hint="Il fait chercher sans donner la réponse."
          maxLength={QUESTION_LIMITS.helpHintMax}
          defaultValue={initial.helpHint}
          disabled={otherLocked}
          error={errors.helpHint}
          className="[&_textarea]:min-h-24"
        />
      </Card>

      <Card as="section" className="flex flex-col gap-4">
        <h2 className={SECTION_TITLE}>Dates</h2>
        <p className="text-[15px] text-ink-2">
          Toutes les dates sont en <strong>heure de Paris</strong>. La saison de la question est celle de sa clôture.
        </p>
        {seasonNotice ? (
          <p className="rounded-field bg-raised px-3 py-2 text-sm text-ink-2">
            {seasonNotice}{" "}
            <Link href="/admin/saisons" className="font-semibold text-accent-text hover:underline">
              Ouvrir Saisons et lots
            </Link>
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Field
            name="opensAt"
            type="datetime-local"
            label="Ouverture"
            defaultValue={initial.opensAt}
            disabled={readOnly || locks.opensAt !== null}
            hint={locks.opensAt ?? undefined}
            error={errors.opensAt}
          />
          <Field
            name="closesAt"
            type="datetime-local"
            label="Clôture"
            defaultValue={initial.closesAt}
            disabled={readOnly || locks.closesAt !== null}
            hint={locks.closesAt ?? locks.closesHint ?? undefined}
            error={errors.closesAt}
          />
          <Field
            name="expectedResultAt"
            type="datetime-local"
            label="Résultat prévu"
            defaultValue={initial.expectedResultAt}
            disabled={otherLocked}
            hint="Facultatif : quand tu pourras saisir la valeur réelle."
            error={errors.expectedResultAt}
          />
        </div>
      </Card>

      {readOnly ? null : (
        <div className="flex flex-col gap-3">
          <FormMessage feedback={state ? { tone: state.ok ? "success" : "error", text: state.message } : null} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" name="intent" value="save" variant={canPublish ? "secondary" : "primary"} pending={pending}>
              {questionId === undefined ? "Enregistrer le brouillon" : "Enregistrer"}
            </Button>
            {canPublish ? (
              <Button type="submit" name="intent" value="publish" pending={pending}>
                Publier
              </Button>
            ) : null}
          </div>
          {canPublish ? (
            <p className="text-[13px] text-muted">
              « Publier » enregistre, puis publie : la question est programmée jusqu&apos;à son ouverture, puis ouverte aux
              pronos.
            </p>
          ) : null}
        </div>
      )}
    </form>
  );
}
