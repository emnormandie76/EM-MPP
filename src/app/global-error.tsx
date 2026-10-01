"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/layout/ErrorScreen";
import "./globals.css";

/**
 * An error in the root layout itself, which error.tsx does not cover: the same page, in a document
 * of its own (it replaces the root layout, its fonts and its metadata).
 */
export default function GlobalError({
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
    <html lang="fr">
      <body className="flex min-h-dvh flex-col bg-bg font-sans text-ink antialiased">
        <title>Erreur · Le Bon Chiffre</title>
        <meta name="robots" content="noindex, nofollow" />
        <ErrorScreen onRetry={() => retry()} />
      </body>
    </html>
  );
}
