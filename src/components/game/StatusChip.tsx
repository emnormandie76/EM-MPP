import { Lock } from "lucide-react";
import type { PredictionState } from "@/lib/game/prediction-state";

// State of the player's prediction (§8.2): the text carries the information, the color only
// repeats it (§8.5).

export const PREDICTION_STATE_LABELS: Record<PredictionState, string> = {
  todo: "À faire",
  saved: "Enregistré",
  validated: "Validé",
};

const TONES: Record<PredictionState, string> = {
  todo: "border-[1.5px] border-hot text-hot",
  saved: "border-[1.5px] border-warn text-warn",
  validated: "bg-accent text-accent-ink",
};

export function StatusChip({ state, className }: { state: PredictionState; className?: string }) {
  return (
    <span
      className={[
        "inline-flex w-28 shrink-0 items-center justify-center gap-1.25 rounded-chip py-1.5 font-display text-[15px] leading-none font-extrabold uppercase tracking-[0.06em]",
        TONES[state],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {state === "validated" ? <Lock aria-hidden size={14} strokeWidth={2.6} /> : null}
      {PREDICTION_STATE_LABELS[state]}
    </span>
  );
}
