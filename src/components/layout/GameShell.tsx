import type { ReactNode } from "react";
import type { Viewer } from "@/lib/auth/session";
import { getCurrentSeason } from "@/lib/data/content";
import { getDb } from "@/lib/db/client";
import { AppHeader } from "./AppHeader";
import { Footer } from "./Footer";

/**
 * Header, centred content and footer of every signed-in page. Rendered on each request (the
 * layouts read the session first): the footer follows the current season, which changes on the
 * start day of the next season without a deploy (§5.1).
 */
export async function GameShell({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const season = await getCurrentSeason(getDb(), viewer, new Date());
  return (
    <>
      <AppHeader viewer={viewer} />
      <main className="mx-auto flex w-full max-w-page grow flex-col gap-6 px-4 pt-7 lg:px-12">{children}</main>
      <Footer seasonLabel={season?.label ?? null} />
    </>
  );
}
