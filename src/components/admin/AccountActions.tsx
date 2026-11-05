"use client";

import { UserX } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { anonymizeUserAction } from "@/lib/actions/players";

export type AccountSummary = { id: string; name: string };

const ICON = { "aria-hidden": true, size: 16, strokeWidth: 2.4 } as const;

/** The one action left on an account (§6.3): the accesses and the roles are managed on the portal. */
export function AccountActions({ account }: { account: AccountSummary }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function anonymize() {
    startTransition(async () => {
      const result = await anonymizeUserAction(account.id);
      setError(result.ok ? null : result.message);
      setOpen(false);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        <Button variant="danger" pending={pending} onClick={() => setOpen(true)}>
          <UserX {...ICON} />
          Anonymiser
        </Button>
      </div>
      <p aria-live="polite" className="text-sm font-medium text-hot">
        {error}
      </p>

      <Dialog open={open} onClose={() => setOpen(false)} title={`Anonymiser ${account.name} ?`}>
        <p className="text-[15px] text-ink-2">
          Le nom, l&apos;adresse et l&apos;avatar seront effacés et le compte sera désactivé, sans retour possible. Les
          pronos sont conservés sous le nom « Ancien joueur », pour que le classement des autres reste juste. L&apos;accès,
          lui, se retire sur le portail.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button variant="danger" pending={pending} onClick={anonymize}>
            Anonymiser
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
