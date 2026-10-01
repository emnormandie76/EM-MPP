"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/layout/ErrorScreen";

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

  return <ErrorScreen onRetry={() => retry()} />;
}
