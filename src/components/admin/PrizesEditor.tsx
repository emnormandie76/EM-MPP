"use client";

import { ArrowDown, ArrowUp, Plus, Trash } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { savePrizesAction } from "@/lib/actions/content";
import type { FormState } from "@/lib/actions/form-state";
import { PRIZE_DESCRIPTION_MAX, PRIZE_RANK_MAX, PRIZES_MAX } from "@/lib/validation/content";

const ICON = { "aria-hidden": true, size: 16, strokeWidth: 2.4 } as const;
const INPUT = "h-11 min-w-0 rounded-field border border-line-strong bg-surface px-3 text-base text-ink focus:border-accent";

type Row = { key: number; rankLabel: string; description: string };

/** Prizes of a season: rank and description, in display order (§8.3 /admin/saisons). */
export function PrizesEditor({
  seasonLabel,
  initial,
}: {
  seasonLabel: string;
  initial: { rankLabel: string; description: string }[];
}) {
  const [rows, setRows] = useState<Row[]>(() => initial.map((prize, key) => ({ key, ...prize })));
  const [nextKey, setNextKey] = useState(initial.length);
  const [state, setState] = useState<FormState>(null);
  const [pending, startTransition] = useTransition();
  const idOf = (row: Row, field: string) => `prize-${seasonLabel}-${row.key}-${field}`;

  function update(key: number, patch: Partial<Row>) {
    setRows(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function move(index: number, delta: number) {
    const next = [...rows];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setRows(next);
  }

  function add() {
    const rank = rows.length === 0 ? "1er" : `${rows.length + 1}e`;
    setRows([...rows, { key: nextKey, rankLabel: rank, description: "" }]);
    setNextKey(nextKey + 1);
  }

  function save() {
    const prizes = rows.map(({ rankLabel, description }) => ({ rankLabel, description }));
    startTransition(async () => {
      setState(await savePrizesAction(seasonLabel, prizes));
    });
  }

  let feedback: { tone: "success" | "error"; text: string } | null = null;
  if (state?.ok) feedback = { tone: "success", text: state.message };
  else if (state) feedback = { tone: "error", text: Object.values(state.fieldErrors ?? {})[0] ?? state.message };

  return (
    <div className="flex flex-col gap-3">
      {rows.length === 0 ? <p className="text-[15px] text-ink-2">Aucun lot pour cette saison.</p> : null}
      <ol className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={row.key} className="flex flex-wrap items-end gap-2">
            <div className="flex w-24 flex-col gap-1">
              <label htmlFor={idOf(row, "rank")} className="text-sm font-semibold text-ink-2">
                Rang
              </label>
              <input
                id={idOf(row, "rank")}
                value={row.rankLabel}
                maxLength={PRIZE_RANK_MAX}
                onChange={(event) => update(row.key, { rankLabel: event.target.value })}
                className={INPUT}
              />
            </div>
            <div className="flex min-w-60 grow flex-col gap-1">
              <label htmlFor={idOf(row, "description")} className="text-sm font-semibold text-ink-2">
                Lot n° {index + 1}
              </label>
              <input
                id={idOf(row, "description")}
                value={row.description}
                maxLength={PRIZE_DESCRIPTION_MAX}
                onChange={(event) => update(row.key, { description: event.target.value })}
                className={INPUT}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Monter le lot n° ${index + 1}`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp {...ICON} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Descendre le lot n° ${index + 1}`}
              disabled={index === rows.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown {...ICON} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Retirer le lot n° ${index + 1}`}
              onClick={() => setRows(rows.filter((item) => item.key !== row.key))}
            >
              <Trash {...ICON} />
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={add} disabled={rows.length >= PRIZES_MAX}>
          <Plus {...ICON} />
          Ajouter un lot
        </Button>
        <Button pending={pending} onClick={save}>
          Enregistrer les lots
        </Button>
      </div>
      <FormMessage feedback={feedback} />
    </div>
  );
}
