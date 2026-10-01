import "server-only";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { isAvatarKey, type AvatarKey } from "@/lib/avatars";
import type { Actor, Role } from "@/lib/services/result";
import { getAuth } from "./auth";

// Session reading and route protection (architecture §6.4).

export type Viewer = {
  id: string;
  name: string;
  role: Role;
  banned: boolean;
  avatar: AvatarKey;
  lastSeenAt: Date | null;
  previousVisitAt: Date | null;
};

/** The signed-in account, read once per request, or null. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Headers first: while `next build` tries to prerender a page, this stops it before the
  // database is opened (PGlite in end-to-end tests, a single process at a time).
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    role: user.role === "admin" ? "admin" : "player",
    banned: user.banned === true,
    avatar: isAvatarKey(user.avatar) ? user.avatar : "maillot-bleu-uni",
    lastSeenAt: user.lastSeenAt ?? null,
    previousVisitAt: user.previousVisitAt ?? null,
  };
});

/** Game pages: without a valid session (or with a disabled account), back to /connexion. */
export async function requireUser(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer || viewer.banned) redirect("/connexion");
  return viewer;
}

/** Back office: a player gets the 404 page, so the back office is not revealed. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireUser();
  if (viewer.role !== "admin") notFound();
  return viewer;
}

/**
 * Metadata of a back-office page. Next resolves a page's metadata even when its layout answers 404:
 * checking the role here keeps the page's title from a player (test report of 01/10/2026, R-02).
 */
export async function adminMetadata(title: string): Promise<Metadata> {
  await requireAdmin();
  return { title };
}

/** The actor of a Server Action, or null; the service decides what to refuse (§6.4). */
export async function getActor(): Promise<Actor | null> {
  const viewer = await getViewer();
  return viewer ? { id: viewer.id, role: viewer.role, banned: viewer.banned } : null;
}
