"use client";

import { useEffect } from "react";
import { LogoMark } from "@/components/layout/Logo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Only the digest: the message may hold server details.
    console.error("UNHANDLED_ERROR", error.digest);
  }, [error]);

  return (
    <main className="flex grow items-center justify-center px-4 py-16">
      <Card className="flex w-full max-w-105 flex-col items-center gap-5 text-center">
        <LogoMark />
        <h1 className="font-display text-[32px] font-extrabold uppercase leading-tight">
          Une erreur est survenue. Réessaie.
        </h1>
        <Button size="lg" onClick={() => retry()}>
          Réessayer
        </Button>
      </Card>
    </main>
  );
}
