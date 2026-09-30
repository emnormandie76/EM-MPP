import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SeasonTabs, seasonParam } from "@/components/game/SeasonTabs";
import { StandingsFullTable } from "@/components/game/StandingsTable";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireUser } from "@/lib/auth/session";
import { getAvailableSeasons, getStandings } from "@/lib/data/standings";
import { getDb } from "@/lib/db/client";
import { formatCount } from "@/lib/format";

export const metadata: Metadata = { title: "Classement" };

/**
 * Standings of a season (architecture §5.6, §8.3): the season shown by default, or the one picked
 * (`?saison=<id>`), recomputed on every visit, with the movement since the previous result.
 */
export default async function StandingsPage({ searchParams }: PageProps<"/classement">) {
  const viewer = await requireUser();
  const { saison } = await searchParams;
  const db = getDb();
  const seasons = await getAvailableSeasons(db);
  const standings = await getStandings(db, viewer, { seasonId: seasonParam(saison, seasons) }, new Date());
  const { season, resolvedCount, rows } = standings;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-[44px] leading-none font-extrabold uppercase">Classement</h1>
        {season ? <p className="text-[15px] text-muted">Saison {season.label}</p> : null}
      </div>
      <SeasonTabs seasons={seasons} currentId={season?.id ?? null} basePath="/classement" />

      {!season || resolvedCount === 0 || rows.length === 0 ? (
        <EmptyState icon={Trophy}>Le classement démarre au premier résultat.</EmptyState>
      ) : (
        <Card as="section" className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Après {formatCount(resolvedCount, "question résolue", "questions résolues")}. Les flèches montrent l&apos;évolution
            depuis le résultat précédent.
          </p>
          <StandingsFullTable rows={rows} caption={`Classement de la saison ${season.label}`} seasonId={season.id} />
        </Card>
      )}

      <p className="text-[15px] text-ink-2">Départage : nombre de Dans le mille, puis écart moyen le plus faible.</p>
      {season?.proclaimed ? (
        <p className="text-[15px] text-ink-2">
          Le classement final de cette saison est proclamé :{" "}
          <Link href="/palmares" className="font-semibold text-accent-text hover:underline">
            voir le palmarès
          </Link>
          .
        </p>
      ) : null}
    </>
  );
}
