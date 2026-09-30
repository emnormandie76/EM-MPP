import { Award } from "lucide-react";
import type { BadgeKey } from "@/lib/game/badges";

// Badges as capsules (§8.2): earned in accent with their count ("×2"), the others greyed out. The
// state is written for screen readers, not only shown by the color (§8.5).

export type BadgeChip = { key: BadgeKey; name: string; count: number };

const CAPSULE =
  "inline-flex items-center gap-1.5 rounded-chip border px-2.5 py-1 font-display text-[15px] font-extrabold uppercase tracking-[0.06em]";

export function BadgeList({ badges, label = "Badges" }: { badges: BadgeChip[]; label?: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {badges.map(({ key, name, count }) => {
        const earned = count > 0;
        return (
          <li key={key} className={`${CAPSULE} ${earned ? "border-accent-text text-accent-text" : "border-line text-muted"}`}>
            <Award aria-hidden size={14} strokeWidth={2.4} />
            {name}
            {count > 1 ? <span className="tabular-nums">×{count}</span> : null}
            <span className="sr-only">{earned ? (count > 1 ? `, obtenu ${count} fois` : ", obtenu") : ", pas encore obtenu"}</span>
          </li>
        );
      })}
    </ul>
  );
}
