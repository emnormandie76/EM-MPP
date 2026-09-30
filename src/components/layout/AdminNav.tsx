"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Back-office sub-navigation (architecture §8.2).
const LINKS = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/joueurs", label: "Joueurs" },
  { href: "/admin/categories", label: "Catégories" },
  { href: "/admin/saisons", label: "Saisons et lots" },
  { href: "/admin/annonces", label: "Annonces" },
] as const;

/** The dashboard is only active on /admin itself; the other links also cover their sub-pages. */
function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Back-office" className="flex flex-wrap gap-1.5 border-b border-line pb-3">
      {LINKS.map(({ href, label }) => {
        const active = isActive(pathname, href);
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
