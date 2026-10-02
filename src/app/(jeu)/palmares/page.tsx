import { Crown, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatars/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableScroll } from "@/components/ui/TableScroll";
import { requireUser } from "@/lib/auth/session";
import { getPalmares, type PalmaresSeason } from "@/lib/data/content";
import { getDb } from "@/lib/db/client";
import { formatCount, formatDate, formatMalus, rankSuffix } from "@/lib/format";

export const metadata: Metadata = { title: "Palmarès" };

const SECTION_TITLE = "font-display text-[26px] font-extrabold uppercase leading-none";
const TH = "px-3 py-2 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-muted whitespace-nowrap";
const TD = "px-3 py-2 align-middle";

/** Final rank, ties included: the podium can hold more than 3 players. */
const PODIUM_RANKS = 3;

type PalmaresRow = PalmaresSeason["rows"][number];

/**
 * The frozen score of a row: the malus since v1.2, or the points of a season proclaimed with the
 * v1.1 scale (none in production, decision of 02/10/2026).
 */
function score(row: PalmaresRow): { value: string; unit: string } {
  return row.malus !== null ? { value: formatMalus(row.malus), unit: "de malus" } : { value: String(row.points ?? 0), unit: "points" };
}

/** Column title of a season: malus, or points for a season proclaimed before v1.2. */
const scoreTitle = (season: PalmaresSeason) => (season.rows.some(({ malus }) => malus === null) ? "Points" : "Malus");

function Podium({ season }: { season: PalmaresSeason }) {
  const podium = season.rows.filter(({ rank }) => rank <= PODIUM_RANKS);
  return (
    <ol aria-label={`Podium de la saison ${season.label}`} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {podium.map((row) => (
        <li
          key={row.userId}
          className={`flex flex-col items-center gap-2 rounded-card px-4 py-5 text-center ${row.rank === 1 ? "border-[1.5px] border-accent bg-accent-soft" : "bg-raised"}`}
        >
          <span className="flex items-center gap-1.5 font-display text-2xl font-extrabold text-accent-text">
            {row.rank === 1 ? <Crown aria-hidden size={22} strokeWidth={2.4} /> : null}
            {row.rank}
            {rankSuffix(row.rank)}
          </span>
          <Avatar avatar={row.avatar} name={row.name} size={64} ring={row.isViewer} />
          <Link href={`/joueurs/${row.userId}`} className="text-lg font-bold hover:underline">
            {row.name}
            {row.isViewer ? " (toi)" : ""}
          </Link>
          <span className="font-display text-[22px] font-bold tabular-nums">
            {score(row).value} <span className="text-sm uppercase text-muted">{score(row).unit}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function FullStandings({ season }: { season: PalmaresSeason }) {
  return (
    <details className="group rounded-field border border-line">
      <summary className="cursor-pointer px-4 py-3 font-display text-lg font-bold uppercase tracking-[0.04em] hover:bg-chip">
        Classement complet ({formatCount(season.rows.length, "joueur")})
      </summary>
      <TableScroll label={`Classement final de la saison ${season.label}`} className="px-2 pb-2">
        <table className="w-full min-w-120 text-left text-[15px]">
          <caption className="sr-only">Classement final de la saison {season.label}</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={TH}>Rang</th>
              <th scope="col" className={TH}>Joueur</th>
              <th scope="col" className={`${TH} text-right`}>Dans le mille</th>
              <th scope="col" className={`${TH} text-right`}>Questions jouées</th>
              <th scope="col" className={`${TH} text-right`}>{scoreTitle(season)}</th>
            </tr>
          </thead>
          <tbody>
            {season.rows.map((row) => (
              <tr key={row.userId} className={`border-b border-line last:border-0 ${row.isViewer ? "bg-accent-soft font-semibold" : ""}`}>
                <td className={`${TD} font-display text-xl font-extrabold tabular-nums`}>{row.rank}</td>
                <th scope="row" className={`${TD} font-normal`}>
                  <span className="flex items-center gap-2.5">
                    <Avatar avatar={row.avatar} name={row.name} size={28} ring={row.isViewer} />
                    <Link href={`/joueurs/${row.userId}`} className="font-semibold hover:underline">
                      {row.name}
                    </Link>
                    {row.isViewer ? <span>(toi)</span> : null}
                  </span>
                </th>
                <td className={`${TD} text-right tabular-nums`}>{row.bullseyes}</td>
                <td className={`${TD} text-right tabular-nums`}>{row.questionsPlayed}</td>
                <td className={`${TD} text-right font-display text-xl font-bold tabular-nums`}>{score(row).value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </details>
  );
}

/**
 * Palmarès (architecture §5.12, §8.3): the final standings of every proclaimed season, latest
 * first, as frozen on the day of the proclamation.
 */
export default async function PalmaresPage() {
  const viewer = await requireUser();
  const palmares = await getPalmares(getDb(), viewer);

  return (
    <>
      <h1 className="font-display text-[44px] leading-none font-extrabold uppercase">Palmarès</h1>
      <p className="text-[15px] text-ink-2">
        Le classement final de chaque saison, figé le jour de sa proclamation : une correction de résultat ne le change plus.
      </p>
      {palmares.length === 0 ? (
        <EmptyState icon={Trophy}>Aucune saison n&apos;est encore terminée. Le palmarès se remplit à chaque proclamation.</EmptyState>
      ) : (
        palmares.map((season) => (
          <Card as="section" key={season.id} aria-labelledby={`saison-${season.id}`} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`saison-${season.id}`} className={SECTION_TITLE}>
                Saison {season.label}
              </h2>
              <p className="text-sm text-muted">Proclamé le {formatDate(season.proclaimedAt)}</p>
            </div>
            <Podium season={season} />
            <FullStandings season={season} />
            {season.prizes.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-xl font-extrabold uppercase">Lots attribués</h3>
                <ul className="flex flex-col gap-1 text-[15px]">
                  {season.prizes.map((prize) => (
                    <li key={prize.id}>
                      <strong className="font-display text-lg font-extrabold uppercase text-accent-text">{prize.rankLabel}</strong> :{" "}
                      {prize.description}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        ))
      )}
    </>
  );
}
