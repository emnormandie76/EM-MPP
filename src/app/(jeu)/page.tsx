import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { AnnouncementBar } from "@/components/game/AnnouncementBar";
import { QuestionCard } from "@/components/game/QuestionCard";
import { SegmentedProgress } from "@/components/game/SegmentedProgress";
import { StandingsTable } from "@/components/game/StandingsTable";
import { StatTile } from "@/components/game/StatTile";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireUser } from "@/lib/auth/session";
import { getHomeData, type HomeData } from "@/lib/data/home";
import { getDb } from "@/lib/db/client";
import { formatCount, rankSuffix } from "@/lib/format";
import { JOKERS_PER_SEASON } from "@/lib/game/constants";

const SECTION_TITLE = "font-display text-[26px] font-extrabold uppercase leading-none";
const LINK = "text-[15px] font-semibold text-accent-text hover:underline";

/** "Encore 2 pronos à valider sur les 5 questions ouvertes." */
function ProgressSentence({ open, validated }: HomeData["progress"]) {
  if (open === 0) return <>Aucune question ouverte en ce moment.</>;
  const questions = open === 1 ? "la question ouverte" : `les ${open} questions ouvertes`;
  const left = open - validated;
  if (left === 0) return <>Tous tes pronos sont validés sur {questions}.</>;
  return (
    <>
      Encore <strong className="text-accent-text">{formatCount(left, "prono")} à valider</strong> sur {questions}.
    </>
  );
}

function PositionTile({ standings }: { standings: HomeData["standings"] }) {
  const { me, resolvedCount, season } = standings;
  if (!me || resolvedCount === 0) {
    return (
      <StatTile label="Position" sub="Après le premier résultat">
        —
      </StatTile>
    );
  }
  const { delta } = me;
  let sub = season ? `Saison ${season.label}` : "";
  let subClassName = "text-muted";
  if (delta !== null && delta !== 0) {
    const places = Math.abs(delta);
    sub = `${delta > 0 ? "▲" : "▼"} ${formatCount(places, "place")}`;
    subClassName = `font-bold ${delta > 0 ? "text-up" : "text-down"}`;
  } else if (delta === 0) {
    sub = "= même place";
  }
  return (
    <StatTile label="Position" sub={sub} subClassName={subClassName}>
      {me.rank}
      <span className="text-[28px]">{rankSuffix(me.rank)}</span>
    </StatTile>
  );
}

/** Home page (architecture §8.3), blocks 1 to 3; the latest result arrives in step 7. */
export default async function HomePage() {
  const viewer = await requireUser();
  const now = new Date();
  const data = await getHomeData(getDb(), viewer, now);
  const { progress, standings, closingSoon } = data;

  return (
    <>
      <AnnouncementBar announcements={data.announcements} now={now} />

      <section aria-labelledby="bienvenue" className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <Card className="flex grow flex-col gap-3">
          <h1 id="bienvenue" className="font-display text-[44px] leading-none font-extrabold uppercase">
            Salut {viewer.name}
          </h1>
          <p className="text-base text-ink-2">
            <ProgressSentence {...progress} />
          </p>
          {progress.open > 0 ? (
            <div className="flex items-center gap-3.5">
              <SegmentedProgress value={progress.validated} max={progress.open} label="Pronos validés" />
              <span className="font-display text-lg font-bold uppercase tracking-[0.04em] whitespace-nowrap">
                {progress.validated}/{progress.open} validés
              </span>
            </div>
          ) : null}
        </Card>
        <dl className="grid grid-cols-2 gap-4 lg:flex">
          <PositionTile standings={standings} />
          <StatTile
            label="Points"
            valueClassName="text-accent-text"
            sub={formatCount(standings.resolvedCount, "question résolue", "questions résolues")}
          >
            {standings.me?.points ?? 0}
          </StatTile>
          <StatTile label="Jokers" sub={`${data.jokersLeft >= 2 ? "restants" : "restant"} cette saison`}>
            {data.jokersLeft}
            <span className="text-[28px] text-muted">/{JOKERS_PER_SEASON}</span>
          </StatTile>
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        <section aria-labelledby="cloture-imminente" className="flex flex-col gap-2.5 lg:col-span-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="cloture-imminente" className={SECTION_TITLE}>
              Clôture imminente
            </h2>
            {progress.open > 0 ? (
              <Link href="/pronos" className={LINK}>
                {progress.open === 1 ? "La question ouverte" : `Les ${progress.open} questions ouvertes`}
              </Link>
            ) : null}
          </div>
          {closingSoon.length === 0 ? (
            <EmptyState icon={CalendarClock}>Aucune question ouverte pour l&apos;instant. Les prochaines arrivent bientôt.</EmptyState>
          ) : (
            closingSoon.map((question) => <QuestionCard key={question.id} question={question} serverNow={now.getTime()} />)
          )}
        </section>

        <Card as="section" className="flex flex-col gap-2 self-start lg:col-span-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className={SECTION_TITLE}>Classement</h2>
            {standings.season ? <span className="text-[13px] text-muted">Saison {standings.season.label}</span> : null}
          </div>
          {standings.resolvedCount === 0 || standings.top.length === 0 ? (
            <p className="text-[15px] text-ink-2">Le classement démarre au premier résultat.</p>
          ) : (
            <StandingsTable rows={standings.top} mine={standings.mine} label={`Classement de la saison ${standings.season?.label ?? ""}`} />
          )}
          <Link href="/classement" className={LINK}>
            Tout le classement
          </Link>
        </Card>
      </div>
    </>
  );
}
