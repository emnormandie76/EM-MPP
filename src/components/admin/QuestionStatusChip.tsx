import type { QuestionStatus } from "@/lib/game/question-status";

// Status of a question in the back office (§5.2): the text carries the information, the color
// only repeats it (§8.5).

export const QUESTION_STATUS_LABELS: Record<QuestionStatus, string> = {
  draft: "Brouillon",
  scheduled: "Programmée",
  open: "Ouverte",
  closed: "Clôturée",
  resolved: "Résolue",
  cancelled: "Annulée",
};

const TONES: Record<QuestionStatus, string> = {
  draft: "border-line-strong text-ink-2",
  scheduled: "border-accent-text text-accent-text",
  open: "border-accent bg-accent text-accent-ink",
  closed: "border-warn text-warn",
  resolved: "border-up text-up",
  cancelled: "border-line text-muted",
};

export function QuestionStatusChip({ status }: { status: QuestionStatus }) {
  return (
    <span
      className={[
        "inline-flex items-center justify-center rounded-pill border px-2.5 py-0.5 font-display text-[15px] font-extrabold uppercase tracking-[0.06em] whitespace-nowrap",
        TONES[status],
      ].join(" ")}
    >
      {QUESTION_STATUS_LABELS[status]}
    </span>
  );
}
