"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { deleteQuestionAction } from "@/lib/actions/questions";
import { formatCount } from "@/lib/format";
import type { DeletionReport } from "@/lib/services/questions";
import { DELETION_CONFIRMATION, isDeletionConfirmed } from "@/lib/validation/question";

/**
 * "3 pronos, 1 prolongation, le message de résultat du chat": the lines that are not zero, for one
 * question or for a series (`QuestionsDeleteDialog`).
 */
export function erasedLines({ predictions, extensions, resultMessages }: { predictions: number; extensions: number; resultMessages: number }): string[] {
  return [
    predictions > 0 ? formatCount(predictions, "prono") : null,
    extensions > 0 ? formatCount(extensions, "prolongation") : null,
    resultMessages === 1 ? "le message de résultat du chat" : null,
    resultMessages > 1 ? `${resultMessages} messages de résultat du chat` : null,
  ].filter((line) => line !== null);
}

/**
 * Deletion of a question for good (v1.4, §5.11, §8.2): what goes with it, without any count of
 * jokers (§6.6), and the word SUPPRIMER to type when it has predictions. A refusal of the server
 * shows in the dialog, which stays open; when a prediction arrived since the page was shown, the
 * word is asked for and the report is read again.
 */
export function QuestionDeleteDialog({
  open,
  onClose,
  questionId,
  canCancel,
  report,
}: {
  open: boolean;
  onClose: () => void;
  questionId: number;
  /**
   * Only a published question can still be cancelled: for a draft, which the players never saw, or
   * for a question already cancelled, the advice to cancel would make no sense.
   */
  canCancel: boolean;
  report: DeletionReport;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [wordAsked, setWordAsked] = useState(false);
  const needsWord = report.predictions > 0 || wordAsked;
  const lines = erasedLines({ ...report, resultMessages: report.resultMessage ? 1 : 0 });
  const fieldId = `question-${questionId}-deletion`;

  function close() {
    setTyped("");
    setError(null);
    onClose();
  }

  function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (needsWord && !isDeletionConfirmed(typed)) return;
    startTransition(async () => {
      const result = await deleteQuestionAction(questionId, typed);
      // Deleted: the action goes back to the list instead of answering.
      if (!result || result.ok) return;
      setError(result.message);
      if (result.code === "CONFIRMATION_REQUIRED") {
        setWordAsked(true);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onClose={close} title="Supprimer définitivement la question ?">
      <form onSubmit={remove} className="flex flex-col gap-4">
        <p className="text-[15px] text-ink-2">
          Ce n&apos;est pas réversible : la question disparaît pour tout le monde, comme si elle n&apos;avait jamais existé.
        </p>
        <p className="text-[15px] font-semibold text-ink">
          {lines.length > 0 ? `Seront effacés : ${lines.join(", ")}.` : "Aucun prono n'a été fait sur cette question."}
        </p>
        {report.predictions > 0 ? <p className="text-[15px] text-ink-2">Les jokers posés dessus sont rendus à leurs joueurs.</p> : null}
        {canCancel ? (
          <p className="text-[15px] text-ink-2">
            Pour une vraie question dont la valeur ne sera pas connue, préfère « Annuler la question » : les joueurs la verront
            annulée.
          </p>
        ) : null}
        {needsWord ? (
          <Field
            name="confirmation"
            id={fieldId}
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
          <Button type="submit" variant="danger" pending={pending} disabled={needsWord && !isDeletionConfirmed(typed)}>
            Supprimer définitivement
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
