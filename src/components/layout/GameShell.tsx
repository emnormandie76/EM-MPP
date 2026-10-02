import type { ReactNode } from "react";
import { UnreadChatProvider } from "@/components/chat/UnreadChat";
import type { Viewer } from "@/lib/auth/session";
import { getUnreadChatCount } from "@/lib/data/chat";
import { getCurrentSeason } from "@/lib/data/content";
import { getDb } from "@/lib/db/client";
import { AppHeader } from "./AppHeader";
import { Footer } from "./Footer";
import { VisitTracker } from "./VisitTracker";

/**
 * Header, centred content and footer of every signed-in page. Rendered on each request (the
 * layouts read the session first): the footer follows the current season, which changes on the
 * start day of the next season without a deploy (§5.1). Every page seen counts as a visit (§5.9),
 * and updates the unread badge of the Chat tab (step 8d).
 */
export async function GameShell({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const db = getDb();
  const season = await getCurrentSeason(db, viewer, new Date());
  const unreadChat = await getUnreadChatCount(db, viewer);
  return (
    <UnreadChatProvider initial={unreadChat}>
      <AppHeader viewer={viewer} />
      <main className="mx-auto flex w-full max-w-page grow flex-col gap-6 px-4 pt-7 lg:px-12">{children}</main>
      <Footer seasonLabel={season?.label ?? null} />
      <VisitTracker />
    </UnreadChatProvider>
  );
}
