import type { ReactNode } from "react";
import type { Viewer } from "@/lib/auth/session";
import { seasonLabelFor } from "@/lib/game/time";
import { AppHeader } from "./AppHeader";
import { Footer } from "./Footer";

/**
 * Header, centred content and footer of every signed-in page. Rendered on each request (the
 * layouts read the session): the season changes on 1 October at 00:00 (Paris) without a deploy.
 */
export function GameShell({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  return (
    <>
      <AppHeader viewer={viewer} />
      <main className="mx-auto flex w-full max-w-page grow flex-col gap-6 px-4 pt-7 lg:px-12">{children}</main>
      <Footer seasonLabel={seasonLabelFor(new Date())} />
    </>
  );
}
