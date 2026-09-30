import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Icon, sentence and optional action, when a list is empty (§8.2). */
export function EmptyState({ icon: Icon, children, action }: { icon: LucideIcon; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong bg-surface px-5 py-8 text-center">
      <Icon aria-hidden size={28} strokeWidth={2.2} className="text-muted" />
      <p className="text-[15px] text-ink-2">{children}</p>
      {action}
    </div>
  );
}
