import Link from "next/link";
import { Fragment } from "react";

const LINKS = [
  { href: "/reglement", label: "Règlement" },
  { href: "/lots", label: "Lots" },
  { href: "/palmares", label: "Palmarès" },
] as const;

/** "Le Bon Chiffre · Saison 2026-2027", without the season while none has started (§8.2). */
export function Footer({ seasonLabel }: { seasonLabel: string | null }) {
  return (
    <footer className="mt-6 border-t border-line">
      <div className="mx-auto flex w-full max-w-page flex-wrap justify-between gap-2 px-4 py-5 text-[13px] text-muted lg:px-12">
        <span>Le Bon Chiffre{seasonLabel ? ` · Saison ${seasonLabel}` : ""}</span>
        <nav aria-label="Liens utiles" className="flex gap-1.5">
          {LINKS.map(({ href, label }, index) => (
            <Fragment key={href}>
              {index > 0 ? <span aria-hidden>·</span> : null}
              <Link href={href} className="hover:text-ink hover:underline">
                {label}
              </Link>
            </Fragment>
          ))}
        </nav>
      </div>
    </footer>
  );
}
