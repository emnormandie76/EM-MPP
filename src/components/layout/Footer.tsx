import Link from "next/link";
import { Fragment } from "react";
import { APP_NAME, canSeeRulesPage } from "@/lib/app";

const LINKS = [
  { href: "/reglement", label: "Règlement" },
  { href: "/lots", label: "Lots" },
  { href: "/palmares", label: "Palmarès" },
] as const;

/**
 * "Les petits pronos de la promo · Saison 2026-2027", without the season while none has started (§8.2).
 * Until step 10, the rules link shows to the admins only, as the rules tab (§6.4, point 6, v1.4).
 */
export function Footer({ seasonLabel, isAdmin }: { seasonLabel: string | null; isAdmin: boolean }) {
  const links = LINKS.filter(({ href }) => href !== "/reglement" || canSeeRulesPage(isAdmin));
  return (
    <footer className="mt-6 border-t border-line">
      <div className="mx-auto flex w-full max-w-page flex-wrap justify-between gap-2 px-4 py-5 text-[13px] text-muted lg:px-12">
        <span>
          {APP_NAME}
          {seasonLabel ? ` · Saison ${seasonLabel}` : ""}
        </span>
        <nav aria-label="Liens utiles" className="flex gap-1.5">
          {links.map(({ href, label }, index) => (
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
