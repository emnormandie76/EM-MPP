import type { ReactNode } from "react";
import type { QuestionDetail } from "@/lib/data/questions";
import type { QuestionResults, ResultRow } from "@/lib/data/results";
import { formatNumber, formatPercent } from "@/lib/format";
import { badgeName } from "@/lib/game/badges";
import { JOKER_MULTIPLIER } from "@/lib/game/constants";
import { BadgeList } from "./BadgeList";
import { ChoiceDistribution } from "./ChoiceDistribution";
import { StripChart } from "./StripChart";

// What a question shows after its closing (§5.7, §8.2): the wisdom of the crowd (median and mean,
// or the share of each answer), the strip chart and, once resolved, the real value, the "Ton
// prono" band with the viewer's points, and the badges earned on this question.

const TILE_LABEL = "font-display text-[13px] font-extrabold uppercase tracking-[0.08em]";
const TILE_VALUE = "font-display text-[34px] leading-none font-extrabold tabular-nums sm:text-[40px]";

/**
 * A figure of the results. On a phone, the real value takes a row of its own, above the median and
 * the mean: three tiles side by side would cut a value like « 1 200 » in two.
 */
function Tile({ label, children, sub, tone = "plain" }: { label: string; children: ReactNode; sub?: string | null; tone?: "real" | "plain" | "mean" }) {
  return (
    <div className={`flex min-w-0 grow flex-col gap-0.5 rounded-field px-3 py-2.5 ${tone === "real" ? "basis-full bg-ink text-bg sm:basis-0" : "basis-0 bg-raised"}`}>
      <dt className={`${TILE_LABEL} ${tone === "real" ? "" : "text-muted"}`}>{label}</dt>
      <dd className={`${TILE_VALUE} ${tone === "mean" ? "text-hot" : ""} break-words`}>{children}</dd>
      {sub ? <dd className="text-[13px] text-ink-2">{sub}</dd> : null}
    </div>
  );
}

function answerText(q: QuestionDetail, answer: { valueNumber: number | null; optionId: number | null }): string {
  if (answer.valueNumber !== null) return formatNumber(answer.valueNumber);
  return q.options.find(({ id }) => id === answer.optionId)?.label ?? "—";
}

const points = (n: number) => (n === 0 ? "0 point" : `${n} pts`);

/** "65 pts + 20 pts bonus podium (le plus proche) × 2 (joker)". */
function scoreDetail(q: QuestionDetail, mine: ResultRow): string {
  const score = mine.score!;
  const multipliers = [
    q.coefficient > 1 ? ` × ${q.coefficient} (coef)` : "",
    mine.answer.joker ? ` × ${JOKER_MULTIPLIER} (joker)` : "",
  ].join("");
  if (q.type === "choice") return `${points(score.basePoints)}${score.basePoints > 0 ? multipliers : ""}`;

  const real = q.result?.valueNumber ?? 0;
  if (q.priceIsRight && (mine.answer.valueNumber ?? 0) > real) return "Au-dessus de la valeur réelle : 0 point (Juste Prix)";
  const rank = score.podiumRank;
  const bonus =
    score.podiumBonus > 0 && rank !== null ? ` + ${score.podiumBonus} pts bonus podium (${rank === 1 ? "le plus proche" : `${rank}e plus proche`})` : "";
  const scored = score.basePoints + score.podiumBonus > 0;
  return `${points(score.basePoints)}${bonus}${scored ? multipliers : ""}`;
}

/** "Ton prono : 240 · écart 4 %". */
function scoreHeadline(q: QuestionDetail, mine: ResultRow): string {
  const score = mine.score!;
  const parts = [`Ton prono : ${answerText(q, mine.answer)}`];
  if (q.type === "choice") parts.push(score.basePoints > 0 ? "bonne réponse" : "mauvaise réponse");
  else if (score.relativeError !== null && Number.isFinite(score.relativeError)) parts.push(`écart ${formatPercent(score.relativeError)}`);
  if (score.bullseye) parts.push("Dans le mille");
  return parts.join(" · ");
}

function MyScore({ question: q, mine }: { question: QuestionDetail; mine: ResultRow | null }) {
  if (!mine?.score) {
    return <p className="rounded-field bg-raised px-4 py-3 text-[15px] text-ink-2">Tu n&apos;as pas fait de prono sur cette question.</p>;
  }
  const { total } = mine.score;
  return (
    <div className="flex items-center gap-3.5 rounded-field bg-accent px-4 py-3 text-accent-ink">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-display text-lg font-extrabold uppercase">{scoreHeadline(q, mine)}</p>
        <p className="text-sm font-medium">{scoreDetail(q, mine)}</p>
      </div>
      <p className="ml-auto font-display text-[44px] leading-none font-extrabold tabular-nums">
        <span className="sr-only">Total : </span>
        {total > 0 ? `+${total}` : "0"}
        <span className="sr-only"> points</span>
      </p>
    </div>
  );
}

export function ResultPanel({
  question: q,
  results,
  withChartTable = true,
}: {
  question: QuestionDetail;
  results: QuestionResults;
  /** False when the page lists every prediction in its own table. */
  withChartTable?: boolean;
}) {
  const { crowd, mine, rows, badges } = results;
  const resolved = q.status === "resolved" && q.result !== null;

  return (
    <div className="flex flex-col gap-4">
      {crowd === null ? (
        <p className="text-[15px] text-ink-2">Personne n&apos;a fait de prono sur cette question.</p>
      ) : crowd.kind === "number" ? (
        <>
          <dl className="flex flex-wrap gap-2.5">
            {resolved ? (
              <Tile label="Réel" tone="real">
                {formatNumber(q.result!.valueNumber!)}
              </Tile>
            ) : null}
            <Tile label="Médiane" sub={crowd.medianGap === null ? null : `écart ${formatPercent(crowd.medianGap)}`}>
              {formatNumber(crowd.displayMedian)}
            </Tile>
            <Tile label="Moyenne" tone="mean" sub={crowd.meanGap === null ? null : `écart ${formatPercent(crowd.meanGap)}`}>
              {formatNumber(crowd.displayMean)}
            </Tile>
          </dl>
          <StripChart
            dots={rows.map(({ name, answer, isViewer }) => ({ name, value: answer.valueNumber!, isViewer }))}
            real={resolved ? q.result!.valueNumber : null}
            mean={crowd.mean}
            unit={q.unit}
            withTable={withChartTable}
          />
        </>
      ) : (
        <>
          {resolved ? (
            <dl className="flex flex-wrap gap-2.5">
              <Tile label="Bonne réponse" tone="real">
                {answerText(q, q.result!)}
              </Tile>
            </dl>
          ) : null}
          <ChoiceDistribution crowd={crowd} />
        </>
      )}

      {resolved ? <MyScore question={q} mine={mine} /> : null}
      {badges.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <BadgeList
            label="Badges gagnés sur cette question"
            badges={badges.map((key) => ({ key, name: badgeName(key), count: 1 }))}
          />
          <span className="text-sm text-muted">{badges.length > 1 ? "Nouveaux badges débloqués" : "Nouveau badge débloqué"}</span>
        </div>
      ) : null}
    </div>
  );
}
