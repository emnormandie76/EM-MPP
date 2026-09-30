"use client";

import { ChevronDown, LogOut, Menu, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/avatars/Avatar";
import { signOutAction } from "@/lib/actions/auth";
import type { AvatarKey } from "@/lib/avatars";
import { useDetailsMenu } from "./useDetailsMenu";

const LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/pronos", label: "Mes pronos" },
  { href: "/classement", label: "Classement" },
  { href: "/palmares", label: "Palmarès" },
  { href: "/reglement", label: "Règlement" },
] as const;

export type HeaderViewer = { name: string; avatar: AvatarKey; isAdmin: boolean };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const LINK_CLASSES =
  "rounded-button px-3.5 py-1.75 font-display text-[17px] font-bold uppercase tracking-[0.06em] whitespace-nowrap";
const MENU_ITEM_CLASSES =
  "flex w-full items-center gap-2 rounded-button px-3.5 py-2 text-left text-[15px] font-semibold text-ink-2 hover:bg-chip";

function NavLinks({ pathname }: { pathname: string }) {
  return LINKS.map(({ href, label }) => {
    const active = isActive(pathname, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={[LINK_CLASSES, active ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-chip"].join(" ")}
      >
        {label}
      </Link>
    );
  });
}

/** "Mon profil" and "Se déconnecter", shared by the account menu and the mobile menu. */
function AccountItems() {
  return (
    <>
      <Link href="/profil" className={MENU_ITEM_CLASSES}>
        <UserRound aria-hidden size={18} strokeWidth={2.2} />
        Mon profil
      </Link>
      <form action={signOutAction}>
        <button type="submit" className={MENU_ITEM_CLASSES}>
          <LogOut aria-hidden size={18} strokeWidth={2.2} />
          Se déconnecter
        </button>
      </form>
    </>
  );
}

function AdminLink({ pathname, className }: { pathname: string; className: string }) {
  const active = isActive(pathname, "/admin");
  return (
    <Link
      href="/admin"
      aria-current={active ? "page" : undefined}
      className={[className, active ? "text-accent-text" : "text-muted hover:text-ink"].join(" ")}
    >
      Admin
    </Link>
  );
}

/** Account menu (from 1 024 px): avatar and name, then profile and sign-out. */
function AccountMenu({ viewer }: { viewer: HeaderViewer }) {
  const menuRef = useDetailsMenu();
  return (
    <details ref={menuRef} className="relative">
      <summary
        aria-label={`Mon compte : ${viewer.name}`}
        className="flex cursor-pointer list-none items-center gap-2.5 rounded-button py-1 pr-1 pl-1 hover:bg-chip [&::-webkit-details-marker]:hidden"
      >
        <Avatar avatar={viewer.avatar} name={viewer.name} size={36} ring />
        <span className="max-w-40 truncate text-[15px] font-semibold">{viewer.name}</span>
        <ChevronDown aria-hidden size={16} strokeWidth={2.4} className="text-muted" />
      </summary>
      <div className="absolute right-0 top-full z-10 mt-2 flex w-56 flex-col gap-1 rounded-card border border-line bg-surface p-2 shadow-lg">
        <AccountItems />
      </div>
    </details>
  );
}

/**
 * Header navigation. From 1 024 px: the links, the admin link and the account menu. Below: a
 * single "Menu" disclosure with all of them.
 */
export function MainNav({ viewer }: { viewer: HeaderViewer }) {
  const pathname = usePathname();
  const menuRef = useDetailsMenu();

  return (
    <>
      <nav aria-label="Navigation principale" className="hidden grow items-center gap-1.5 lg:flex">
        <NavLinks pathname={pathname} />
      </nav>
      <div className="hidden items-center gap-5 lg:flex">
        {viewer.isAdmin ? (
          <AdminLink
            pathname={pathname}
            className="font-display text-base font-bold uppercase tracking-[0.06em]"
          />
        ) : null}
        <AccountMenu viewer={viewer} />
      </div>

      <details ref={menuRef} className="relative ml-auto lg:hidden">
        <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-button border border-line-strong px-3 font-display text-[17px] font-bold uppercase tracking-[0.06em] text-ink-2 hover:bg-chip [&::-webkit-details-marker]:hidden">
          <Menu aria-hidden size={20} strokeWidth={2.2} />
          Menu
        </summary>
        <div className="absolute right-0 top-full z-10 mt-2 flex w-60 flex-col gap-1 rounded-card border border-line bg-surface p-2 shadow-lg">
          <nav aria-label="Navigation principale" className="flex flex-col gap-1">
            <NavLinks pathname={pathname} />
            {viewer.isAdmin ? <AdminLink pathname={pathname} className={LINK_CLASSES} /> : null}
          </nav>
          <div className="mt-1 flex flex-col gap-1 border-t border-line pt-2">
            <div className="flex items-center gap-2.5 px-3.5 py-1.5">
              <Avatar avatar={viewer.avatar} name={viewer.name} size={32} ring />
              <span className="truncate text-[15px] font-semibold">{viewer.name}</span>
            </div>
            <AccountItems />
          </div>
        </div>
      </details>
    </>
  );
}
