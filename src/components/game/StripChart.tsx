import { formatNumber } from "@/lib/format";
import { buildStripChart, DEFAULT_CHART_WIDTH, viewerLabelSide } from "@/lib/game/chart";

// Strip chart of the predictions of a number question (§5.7, §8.2): one dot per player on an axis,
// the viewer's dot in accent with "TOI" beside it, the team's mean in dashes and, once resolved, the real
// value as a solid line. The drawing is hidden from screen readers: the caption says how to read
// it, and the predictions are listed in a table (here, or in the table of the page).

export type ChartDot = { name: string; value: number; isViewer: boolean };

/** Top of the 12 px dots of each row, from the axis up (the axis is at 86 px). */
const ROW_TOPS = [66, 52, 38, 24];

/**
 * A label is centred on its point; near an edge of the chart, it is aligned on that edge instead, so
 * that a long value (« Réel 12 500 ») does not stick out of the card on a phone.
 */
function labelAlign(x: number): string {
  if (x < 15) return "-ml-1.5";
  if (x > 85) return "ml-1.5 -translate-x-full";
  return "-translate-x-1/2";
}

export function StripChart({
  dots,
  real,
  mean,
  unit,
  withTable = true,
}: {
  dots: ChartDot[];
  /** The real value, once resolved. */
  real: number | null;
  mean: number;
  unit: string | null;
  /** Lists the predictions for screen readers; false when the page shows them in a table. */
  withTable?: boolean;
}) {
  if (dots.length === 0) return null;
  const viewerIndex = dots.findIndex(({ isViewer }) => isViewer);
  const chart = buildStripChart(
    dots.map(({ value }) => value),
    real,
    mean,
    DEFAULT_CHART_WIDTH,
    viewerIndex >= 0 ? viewerIndex : null,
  );
  const toX = (value: number) => `${((value - chart.min) / (chart.max - chart.min)) * 100}%`;
  const withUnit = (value: number) => (unit ? `${formatNumber(value)} ${unit}` : formatNumber(value));

  return (
    <figure className="flex flex-col gap-2" data-testid="strip-chart">
      <div aria-hidden className="relative mx-3.5 h-28">
        <div className="absolute inset-x-0 top-[86px] h-0.5 bg-line" />
        {chart.realX !== null && real !== null ? (
          <>
            <div className="absolute top-[18px] -ml-px h-[68px] w-0.5 bg-ink" style={{ left: `${chart.realX}%` }} />
            <span
              className={`absolute top-0 ${labelAlign(chart.realX)} font-display text-[13px] font-extrabold tracking-[0.06em] whitespace-nowrap uppercase`}
              style={{ left: `${chart.realX}%` }}
            >
              Réel {formatNumber(real)}
            </span>
          </>
        ) : null}
        <div className="absolute top-[28px] -ml-px h-[58px] border-l-2 border-dashed border-hot" style={{ left: `${chart.meanX}%` }} />
        {chart.points.map((point) => {
          const dot = dots[point.index];
          const top = ROW_TOPS[point.row];
          if (!dot.isViewer) {
            return (
              <span
                key={point.index}
                className="absolute -ml-1.5 size-3 rounded-full bg-dots"
                style={{ left: `${point.x}%`, top }}
              />
            );
          }
          // Beside the dot, where the placement kept room for it: above, it would hide the next row.
          const onLeft = viewerLabelSide(point.x) === "left";
          return (
            <span key={point.index}>
              <span
                className="absolute z-10 -ml-2 size-4 rounded-full bg-accent ring-4 ring-accent-soft"
                style={{ left: `${point.x}%`, top: top - 2 }}
              />
              <span
                className={`absolute z-10 -translate-y-1/2 ${onLeft ? "-translate-x-full" : ""} font-display text-[13px] leading-none font-extrabold text-accent-text`}
                style={{ left: `calc(${point.x}% ${onLeft ? "-" : "+"} 14px)`, top: top + 6 }}
              >
                TOI
              </span>
            </span>
          );
        })}
        {chart.ticks.map((tick) => (
          <span key={tick} className="absolute top-[94px] -translate-x-1/2 text-xs text-muted tabular-nums" style={{ left: toX(tick) }}>
            {formatNumber(tick)}
          </span>
        ))}
      </div>
      <figcaption className="text-[13px] text-muted">
        Chaque point est le prono d&apos;un joueur.{real !== null ? " Trait plein : valeur réelle." : ""} Pointillés : moyenne de
        l&apos;équipe.
      </figcaption>
      {withTable ? (
        <table className="sr-only">
          <caption>Pronos de l&apos;équipe</caption>
          <thead>
            <tr>
              <th scope="col">Joueur</th>
              <th scope="col">Prono</th>
            </tr>
          </thead>
          <tbody>
            {[...dots]
              .sort((a, b) => a.value - b.value)
              .map((dot) => (
                <tr key={`${dot.name}-${dot.value}`}>
                  <td>{dot.isViewer ? `${dot.name} (toi)` : dot.name}</td>
                  <td>{withUnit(dot.value)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : null}
    </figure>
  );
}
