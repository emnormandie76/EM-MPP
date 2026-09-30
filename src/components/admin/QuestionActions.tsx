"use client";

import { Ban, Copy, Trash } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormMessage } from "@/components/ui/FormMessage";
import { cancelQuestionAction, deleteQuestionAction, duplicateQuestionAction } from "@/lib/actions/questions";
import type { Result } from "@/lib/services/result";

const ICON = { "aria-hidden": true, size: 16, strokeWidth: 2.4 } as const;

/** Duplicate, cancel (with confirmation) and delete a draft (with confirmation) (§5.11, §8.3). */
export function QuestionActions({
  questionId,
  canCancel,
  canDelete,
}: {
  questionId: number;
  canCancel: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<null | "cancel" | "delete">(null);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  function run(action: () => Promise<Result<unknown>>, success?: string) {
    startTransition(async () => {
      const result = await action();
      setDialog(null);
      // An action that redirects (duplicate, delete) leaves the page instead of answering.
      if (!result) return;
      setFeedback(result.ok ? (success ? { tone: "success", text: success } : null) : { tone: "error", text: result.message });
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" pending={pending} onClick={() => run(() => duplicateQuestionAction(questionId))}>
          <Copy {...ICON} />
          Dupliquer
        </Button>
        {canCancel ? (
          <Button variant="danger" pending={pending} onClick={() => setDialog("cancel")}>
            <Ban {...ICON} />
            Annuler la question
          </Button>
        ) : null}
        {canDelete ? (
          <Button variant="danger" pending={pending} onClick={() => setDialog("delete")}>
            <Trash {...ICON} />
            Supprimer
          </Button>
        ) : null}
      </div>
      <FormMessage feedback={feedback} />

      <Dialog open={dialog === "cancel"} onClose={() => setDialog(null)} title="Annuler la question ?">
        <p className="text-[15px] text-ink-2">
          La question sort du calcul des points et les jokers posés dessus sont rendus. Les joueurs la verront comme
          annulée. Ce n&apos;est pas réversible.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>
            Retour
          </Button>
          <Button
            variant="danger"
            pending={pending}
            onClick={() => run(() => cancelQuestionAction(questionId), "Question annulée.")}
          >
            Annuler la question
          </Button>
        </div>
      </Dialog>

      <Dialog open={dialog === "delete"} onClose={() => setDialog(null)} title="Supprimer le brouillon ?">
        <p className="text-[15px] text-ink-2">Le brouillon et ses réponses seront effacés définitivement.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>
            Retour
          </Button>
          <Button variant="danger" pending={pending} onClick={() => run(() => deleteQuestionAction(questionId))}>
            Supprimer
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
