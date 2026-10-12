"use client";

import { Ban, Copy, Trash } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { QuestionDeleteDialog } from "@/components/admin/QuestionDeleteDialog";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { FormMessage } from "@/components/ui/FormMessage";
import { useStaleResult } from "@/components/ui/useStaleResult";
import { cancelQuestionAction, duplicateQuestionAction } from "@/lib/actions/questions";
import type { DeletionReport } from "@/lib/services/questions";
import type { Result } from "@/lib/services/result";

const ICON = { "aria-hidden": true, size: 16, strokeWidth: 2.4 } as const;

/**
 * Duplicate, cancel (with confirmation) and delete for good (v1.4, `QuestionDeleteDialog`) (§5.11,
 * §8.3). « Supprimer » shows on every question; it is disabled, with its reason, in a proclaimed season.
 */
export function QuestionActions({
  questionId,
  canCancel,
  deletion,
}: {
  questionId: number;
  canCancel: boolean;
  deletion: DeletionReport & { allowed: boolean; reason: string | null };
}) {
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<null | "cancel" | "delete">(null);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const zone = useRef<HTMLDivElement>(null);
  const stale = useStaleResult(feedback, zone);
  const deleteReasonId = `question-${questionId}-delete-blocked`;

  function run(action: () => Promise<Result<unknown>>, success?: string) {
    startTransition(async () => {
      const result = await action();
      setDialog(null);
      // An action that redirects (duplicate) leaves the page instead of answering.
      if (!result) return;
      setFeedback(result.ok ? (success ? { tone: "success", text: success } : null) : { tone: "error", text: result.message });
    });
  }

  return (
    <div ref={zone} className="flex flex-col gap-2">
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
        <Button
          variant="danger"
          pending={pending}
          disabled={!deletion.allowed}
          aria-describedby={deletion.reason ? deleteReasonId : undefined}
          onClick={() => setDialog("delete")}
        >
          <Trash {...ICON} />
          Supprimer
        </Button>
      </div>
      {deletion.reason ? (
        <p id={deleteReasonId} className="text-sm text-ink-2">
          {deletion.reason}
        </p>
      ) : null}
      <FormMessage feedback={stale ? null : feedback} />

      <Dialog open={dialog === "cancel"} onClose={() => setDialog(null)} title="Annuler la question ?">
        <p className="text-[15px] text-ink-2">
          La question sort du calcul des malus et les jokers posés dessus sont rendus. Les joueurs la verront comme
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

      <QuestionDeleteDialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        questionId={questionId}
        canCancel={canCancel}
        report={deletion}
      />
    </div>
  );
}
