import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";

// Step 3 replaces this with seasonLabelFor(now) (architecture §5.1).
const PROVISIONAL_SEASON_LABEL = "2026-2027";

export default function GameLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-page grow flex-col gap-6 px-4 pt-7 lg:px-12">
        {children}
      </main>
      <Footer seasonLabel={PROVISIONAL_SEASON_LABEL} />
    </>
  );
}
