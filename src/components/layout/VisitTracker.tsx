"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { recordVisitAction } from "@/lib/actions/profile";

/**
 * Records each page seen, once it is displayed (§5.9): the "Nouveau" badges of a page are computed
 * before this write, so they do not go away before they have been seen.
 */
export function VisitTracker() {
  const pathname = usePathname();
  useEffect(() => {
    void recordVisitAction();
  }, [pathname]);
  return null;
}
