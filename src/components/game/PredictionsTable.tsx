import Link from "next/link";
import { Avatar } from "@/components/avatars/Avatar";
import type { QuestionDetail } from "@/lib/data/questions";
import type { ResultRow } from "@/lib/data/results";
import { formatNumber, formatPercent, rankSuffix } from "@/lib/format";
import { JOKER_MULTIPLIER } from "@/lib/game/constants";

// Everyone's predictions on a closed question (§8.3): player, prediction, joker. Once resolved, the
// error, the scale points, the podium bonus and the total of each player, sorted by total (§6.6).

const TH = "px-3 py-2 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-muted whitespace-nowrap";
const TD = "px-3 py-2.5 align-middle";
const NUM = `${TD} text-right tabular-nums`;

function answerText(q: QuestionDetail, row: ResultRow): string {
  const { valueNumber, optionId } = row.answer;
  if (valueNumber !== null) return q.unit ? `${formatNumber(valueNumber)} ${q.unit}` : formatNumber(valueNumber);
  return q.options.find(({ id }) => id === optionId)?.label ?? "—";
}

function errorText(error: number | null): string {
  return error === null || !Number.isFinite(error) ? "—" : formatPercent(error);
}

export function PredictionsTable({ question: q, rows }: { question: QuestionDetail; rows: ResultRow[] }) {
  const scored = q.status === "resolved";
  const number = q.type === "number";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-120 text-left text-[15px]">
        <caption className="sr-only">Pronos de tous les joueurs{scored ? ", avec leurs points" : ""}</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={TH}>Joueur</th>
            <th scope="col" className={TH}>Prono</th>
            <th scope="col" className={TH}>Joker</th>
            {scored && number ? <th scope="col" className={`${TH} text-right`}>Écart</th> : null}
            {scored ? <th scope="col" className={`${TH} text-right`}>Barème</th> : null}
            {scored && number ? <th scope="col" className={`${TH} text-right`}>Bonus</th> : null}
            {scored ? <th scope="col" className={`${TH} text-right`}>Total</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.predictionId} className={`border-b border-line last:border-0 ${row.isViewer ? "bg-accent-soft font-semibold" : ""}`}>
              <th scope="row" className={`${TD} font-normal`}>
                <span className="flex items-center gap-2.5">
                  <Avatar avatar={row.avatar} name={row.name} size={28} ring={row.isViewer} />
                  <Link href={`/joueurs/${row.userId}`} className={`hover:underline ${row.isViewer ? "font-bold" : "font-semibold"}`}>
                    {row.name}
                  </Link>
                  {row.isViewer ? <span className="font-semibold">(toi)</span> : null}
                  {row.inactive ? <span className="text-muted">(inactif)</span> : null}
                </span>
              </th>
              <td className={`${TD} tabular-nums`}>{answerText(q, row)}</td>
              <td className={TD}>
                {row.answer.joker ? (
                  <span className="font-display font-extrabold uppercase tracking-[0.06em] text-accent-text">Joker ×{JOKER_MULTIPLIER}</span>
                ) : (
                  <span className="text-muted">
                    <span aria-hidden>—</span>
                    <span className="sr-only">non</span>
                  </span>
                )}
              </td>
              {scored && number ? <td className={NUM}>{errorText(row.score?.relativeError ?? null)}</td> : null}
              {scored ? <td className={NUM}>{row.score?.basePoints ?? 0}</td> : null}
              {scored && number ? (
                <td className={`${NUM} whitespace-nowrap`}>
                  {row.score?.podiumRank != null && row.score.podiumBonus > 0
                    ? `+${row.score.podiumBonus} (${row.score.podiumRank}${rankSuffix(row.score.podiumRank)})`
                    : "—"}
                </td>
              ) : null}
              {scored ? <td className={`${NUM} font-display text-xl font-bold`}>{row.score?.total ?? 0}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
