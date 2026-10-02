"use client";

import { CalendarClock } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { useStaleResult } from "@/components/ui/useStaleResult";
import { cancelQuestionExtensionAction, setQuestionExtensionAction } from "@/lib/actions/extensions";

// Extension of a question for an absent player, from the follow-up of the back office (§5.14,
// §8.2 ExtensionDialog): "Prolonger" for a player without a prediction; "Changer la date" and
// "Annuler la prolongation" (with a confirmation) while their extension runs.

const ICON = { "aria-hidden": true, size: 16, strokeWidth: 2.4 } as const;

type Props = {
  questionId: number;
  userId: string;
  playerName: string;
  /** "Prolonger": no prediction and no running extension. */
  canExtend: boolean;
  /** "Changer la date" and "Annuler la prolongation": a running extension. */
  canChange: boolean;
  /** Prefill of the deadline (`datetime-local`, Paris time): 48 h later, on the hour, or the current deadline. */
  defaultClosesAt: string;
};

export function ExtensionControls({ questionId, userId, playerName, canExtend, canChange, defaultClosesAt }: Props) {
  const [dialog, setDialog] = useState<"set" | "cancel" | null>(null);
  const [closesAt, setClosesAt] = useState(defaultClosesAt);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const zone = useRef<HTMLDivElement>(null);
  const stale = useStaleResult(result, zone);

  if (!canExtend && !canChange) return null;

  function open(kind: "set" | "cancel") {
    setError(null);
    setResult(null);
    setClosesAt(defaultClosesAt);
    setDialog(kind);
  }

  function save() {
    startTransition(async () => {
      const outcome = await setQuestionExtensionAction({ questionId, userId, closesAt });
      if (!outcome.ok) {
        setError(outcome.fieldErrors?.closesAt ?? outcome.message);
        return;
      }
      setDialog(null);
      setResult({ tone: "success", text: canChange ? "Date limite changée." : `Question prolongée pour ${playerName}.` });
    });
  }

  function cancel() {
    startTransition(async () => {
      const outcome = await cancelQuestionExtensionAction({ questionId, userId });
      setDialog(null);
      setResult(outcome.ok ? { tone: "success", text: "Prolongation annulée." } : { tone: "error", text: outcome.message });
    });
  }

  return (
    <div ref={zone} className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap gap-2">
        {canExtend ? (
          <Button variant="secondary" aria-label={`Prolonger pour ${playerName}`} onClick={() => open("set")}>
            <CalendarClock {...ICON} />
            Prolonger
          </Button>
        ) : null}
        {canChange ? (
          <>
            <Button variant="secondary" aria-label={`Changer la date limite de ${playerName}`} onClick={() => open("set")}>
              Changer la date
            </Button>
            <Button variant="danger" aria-label={`Annuler la prolongation de ${playerName}`} onClick={() => open("cancel")}>
              Annuler la prolongation
            </Button>
          </>
        ) : null}
      </div>
      <FormMessage feedback={result && !stale ? result : null} />

      <Dialog open={dialog === "set"} onClose={() => setDialog(null)} title={canChange ? `Changer la date de ${playerName}` : `Prolonger pour ${playerName}`}>
        <Field
          name="extensionClosesAt"
          id={`prolongation-${questionId}-${userId}`}
          type="datetime-local"
          label="Date limite (heure de Paris)"
          value={closesAt}
          onChange={(event) => setClosesAt(event.target.value)}
          error={error ?? undefined}
        />
        <p className="text-[15px] text-ink-2">
          Le joueur ne verra pas les pronos des autres avant d&apos;avoir répondu. Préviens-le toi-même.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>
            Annuler
          </Button>
          <Button pending={pending} onClick={save}>
            {canChange ? "Enregistrer" : "Prolonger"}
          </Button>
        </div>
      </Dialog>

      <Dialog open={dialog === "cancel"} onClose={() => setDialog(null)} title="Annuler la prolongation ?">
        <p className="text-[15px] text-ink-2">
          La question se referme pour {playerName}. S&apos;il a déjà un prono, il compte tel quel, comme validé.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>
            Retour
          </Button>
          <Button variant="danger" pending={pending} onClick={cancel}>
            Annuler la prolongation
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
