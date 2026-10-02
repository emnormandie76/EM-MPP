import type { ReactNode } from "react";
import type { QuestionDetail } from "@/lib/data/questions";
import type { QuestionResults, ResultRow } from "@/lib/data/results";
import { formatMalus, formatNumber, formatPercent } from "@/lib/format";
import { badgeName } from "@/lib/game/badges";
import { JOKER_DIVISOR } from "@/lib/game/constants";
import { BadgeList } from "./BadgeList";
import { ChoiceDistribution } from "./ChoiceDistribution";
import { StripChart } from "./StripChart";

// What a question shows after its closing (§5.7, §8.2): the wisdom of the crowd (median and mean,
// or the share of each answer), the strip chart and, once resolved, the real value, the "Ton
// prono" band with the viewer's malus (v1.2), and the badges earned on this question.

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

/** "Écart 12 × 3 (coef) ÷ 2 (joker)", or "Mauvaise réponse : 100 × 2 (coef)". */
function malusDetail(q: QuestionDetail, mine: ResultRow): string {
  const score = mine.score!;
  const operations = [q.coefficient > 1 ? ` × ${q.coefficient} (coef)` : "", mine.answer.joker ? ` ÷ ${JOKER_DIVISOR} (joker)` : ""].join("");
  if (q.type === "choice") return score.baseMalus === 0 ? "Bonne réponse : 0 de malus" : `Mauvaise réponse : ${formatMalus(score.baseMalus)}${operations}`;
  return `Écart ${formatMalus(score.baseMalus)}${q.unit ? ` ${q.unit}` : ""}${operations}`;
}

/** "Ton prono : 240 · écart 10 (4 %)". */
function scoreHeadline(q: QuestionDetail, mine: ResultRow): string {
  const score = mine.score!;
  const parts = [`Ton prono : ${answerText(q, mine.answer)}`];
  if (q.type === "choice") parts.push(score.baseMalus === 0 ? "bonne réponse" : "mauvaise réponse");
  else {
    const relative = score.relativeError !== null && Number.isFinite(score.relativeError) ? ` (${formatPercent(score.relativeError)})` : "";
    parts.push(`écart ${formatMalus(score.baseMalus)}${relative}`);
  }
  if (score.bullseye) parts.push("Dans le mille");
  return parts.join(" · ");
}

/** The malus in large type, with its word underneath. */
function BigMalus({ hundredths }: { hundredths: number }) {
  return (
    <p className="ml-auto flex shrink-0 flex-col items-end">
      <span className="font-display text-[44px] leading-none font-extrabold tabular-nums">
        <span className="sr-only">Malus : </span>
        {formatMalus(hundredths)}
      </span>
      <span aria-hidden className="font-display text-[13px] font-extrabold uppercase tracking-[0.08em]">
        malus
      </span>
    </p>
  );
}

/**
 * The "Ton prono" band (§8.2, v1.2): raw gap, coefficient, joker and malus. Without a prediction, the
 * malus of the worst prediction, when the viewer is in the standings of the season.
 */
function MyScore({ question: q, results }: { question: QuestionDetail; results: QuestionResults }) {
  const { mine, absents, absentMalus } = results;
  if (!mine?.score) {
    if (absentMalus === null || !absents.some(({ isViewer }) => isViewer)) {
      return <p className="rounded-field bg-raised px-4 py-3 text-[15px] text-ink-2">Tu n&apos;as pas fait de prono sur cette question.</p>;
    }
    return (
      <div className="flex items-center gap-3.5 rounded-field bg-accent px-4 py-3 text-accent-ink">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-display text-lg font-extrabold uppercase">Pas de prono : malus du pire prono</p>
          <p className="text-sm font-medium">Sans prono, tu prends le malus du prono le plus éloigné.</p>
        </div>
        <BigMalus hundredths={absentMalus} />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3.5 rounded-field bg-accent px-4 py-3 text-accent-ink">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-display text-lg font-extrabold uppercase">{scoreHeadline(q, mine)}</p>
        <p className="text-sm font-medium">{malusDetail(q, mine)}</p>
      </div>
      <BigMalus hundredths={mine.score.total} />
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
  const { crowd, rows, badges } = results;
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

      {resolved ? <MyScore question={q} results={results} /> : null}
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
