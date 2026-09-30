"use client";

import { LockOpen } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { unlockPredictionAction } from "@/lib/actions/predictions";

/** Unlocks a validated prediction, at the player's request, before the closing (§5.4). Traced. */
export function UnlockButton({ predictionId, playerName }: { predictionId: number; playerName: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="secondary"
        pending={pending}
        aria-label={`Déverrouiller le prono de ${playerName}`}
        onClick={() =>
          startTransition(async () => {
            const result = await unlockPredictionAction(predictionId);
            setError(result.ok ? null : result.message);
          })
        }
      >
        <LockOpen aria-hidden size={16} strokeWidth={2.4} />
        Déverrouiller
      </Button>
      <FormMessage feedback={error ? { tone: "error", text: error } : null} />
    </div>
  );
}
