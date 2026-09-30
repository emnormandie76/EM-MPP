import type { ReactNode } from "react";

type ChipTone = "neutral" | "accent" | "outline";

const TONES: Record<ChipTone, string> = {
  // Category label.
  neutral: "bg-chip text-ink-2 font-bold",
  // "Nouveau" label.
  accent: "bg-accent text-accent-ink font-extrabold",
  // Coefficient label ("COEF ×3").
  outline: "border border-line-strong text-ink font-extrabold",
};

export function Chip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: ChipTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-chip px-2 py-0.5 font-display text-sm uppercase tracking-[0.08em]",
        TONES[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
