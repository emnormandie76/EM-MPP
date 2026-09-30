"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { removeAllowedEmailAction } from "@/lib/actions/players";

/** "Retirer", for an address without an account. */
export function RemoveAllowedEmailButton({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="ghost"
        pending={pending}
        aria-label={`Retirer ${email}`}
        onClick={() =>
          startTransition(async () => {
            const result = await removeAllowedEmailAction(email);
            setError(result.ok ? null : result.message);
          })
        }
      >
        Retirer
      </Button>
      <p aria-live="polite" className="text-sm font-medium text-hot">
        {error}
      </p>
    </div>
  );
}
