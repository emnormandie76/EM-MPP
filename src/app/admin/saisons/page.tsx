import type { Metadata } from "next";
import { PrizesEditor } from "@/components/admin/PrizesEditor";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { requireAdmin } from "@/lib/auth/session";
import { getSeasonsAdmin } from "@/lib/data/admin";
import { getDb } from "@/lib/db/client";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Saisons et lots" };

/** Seasons and their prizes (architecture §8.3). The proclamation of the final standings arrives in step 7. */
export default async function SeasonsAdminPage() {
  const viewer = await requireAdmin();
  const seasons = await getSeasonsAdmin(getDb(), viewer, new Date());

  return (
    <>
      <h1 className="font-display text-[44px] font-extrabold uppercase leading-none">Saisons et lots</h1>
      <p className="text-[15px] text-ink-2">
        Une saison va du 1er octobre au 30 septembre, heure de Paris, et commence toute seule. Une question appartient à la
        saison de sa date de clôture.
      </p>
      {seasons.map((season) => {
        // The end is exclusive (1 October 00:00): the last day is the day before.
        const lastDay = new Date(season.endsAt.getTime() - 1);
        return (
          <Card as="section" key={season.label} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-[26px] font-extrabold uppercase leading-none">Saison {season.label}</h2>
              {season.isCurrent ? <Chip tone="accent">En cours</Chip> : null}
            </div>
            <dl className="grid gap-x-8 gap-y-1 text-[15px] sm:grid-cols-[auto_1fr]">
              <dt className="text-muted">Dates</dt>
              <dd>
                du {formatDate(season.startsAt)} au {formatDate(lastDay)}
              </dd>
              <dt className="text-muted">Questions résolues</dt>
              <dd className="tabular-nums">
                {season.questionsResolved} / {season.questionsTotal}
              </dd>
              <dt className="text-muted">Classement final</dt>
              <dd>{season.proclaimedAt ? `Proclamé le ${formatDateTime(season.proclaimedAt)}` : "Pas encore proclamé"}</dd>
            </dl>
            <h3 className="font-display text-xl font-extrabold uppercase">Lots</h3>
            {season.proclaimedAt ? (
              <>
                <p className="text-[15px] text-ink-2">Le classement est proclamé : les lots ne changent plus.</p>
                {season.prizes.length === 0 ? (
                  <p className="text-[15px] text-ink-2">Aucun lot.</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-[15px]">
                    {season.prizes.map((prize) => (
                      <li key={prize.id}>
                        <strong>{prize.rankLabel}</strong> : {prize.description}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <PrizesEditor
                seasonLabel={season.label}
                initial={season.prizes.map(({ rankLabel, description }) => ({ rankLabel, description }))}
              />
            )}
          </Card>
        );
      })}
    </>
  );
}
