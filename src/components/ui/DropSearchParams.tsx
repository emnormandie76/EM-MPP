"use client";

import { useEffect } from "react";

/**
 * Removes one-time notices (`?creee=1`) from the address once shown. Without this, the page kept
 * « Question créée en brouillon. » after the question was published: the refresh that follows an
 * action reads the same address (test report of 01/10/2026, R-04).
 */
export function DropSearchParams({ names }: { names: string[] }) {
  const key = names.join(",");
  useEffect(() => {
    const url = new URL(window.location.href);
    const present = key.split(",").filter((name) => url.searchParams.has(name));
    if (present.length === 0) return;
    for (const name of present) url.searchParams.delete(name);
    // Next.js keeps its router in step with replaceState (usePathname, useSearchParams, refresh).
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [key]);
  return null;
}
