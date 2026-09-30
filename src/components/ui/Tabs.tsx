import Link from "next/link";

export type TabItem = { href: string; label: string; count?: number; current: boolean };

/** Tabs as links, with their counter: "À FAIRE (3)" (§8.2). */
export function Tabs({ label, items }: { label: string; items: TabItem[] }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1.5 border-b border-line pb-2">
      {items.map(({ href, label: text, count, current }) => (
        <Link
          key={href}
          href={href}
          aria-current={current ? "page" : undefined}
          className={[
            "rounded-button px-3.5 py-1.75 font-display text-[17px] font-bold uppercase tracking-[0.06em] whitespace-nowrap",
            current ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-chip",
          ].join(" ")}
        >
          {text}
          {count === undefined ? null : <span className="tabular-nums"> ({count})</span>}
        </Link>
      ))}
    </nav>
  );
}
