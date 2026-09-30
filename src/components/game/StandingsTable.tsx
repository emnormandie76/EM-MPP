import Link from "next/link";
import { Avatar } from "@/components/avatars/Avatar";
import type { StandingView } from "@/lib/data/standings";

// Standings rows (§8.2). The compact version of the home page: rank, avatar, name, movement and
// points; the viewer's row is outlined. The full version of /classement adds the Dans le mille and
// the questions played, in a table.

/** On the viewer's row, a white background keeps the arrows readable (4.5:1) on the accent tint. */
function Movement({ delta, onTint }: { delta: number | null; onTint: boolean }) {
  const box = `w-8 shrink-0 text-right text-[13px] font-bold ${onTint ? "rounded-chip bg-surface px-1" : ""}`;
  if (delta === null) return <span className="w-8 shrink-0" />;
  if (delta === 0) {
    return (
      <span className={`${box} text-muted`}>
        <span aria-hidden>=</span>
        <span className="sr-only">même place</span>
      </span>
    );
  }
  const up = delta > 0;
  const places = Math.abs(delta);
  return (
    <span className={`${box} tabular-nums ${up ? "text-up" : "text-down"}`}>
      <span aria-hidden>
        {up ? "▲" : "▼"}
        {places}
      </span>
      <span className="sr-only">
        {up ? "monte" : "descend"} de {places} {places === 1 ? "place" : "places"}
      </span>
    </span>
  );
}

function Row({ row }: { row: StandingView }) {
  const me = row.isViewer;
  return (
    <li
      className={[
        "flex items-center gap-3 rounded-button",
        me ? "border-[1.5px] border-accent bg-accent-soft px-2.25 py-1.75" : "bg-raised px-2.5 py-2",
      ].join(" ")}
    >
      <span
        className={[
          "w-6 font-display text-2xl font-extrabold tabular-nums",
          row.rank === 1 ? "text-accent-text" : me ? "text-ink" : "text-ink-2",
        ].join(" ")}
      >
        <span className="sr-only">Rang </span>
        {row.rank}
      </span>
      <Avatar avatar={row.avatar} name={row.name} size={32} ring={me} />
      <span className={`min-w-0 grow truncate text-base ${me ? "font-bold" : "font-semibold"}`}>
        {row.name}
        {me ? " (toi)" : ""}
        {row.inactive ? <span className="font-normal text-muted"> (inactif)</span> : null}
      </span>
      <Movement delta={row.delta} onTint={me} />
      <span className={`min-w-12 text-right font-display text-[22px] font-bold tabular-nums ${me ? "text-accent-text" : ""}`}>
        {row.points}
        <span className="sr-only"> points</span>
      </span>
    </li>
  );
}

const TH = "px-2.5 py-2 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-muted whitespace-nowrap";

/** One cell of a row drawn as a rounded band: the viewer's row is outlined and tinted. */
function cell(me: boolean, position: "first" | "middle" | "last", extra = ""): string {
  const band = me ? "bg-accent-soft border-y-[1.5px] border-accent" : "bg-raised";
  const edge =
    position === "first"
      ? `rounded-l-button ${me ? "border-l-[1.5px]" : ""}`
      : position === "last"
        ? `rounded-r-button ${me ? "border-r-[1.5px]" : ""}`
        : "";
  return `px-2.5 py-2 align-middle ${band} ${edge} ${extra}`;
}

/**
 * Full standings of /classement (§8.2, §8.3): rank, player, movement, Dans le mille, questions played,
 * points. Each name leads to the player's profile, on the same season.
 */
export function StandingsFullTable({ rows, caption, seasonId }: { rows: StandingView[]; caption: string; seasonId: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-130 border-separate border-spacing-y-1 text-left text-[15px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={TH}>
              Rang
            </th>
            <th scope="col" className={TH}>
              Joueur
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Évolution
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Dans le mille
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Questions jouées
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Points
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const me = row.isViewer;
            return (
              <tr key={row.userId}>
                <td
                  className={cell(
                    me,
                    "first",
                    `w-12 font-display text-2xl font-extrabold tabular-nums ${row.rank === 1 ? "text-accent-text" : me ? "text-ink" : "text-ink-2"}`,
                  )}
                >
                  {row.rank}
                </td>
                <th scope="row" className={cell(me, "middle", "font-normal")}>
                  <span className="flex items-center gap-3">
                    <Avatar avatar={row.avatar} name={row.name} size={32} ring={me} />
                    <Link href={`/joueurs/${row.userId}?saison=${seasonId}`} className={`hover:underline ${me ? "font-bold" : "font-semibold"}`}>
                      {row.name}
                    </Link>
                    {me ? <span className="font-bold">(toi)</span> : null}
                    {row.inactive ? <span className="text-muted">(inactif)</span> : null}
                  </span>
                </th>
                <td className={cell(me, "middle", "text-right")}>
                  <span className="inline-flex justify-end">
                    <Movement delta={row.delta} onTint={me} />
                  </span>
                </td>
                <td className={cell(me, "middle", "text-right tabular-nums")}>{row.bullseyes}</td>
                <td className={cell(me, "middle", "text-right tabular-nums")}>{row.questionsPlayed}</td>
                <td className={cell(me, "last", `text-right font-display text-[22px] font-bold tabular-nums ${me ? "text-accent-text" : ""}`)}>
                  {row.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The top rows, then the viewer's own row when it is further down. */
export function StandingsTable({ rows, mine, label }: { rows: StandingView[]; mine?: StandingView | null; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <ol aria-label={label} className="flex flex-col gap-1">
        {rows.map((row) => (
          <Row key={row.userId} row={row} />
        ))}
      </ol>
      {mine ? (
        <>
          <p aria-hidden className="text-center leading-none text-muted">
            …
          </p>
          <ol aria-label="Ta place" className="flex flex-col gap-1">
            <Row row={mine} />
          </ol>
        </>
      ) : null}
    </div>
  );
}
