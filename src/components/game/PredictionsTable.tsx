import Link from "next/link";
import { Avatar } from "@/components/avatars/Avatar";
import type { AvatarKey } from "@/lib/avatars";
import { TableScroll } from "@/components/ui/TableScroll";
import type { QuestionDetail } from "@/lib/data/questions";
import type { AbsentRow, ResultRow } from "@/lib/data/results";
import { formatMalus, formatNumber, formatPercent } from "@/lib/format";
import { JOKER_DIVISOR } from "@/lib/game/constants";

// The predictions of a closed question the viewer may see (§6.6, §8.3): player, prediction, joker.
// Once resolved, the raw gap and the malus of each player, sorted from the smallest malus to the
// largest, then the players of the standings without a prediction, with the malus of their
// absence (v1.2).

const TH = "px-3 py-2 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-muted whitespace-nowrap";
const TD = "px-3 py-2.5 align-middle";
const NUM = `${TD} text-right tabular-nums`;
const NONE = (
  <span className="text-muted">
    <span aria-hidden>—</span>
    <span className="sr-only">non</span>
  </span>
);

function answerText(q: QuestionDetail, row: ResultRow): string {
  const { valueNumber, optionId } = row.answer;
  if (valueNumber !== null) return q.unit ? `${formatNumber(valueNumber)} ${q.unit}` : formatNumber(valueNumber);
  return q.options.find(({ id }) => id === optionId)?.label ?? "—";
}

/** "10 (4 %)": the raw gap, with the relative error. */
function gapText(row: ResultRow): string {
  const score = row.score;
  if (!score) return "—";
  const relative = score.relativeError === null || !Number.isFinite(score.relativeError) ? "" : ` (${formatPercent(score.relativeError)})`;
  return `${formatMalus(score.baseMalus)}${relative}`;
}

function Player({ userId, name, avatar, isViewer, inactive }: { userId: string; name: string; avatar: AvatarKey; isViewer: boolean; inactive: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Avatar avatar={avatar} name={name} size={28} ring={isViewer} />
      <Link href={`/joueurs/${userId}`} className={`hover:underline ${isViewer ? "font-bold" : "font-semibold"}`}>
        {name}
      </Link>
      {isViewer ? <span className="font-semibold">(toi)</span> : null}
      {inactive ? <span className="text-muted">(inactif)</span> : null}
    </span>
  );
}

export function PredictionsTable({ question: q, rows, absents = [] }: { question: QuestionDetail; rows: ResultRow[]; absents?: AbsentRow[] }) {
  const scored = q.status === "resolved";
  const number = q.type === "number";
  return (
    <TableScroll label="Pronos de tous les joueurs">
      <table className="w-full min-w-120 text-left text-[15px]">
        <caption className="sr-only">Pronos de tous les joueurs{scored ? ", avec leur malus" : ""}</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={TH}>Joueur</th>
            <th scope="col" className={TH}>Prono</th>
            <th scope="col" className={TH}>Joker</th>
            {scored && number ? <th scope="col" className={`${TH} text-right`}>Écart</th> : null}
            {scored ? <th scope="col" className={`${TH} text-right`}>Malus</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.predictionId} className={`border-b border-line last:border-0 ${row.isViewer ? "bg-accent-soft font-semibold" : ""}`}>
              <th scope="row" className={`${TD} font-normal`}>
                <Player {...row} />
              </th>
              <td className={`${TD} tabular-nums`}>{answerText(q, row)}</td>
              <td className={TD}>
                {row.answer.joker ? (
                  <span className="font-display font-extrabold uppercase tracking-[0.06em] text-accent-text">Joker ÷{JOKER_DIVISOR}</span>
                ) : (
                  NONE
                )}
              </td>
              {scored && number ? <td className={`${NUM} whitespace-nowrap`}>{gapText(row)}</td> : null}
              {scored ? <td className={`${NUM} font-display text-xl font-bold`}>{formatMalus(row.score?.total ?? 0)}</td> : null}
            </tr>
          ))}
          {scored
            ? absents.map((row) => (
                <tr key={row.userId} className={`border-b border-line last:border-0 ${row.isViewer ? "bg-accent-soft font-semibold" : ""}`}>
                  <th scope="row" className={`${TD} font-normal`}>
                    <Player {...row} />
                  </th>
                  <td className={`${TD} text-muted`}>Pas de prono</td>
                  <td className={TD}>{NONE}</td>
                  {number ? <td className={NUM}>—</td> : null}
                  <td className={`${NUM} font-display text-xl font-bold`}>{formatMalus(row.malus)}</td>
                </tr>
              ))
            : null}
        </tbody>
      </table>
    </TableScroll>
  );
}
