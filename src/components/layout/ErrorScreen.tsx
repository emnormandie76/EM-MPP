import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LogoMark } from "./Logo";

/** The error page (architecture §8.3), shared by error.tsx and global-error.tsx. */
export function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex grow items-center justify-center px-4 py-16">
      <Card className="flex w-full max-w-105 flex-col items-center gap-5 text-center">
        <LogoMark />
        <h1 className="font-display text-[32px] font-extrabold uppercase leading-tight">Une erreur est survenue. Réessaie.</h1>
        <Button size="lg" onClick={onRetry}>
          Réessayer
        </Button>
      </Card>
    </main>
  );
}
