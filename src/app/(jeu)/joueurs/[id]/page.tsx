import { History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatars/Avatar";
import { BadgeList } from "@/components/game/BadgeList";
import { SeasonTabs } from "@/components/game/SeasonTabs";
import { StatTile } from "@/components/game/StatTile";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireUser } from "@/lib/auth/session";
import { type AnswerView, getPlayerProfile, type PlayerProfile } from "@/lib/data/players";
import { getDb } from "@/lib/db/client";
import { formatCount, formatNumber, formatPercent, rankSuffix } from "@/lib/format";
import { JOKER_MULTIPLIER } from "@/lib/game/constants";

export const metadata: Metadata = { title: "Joueur" };

const SECTION_TITLE = "font-display text-[26px] font-extrabold uppercase leading-none";
const TH = "px-3 py-2 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-muted whitespace-nowrap";
const TD = "px-3 py-2.5 align-middle";

function answerText({ valueNumber, optionLabel }: AnswerView, unit: string | null): string {
  if (valueNumber !== null) return unit ? `${formatNumber(valueNumber)} ${unit}` : formatNumber(valueNumber);
  return optionLabel ?? "—";
}

/** "3e · 185 points", or why there is no rank yet. */
function Standing({ profile }: { profile: PlayerProfile }) {
  const { season, standing, resolvedCount } = profile;
  if (!season) return <p className="text-[15px] text-ink-2">Aucune saison en cours.</p>;
  if (!standing || resolvedCount === 0) {
    return <p className="text-[15px] text-ink-2">Pas encore de classement pour la saison {season.label}.</p>;
  }
  return (
    <p className="flex flex-wrap items-baseline gap-x-3 font-display">
      <span className="text-[34px] leading-none font-extrabold tabular-nums">
        {standing.rank}
        <span className="text-[22px]">{rankSuffix(standing.rank)}</span>
      </span>
      <span className="text-[34px] leading-none font-extrabold tabular-nums text-accent-text">
        {standing.points}
        <span className="ml-1 text-lg uppercase text-muted">points</span>
      </span>
      <span className="font-sans text-[15px] text-muted">Saison {season.label}</span>
    </p>
  );
}

function HistoryTable({ profile }: { profile: PlayerProfile }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-140 text-left text-[15px]">
        <caption className="sr-only">Historique des questions résolues de {profile.player.name}</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={TH}>Question</th>
            <th scope="col" className={TH}>Prono</th>
            <th scope="col" className={TH}>Réel</th>
            <th scope="col" className={`${TH} text-right`}>Écart</th>
            <th scope="col" className={TH}>Joker</th>
            <th scope="col" className={`${TH} text-right`}>Points</th>
          </tr>
        </thead>
        <tbody>
          {profile.history.map((item) => (
            <tr key={item.questionId} className="border-b border-line last:border-0">
              <th scope="row" className={`${TD} font-semibold`}>
                <Link href={`/questions/${item.questionId}`} className="hover:text-accent-text hover:underline">
                  {item.title}
                </Link>
              </th>
              <td className={`${TD} tabular-nums`}>{answerText(item.answer, item.unit)}</td>
              <td className={`${TD} tabular-nums`}>{answerText(item.real, item.unit)}</td>
              <td className={`${TD} text-right tabular-nums`}>
                {item.relativeError === null || !Number.isFinite(item.relativeError) ? "—" : formatPercent(item.relativeError)}
              </td>
              <td className={TD}>
                {item.joker ? (
                  <span className="font-display font-extrabold uppercase tracking-[0.06em] text-accent-text">×{JOKER_MULTIPLIER}</span>
                ) : (
                  <span className="text-muted">
                    <span aria-hidden>—</span>
                    <span className="sr-only">non</span>
                  </span>
                )}
              </td>
              <td className={`${TD} text-right font-display text-xl font-bold tabular-nums`}>{item.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Public profile of a player (architecture §8.3): rank and points in the season shown, mean error,
 * Dans le mille, questions played, the 6 badges and the history of the resolved questions.
 */
export default async function PlayerPage({ params, searchParams }: PageProps<"/joueurs/[id]">) {
  const viewer = await requireUser();
  const { id } = await params;
  const { saison } = await searchParams;
  // An unknown season falls back to the default one (getPlayerProfile).
  const seasonId = typeof saison === "string" ? Number(saison) : undefined;
  const profile = await getPlayerProfile(getDb(), viewer, { userId: id, seasonId }, new Date());
  if (!profile) notFound();
  const { player, standing, season } = profile;

  return (
    <>
      <header className="flex flex-wrap items-center gap-4">
        <Avatar avatar={player.avatar} name={player.name} size={64} ring={player.isViewer} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-display text-[44px] leading-none font-extrabold uppercase">
            {player.name}
            {player.isViewer ? <span className="ml-3 text-2xl text-muted">(toi)</span> : null}
            {player.inactive ? <span className="ml-3 text-2xl text-muted">(inactif)</span> : null}
          </h1>
          <Standing profile={profile} />
        </div>
      </header>
      <SeasonTabs seasons={profile.seasons} currentId={season?.id ?? null} basePath={`/joueurs/${player.id}`} />

      <dl className="grid grid-cols-2 gap-4 lg:flex">
        <StatTile label="Écart moyen" sub="sur les questions à nombre">
          {standing?.meanError == null ? "—" : formatPercent(standing.meanError)}
        </StatTile>
        <StatTile label="Dans le mille" sub="écart de 1 % ou moins">
          {standing?.bullseyes ?? 0}
        </StatTile>
        <StatTile label="Pronos joués" sub="sur les questions résolues">
          {standing?.questionsPlayed ?? 0}
        </StatTile>
      </dl>

      <Card as="section" aria-labelledby="badges" className="flex flex-col gap-3">
        <h2 id="badges" className={SECTION_TITLE}>
          Badges
        </h2>
        <BadgeList badges={profile.badges} />
      </Card>

      <section aria-labelledby="historique" className="flex flex-col gap-2.5">
        <h2 id="historique" className={SECTION_TITLE}>
          Historique
        </h2>
        {profile.history.length === 0 ? (
          <EmptyState icon={History}>
            {season ? `Aucun prono résolu pour la saison ${season.label}.` : "Aucun prono résolu pour l'instant."}
          </EmptyState>
        ) : (
          <Card>
            <p className="mb-2 text-sm text-muted">
              {formatCount(profile.history.length, "question résolue", "questions résolues")}
              {season ? ` · saison ${season.label}` : ""}
            </p>
            <HistoryTable profile={profile} />
          </Card>
        )}
      </section>
    </>
  );
}
