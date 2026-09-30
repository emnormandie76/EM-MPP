"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/pronos", label: "Mes pronos" },
  { href: "/classement", label: "Classement" },
  { href: "/palmares", label: "Palmarès" },
  { href: "/reglement", label: "Règlement" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname }: { pathname: string }) {
  return LINKS.map(({ href, label }) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={[
          "rounded-button px-3.5 py-1.75 font-display text-[17px] font-bold uppercase tracking-[0.06em] whitespace-nowrap",
          active ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-chip",
        ].join(" ")}
      >
        {label}
      </Link>
    );
  });
}

/** Main navigation: a row of links from 1 024 px, a "Menu" disclosure below. */
export function MainNav() {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDetailsElement>(null);

  // Close the mobile menu after a navigation.
  useEffect(() => {
    menuRef.current?.removeAttribute("open");
  }, [pathname]);

  return (
    <>
      <nav aria-label="Navigation principale" className="hidden grow items-center gap-1.5 lg:flex">
        <NavLinks pathname={pathname} />
      </nav>
      <details ref={menuRef} className="relative ml-auto lg:hidden">
        <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-button border border-line-strong px-3 font-display text-[17px] font-bold uppercase tracking-[0.06em] text-ink-2 hover:bg-chip [&::-webkit-details-marker]:hidden">
          <Menu aria-hidden size={20} strokeWidth={2.2} />
          Menu
        </summary>
        <nav
          aria-label="Navigation principale"
          className="absolute right-0 top-full z-10 mt-2 flex w-56 flex-col gap-1 rounded-card border border-line bg-surface p-2 shadow-lg"
        >
          <NavLinks pathname={pathname} />
        </nav>
      </details>
    </>
  );
}
