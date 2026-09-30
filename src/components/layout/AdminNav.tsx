"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Back-office sub-navigation (architecture §8.2). Questions, categories, seasons and
// announcements arrive in step 5.
const LINKS = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/joueurs", label: "Joueurs" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Back-office" className="flex flex-wrap gap-1.5 border-b border-line pb-3">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={[
              "rounded-button px-3 py-1.5 font-display text-base font-bold uppercase tracking-[0.06em]",
              active ? "bg-ink text-bg" : "text-ink-2 hover:bg-chip",
            ].join(" ")}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
