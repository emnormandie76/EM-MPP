import { Check } from "lucide-react";
import type { ChoiceCrowdView } from "@/lib/data/results";
import { formatCount } from "@/lib/format";

// Answers of a choice question once closed (§5.7, §8.2): one bar per answer, with its percentage
// and count; the right answer is marked once resolved, and the viewer's choice is named. Texts
// carry the information, the bars only repeat it (§8.5).

export function ChoiceDistribution({ crowd }: { crowd: ChoiceCrowdView }) {
  return (
    <ul aria-label="Répartition des réponses" className="flex flex-col gap-3">
      {crowd.shares.map((share) => (
        <li key={share.optionId} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="flex flex-wrap items-center gap-x-2 text-[15px] font-semibold">
              {share.label}
              {share.isAnswer ? (
                <span className="inline-flex items-center gap-1 font-display text-sm font-extrabold uppercase tracking-[0.06em] text-up">
                  <Check aria-hidden size={14} strokeWidth={2.6} />
                  Bonne réponse
                </span>
              ) : null}
              {share.isMine ? <span className="text-sm font-normal text-accent-text">(ton choix)</span> : null}
            </span>
            <span className="font-display text-lg font-bold tabular-nums">
              {share.percent}&nbsp;%
              <span className="font-sans text-sm font-normal text-muted"> · {formatCount(share.count, "prono")}</span>
            </span>
          </div>
          <div aria-hidden className="h-2.5 overflow-hidden rounded-pill bg-line">
            <div
              className={`h-full rounded-pill ${share.isAnswer ? "bg-up" : share.isMine ? "bg-accent" : "bg-dots"}`}
              style={{ width: `${share.percent}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
