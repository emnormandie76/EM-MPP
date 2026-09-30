import { connection } from "next/server";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { seasonLabelFor } from "@/lib/game/time";

export default async function GameLayout({ children }: LayoutProps<"/">) {
  // Rendered on each request: the season changes on 1 October at 00:00 (Paris) without a deploy.
  await connection();
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-page grow flex-col gap-6 px-4 pt-7 lg:px-12">
        {children}
      </main>
      <Footer seasonLabel={seasonLabelFor(new Date())} />
    </>
  );
}
