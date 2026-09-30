"use client";

import { Trophy } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { type FormFeedback, FormMessage } from "@/components/ui/FormMessage";
import { proclaimSeasonAction } from "@/lib/actions/content";

/**
 * "Proclamer le classement final" (§5.12, §8.3): active only when the season can be proclaimed,
 * otherwise the reason is shown; a confirmation recalls that it cannot be undone.
 */
export function ProclaimButton({
  seasonId,
  label,
  proclaimed,
  blocker,
  lastSeason,
}: {
  seasonId: number;
  label: string;
  proclaimed: boolean;
  /** Why the season cannot be proclaimed yet, or null. */
  blocker: string | null;
  /** The last season created goes on until the next one: nothing could be published in it afterwards. */
  lastSeason: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<FormFeedback>(null);
  const [pending, startTransition] = useTransition();
  const reasonId = `season-${seasonId}-proclaim-blocked`;

  function proclaim() {
    startTransition(async () => {
      const result = await proclaimSeasonAction(seasonId);
      setOpen(false);
      if (result) setFeedback({ tone: result.ok ? "success" : "error", text: result.message });
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {proclaimed ? null : (
        <>
          <Button
            className="self-start"
            disabled={blocker !== null}
            aria-describedby={blocker ? reasonId : undefined}
            onClick={() => {
              setFeedback(null);
              setOpen(true);
            }}
          >
            <Trophy aria-hidden size={16} strokeWidth={2.4} />
            Proclamer le classement final
          </Button>
          {blocker ? (
            <p id={reasonId} className="text-sm text-ink-2">
              {blocker}
            </p>
          ) : null}
        </>
      )}
      <FormMessage feedback={feedback} />

      <Dialog open={open} onClose={() => setOpen(false)} title="Proclamer le classement final ?">
        <p className="text-[15px] text-ink-2">
          Le classement de la saison {label} sera figé et publié au palmarès, avec les noms d&apos;aujourd&apos;hui. C&apos;est
          irréversible : une correction de résultat ne le changera plus, et les lots de la saison ne pourront plus être modifiés.
        </p>
        {lastSeason ? (
          <p className="text-[15px] font-semibold text-ink-2">
            La saison {label} est la dernière créée : après la proclamation, aucune question ne pourra plus y être publiée. Si des
            questions doivent encore clôturer, crée d&apos;abord la saison suivante.
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Retour
          </Button>
          <Button pending={pending} onClick={proclaim}>
            Proclamer
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
