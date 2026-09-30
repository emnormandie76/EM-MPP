import type { ReactNode } from "react";

/** A figure of the welcome row (§8.2): label, big figure, and a line below. Inside a `<dl>`. */
export function StatTile({
  label,
  children,
  sub,
  valueClassName,
  subClassName = "text-muted",
}: {
  label: string;
  children: ReactNode;
  sub: ReactNode;
  valueClassName?: string;
  subClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-card border border-line bg-surface px-5.5 py-4.5 lg:w-50">
      <dt className="font-display text-[15px] font-bold uppercase tracking-[0.08em] text-muted">{label}</dt>
      <dd className={["font-display text-[60px] leading-none font-extrabold tabular-nums", valueClassName].filter(Boolean).join(" ")}>
        {children}
      </dd>
      <dd className={`text-sm ${subClassName}`}>{sub}</dd>
    </div>
  );
}
