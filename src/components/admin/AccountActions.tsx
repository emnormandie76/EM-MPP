"use client";

import { Ban, Check, Copy, KeyRound, RotateCcw, ShieldCheck, UserRound, UserX } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import {
  anonymizeUserAction,
  disableUserAction,
  enableUserAction,
  setRoleAction,
  setTemporaryPasswordAction,
} from "@/lib/actions/players";
import type { Result } from "@/lib/services/result";

export type AccountSummary = { id: string; name: string; role: "player" | "admin"; banned: boolean };

type OpenDialog = null | "confirm-password" | "confirm-anonymize" | { password: string };

const ICON = { "aria-hidden": true, size: 16, strokeWidth: 2.4 } as const;

/** Actions on one account (§6.3): role, disable or enable, temporary password, anonymize. */
export function AccountActions({ account }: { account: AccountSummary }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [copied, setCopied] = useState(false);

  function run<T>(action: () => Promise<Result<T>>, onSuccess?: (data: T) => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setError(null);
        onSuccess?.(result.data);
      } else {
        setError(result.message);
        setDialog(null);
      }
    });
  }

  async function copy(password: string) {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {account.role === "admin" ? (
          <Button variant="secondary" pending={pending} onClick={() => run(() => setRoleAction(account.id, "player"))}>
            <UserRound {...ICON} />
            Passer joueur
          </Button>
        ) : (
          <Button variant="secondary" pending={pending} onClick={() => run(() => setRoleAction(account.id, "admin"))}>
            <ShieldCheck {...ICON} />
            Passer admin
          </Button>
        )}
        {account.banned ? (
          <Button variant="secondary" pending={pending} onClick={() => run(() => enableUserAction(account.id))}>
            <RotateCcw {...ICON} />
            Réactiver
          </Button>
        ) : (
          <Button variant="danger" pending={pending} onClick={() => run(() => disableUserAction(account.id))}>
            <Ban {...ICON} />
            Désactiver
          </Button>
        )}
        <Button variant="secondary" pending={pending} onClick={() => setDialog("confirm-password")}>
          <KeyRound {...ICON} />
          Mot de passe provisoire
        </Button>
        <Button variant="danger" pending={pending} onClick={() => setDialog("confirm-anonymize")}>
          <UserX {...ICON} />
          Anonymiser
        </Button>
      </div>
      <p aria-live="polite" className="text-sm font-medium text-hot">
        {error}
      </p>

      <Dialog open={dialog === "confirm-password"} onClose={() => setDialog(null)} title="Mot de passe provisoire">
        <p className="text-[15px] text-ink-2">
          {account.name} recevra un nouveau mot de passe, que tu lui transmettras. L&apos;ancien ne fonctionnera plus et
          ses sessions seront fermées.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>
            Annuler
          </Button>
          <Button
            pending={pending}
            onClick={() =>
              run(
                () => setTemporaryPasswordAction(account.id),
                ({ password }) => {
                  setCopied(false);
                  setDialog({ password });
                },
              )
            }
          >
            Créer le mot de passe
          </Button>
        </div>
      </Dialog>

      <Dialog open={typeof dialog === "object" && dialog !== null} onClose={() => setDialog(null)} title="Mot de passe provisoire">
        {typeof dialog === "object" && dialog !== null ? (
          <>
            <p className="text-[15px] text-ink-2">
              Transmets ce mot de passe à {account.name}. Il ne sera plus affiché ensuite. {account.name} pourra le
              changer dans son profil.
            </p>
            <p
              data-testid="temporary-password"
              className="select-all rounded-field border border-line bg-bg px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.12em]"
            >
              {dialog.password}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <p aria-live="polite" className="mr-auto text-sm font-medium text-up">
                {copied ? "Copié." : null}
              </p>
              <Button variant="secondary" onClick={() => copy(dialog.password)}>
                {copied ? <Check {...ICON} /> : <Copy {...ICON} />}
                Copier
              </Button>
              <Button onClick={() => setDialog(null)}>Terminé</Button>
            </div>
          </>
        ) : null}
      </Dialog>

      <Dialog open={dialog === "confirm-anonymize"} onClose={() => setDialog(null)} title={`Anonymiser ${account.name} ?`}>
        <p className="text-[15px] text-ink-2">
          Le nom, l&apos;adresse et l&apos;avatar seront effacés et le compte sera désactivé, sans retour possible. Les
          pronos sont conservés sous le nom « Ancien joueur », pour que le classement des autres reste juste.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>
            Annuler
          </Button>
          <Button variant="danger" pending={pending} onClick={() => run(() => anonymizeUserAction(account.id), () => setDialog(null))}>
            Anonymiser
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
