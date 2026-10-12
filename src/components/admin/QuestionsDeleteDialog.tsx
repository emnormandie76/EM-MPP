"use client";

import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { deleteQuestionsAction } from "@/lib/actions/questions";
import type { AdminDeletion } from "@/lib/data/admin";
import { formatCount } from "@/lib/format";
import type { QuestionStatus } from "@/lib/game/question-status";
import { DELETION_CONFIRMATION, isDeletionConfirmed } from "@/lib/validation/question";
import { erasedLines } from "./QuestionDeleteDialog";

export type DeletionOutcome = { deleted: number[]; failed: { id: number; message: string }[] };

/** Statuses of a question that can still be cancelled: published, and not cancelled yet. */
const CANCELLABLE: QuestionStatus[] = ["scheduled", "open", "closed", "resolved"];

/**
 * Series deletion from the list (v1.4, step 8e, §5.11, §8.2): the report of every question that can
 * go, the ones that will stay (proclaimed season), and the word SUPPRIMER to type when one of them has
 * predictions. Each question is deleted on its own; the list reports, question by question, what was
 * refused and why.
 */
export function QuestionsDeleteDialog({
  open,
  onClose,
  questions,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  questions: { id: number; status: QuestionStatus; deletion: AdminDeletion }[];
  onDone: (outcome: DeletionOutcome) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  const deletable = questions.filter(({ deletion }) => deletion.allowed);
  const staying = questions.length - deletable.length;
  const totals = {
    predictions: deletable.reduce((sum, { deletion }) => sum + deletion.predictions, 0),
    extensions: deletable.reduce((sum, { deletion }) => sum + deletion.extensions, 0),
    resultMessages: deletable.filter(({ deletion }) => deletion.resultMessage).length,
  };
  const lines = erasedLines(totals);
  const needsWord = totals.predictions > 0;
  const canCancelOne = deletable.some(({ status }) => CANCELLABLE.includes(status));

  function close() {
    setTyped("");
    setError(null);
    onClose();
  }

  function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deletable.length === 0 || (needsWord && !isDeletionConfirmed(typed))) return;
    startTransition(async () => {
      const result = await deleteQuestionsAction(
        questions.map(({ id }) => id),
        typed,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setTyped("");
      setError(null);
      onDone(result.data);
    });
  }

  return (
    <Dialog open={open} onClose={close} title={`Supprimer définitivement ${formatCount(questions.length, "question")} ?`}>
      <form onSubmit={remove} className="flex flex-col gap-4">
        <p className="text-[15px] text-ink-2">
          Ce n&apos;est pas réversible : ces questions disparaissent pour tout le monde, comme si elles n&apos;avaient jamais
          existé.
        </p>
        {deletable.length > 0 ? (
          <p className="text-[15px] font-semibold text-ink">
            {lines.length > 0 ? `Seront effacés : ${lines.join(", ")}.` : "Aucun prono n'a été fait sur ces questions."}
          </p>
        ) : null}
        {totals.predictions > 0 ? <p className="text-[15px] text-ink-2">Les jokers posés dessus sont rendus à leurs joueurs.</p> : null}
        {staying > 0 ? (
          <p className="text-[15px] text-ink-2">
            {staying === 1
              ? "1 question ne sera pas supprimée : elle appartient à une saison proclamée."
              : `${staying} questions ne seront pas supprimées : elles appartiennent à une saison proclamée.`}
          </p>
        ) : null}
        {canCancelOne ? (
          <p className="text-[15px] text-ink-2">
            Pour une vraie question dont la valeur ne sera pas connue, préfère « Annuler la question », depuis sa page : les
            joueurs la verront annulée.
          </p>
        ) : null}
        {needsWord ? (
          <Field
            name="confirmation"
            id="questions-deletion"
            label={`Tape ${DELETION_CONFIRMATION} pour confirmer`}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        ) : null}
        <FormMessage feedback={error ? { tone: "error", text: error } : null} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            Retour
          </Button>
          <Button
            type="submit"
            variant="danger"
            pending={pending}
            disabled={deletable.length === 0 || (needsWord && !isDeletionConfirmed(typed))}
          >
            Supprimer définitivement
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
