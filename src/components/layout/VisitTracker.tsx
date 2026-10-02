"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useUnreadChat } from "@/components/chat/UnreadChat";
import { recordVisitAction } from "@/lib/actions/profile";

/**
 * Records each page seen, once it is displayed (§5.9): the "Nouveau" badges of a page are computed
 * before this write, so they do not go away before they have been seen. The answer updates the
 * unread badge of the Chat tab, which the layout, kept across navigations, would not (step 8d).
 */
export function VisitTracker() {
  const pathname = usePathname();
  const { setCount } = useUnreadChat();
  useEffect(() => {
    let current = true;
    recordVisitAction()
      .then((result) => {
        if (current && result) setCount(result.unreadChat);
      })
      .catch(() => {
        // A visit that could not be recorded changes nothing on the page.
      });
    return () => {
      current = false;
    };
  }, [pathname, setCount]);
  return null;
}
