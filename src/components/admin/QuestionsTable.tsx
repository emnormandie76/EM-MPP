"use client";

import { CalendarClock, Copy, Send } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { TableScroll } from "@/components/ui/TableScroll";
import { duplicateQuestionsAction, publishQuestionsAction, setQuestionDatesAction } from "@/lib/actions/questions";
import { formatCount, lowerFirst } from "@/lib/format";
import type { QuestionStatus } from "@/lib/game/question-status";
import type { BatchReport } from "@/lib/services/questions";
import { QuestionStatusChip } from "./QuestionStatusChip";

// Questions of the back office, with a selection and its group actions (architecture §5.11,
// §8.3): dates in series (Paris time), publication, duplication. Each action reports, question
// by question, what failed and why.

export type QuestionListItem = {
  id: number;
  title: string;
  categoryName: string;
  kindLabel: string;
  coefficient: number;
  seasonLabel: string | null;
  status: QuestionStatus;
  opensLabel: string | null;
  closesLabel: string | null;
  expectedLabel: string | null;
  predictionCount: number;
};

type Report = { tone: "success" | "error"; lines: string[] } | null;

const TH = "px-3 py-2 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-muted";
const TD = "px-3 py-2.5 align-middle";
const ICON = { "aria-hidden": true, size: 16, strokeWidth: 2.4 } as const;

function reportOf(report: BatchReport, done: (n: number) => string): Report {
  const lines = [done(report.succeeded.length)];
  if (report.unchanged.length > 0) lines.push(`${formatCount(report.unchanged.length, "déjà publiée")}.`);
  for (const { title, reasons } of report.failed) lines.push(`« ${title} » : ${lowerFirst(reasons.join(" "))}`);
  return { tone: report.failed.length > 0 ? "error" : "success", lines };
}

export function QuestionsTable({ rows }: { rows: QuestionListItem[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState<Report>(null);
  const [datesOpen, setDatesOpen] = useState(false);
  const [dateErrors, setDateErrors] = useState<Record<string, string>>({});

  const visibleIds = rows.map(({ id }) => id);
  const selection = visibleIds.filter((id) => selected.has(id));
  const allSelected = rows.length > 0 && selection.length === rows.length;

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function publish() {
    startTransition(async () => {
      const result = await publishQuestionsAction(selection);
      setReport(
        result.ok
          ? reportOf(result.data, (n) => `${formatCount(n, "question publiée", "questions publiées")}.`)
          : { tone: "error", lines: [result.message] },
      );
    });
  }

  function duplicate() {
    startTransition(async () => {
      const result = await duplicateQuestionsAction(selection);
      setReport(
        result.ok
          ? { tone: "success", lines: [`${formatCount(result.data.ids.length, "copie créée", "copies créées")}, en brouillon.`] }
          : { tone: "error", lines: [result.message] },
      );
    });
  }

  function applyDates(formData: FormData) {
    const dates = {
      opensAt: String(formData.get("opensAt") ?? ""),
      closesAt: String(formData.get("closesAt") ?? ""),
      expectedResultAt: String(formData.get("expectedResultAt") ?? ""),
    };
    startTransition(async () => {
      const result = await setQuestionDatesAction({ questionIds: selection, ...dates });
      if (!result.ok) {
        setDateErrors(result.fieldErrors ?? { form: result.message });
        return;
      }
      setDateErrors({});
      setDatesOpen(false);
      setReport(reportOf(result.data, (n) => `Dates appliquées à ${formatCount(n, "question")}.`));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Actions sur la sélection">
        <p className="mr-2 text-[15px] text-ink-2" aria-live="polite">
          {formatCount(selection.length, "question sélectionnée", "questions sélectionnées")}
        </p>
        <Button
          variant="secondary"
          disabled={selection.length === 0}
          pending={pending}
          onClick={() => {
            setDateErrors({});
            setDatesOpen(true);
          }}
        >
          <CalendarClock {...ICON} />
          Définir les dates
        </Button>
        <Button disabled={selection.length === 0} pending={pending} onClick={publish}>
          <Send {...ICON} />
          Publier
        </Button>
        <Button variant="secondary" disabled={selection.length === 0} pending={pending} onClick={duplicate}>
          <Copy {...ICON} />
          Dupliquer
        </Button>
      </div>

      <div aria-live="polite">
        {report ? (
          <div className="flex flex-col gap-1">
            <FormMessage feedback={{ tone: report.tone, text: report.lines[0] }} />
            {report.lines.length > 1 ? (
              <ul className="ml-6.5 list-disc text-sm text-ink-2">
                {report.lines.slice(1).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <TableScroll label="Questions">
        <table className="w-full min-w-230 text-left text-[15px]">
          <caption className="sr-only">Questions</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={`${TH} w-10`}>
                <input
                  type="checkbox"
                  aria-label="Tout sélectionner"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(visibleIds))}
                  className="size-4 accent-accent"
                />
              </th>
              <th scope="col" className={TH}>Question</th>
              <th scope="col" className={TH}>Statut</th>
              <th scope="col" className={TH}>Ouverture</th>
              <th scope="col" className={TH}>Clôture</th>
              <th scope="col" className={TH}>Résultat prévu</th>
              <th scope="col" className={`${TH} text-right`}>Pronos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-b-0">
                <td className={TD}>
                  <input
                    type="checkbox"
                    aria-label={`Sélectionner « ${row.title} »`}
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    className="size-4 accent-accent"
                  />
                </td>
                <th scope="row" className={`${TD} font-normal`}>
                  <Link href={`/admin/questions/${row.id}`} className="font-semibold text-ink hover:text-accent-text hover:underline">
                    {row.title}
                  </Link>
                  <p className="text-[13px] text-muted">
                    {row.categoryName} · {row.kindLabel} · coef. ×{row.coefficient}
                    {row.seasonLabel ? ` · saison ${row.seasonLabel}` : ""}
                  </p>
                </th>
                <td className={TD}>
                  <QuestionStatusChip status={row.status} />
                </td>
                <td className={`${TD} whitespace-nowrap`}>{row.opensLabel ?? "—"}</td>
                <td className={`${TD} whitespace-nowrap`}>{row.closesLabel ?? "—"}</td>
                <td className={`${TD} whitespace-nowrap`}>{row.expectedLabel ?? "—"}</td>
                <td className={`${TD} text-right tabular-nums`}>{row.predictionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>

      <Dialog open={datesOpen} onClose={() => setDatesOpen(false)} title="Définir les dates">
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            applyDates(new FormData(event.currentTarget));
          }}
        >
          <p className="text-[15px] text-ink-2">
            Mêmes dates pour {formatCount(selection.length, "question sélectionnée", "questions sélectionnées")}, en{" "}
            <strong>heure de Paris</strong>. Les questions qui ont déjà des pronos gardent les leurs.
          </p>
          <Field name="opensAt" id="series-opensAt" type="datetime-local" label="Ouverture" error={dateErrors.opensAt} />
          <Field name="closesAt" id="series-closesAt" type="datetime-local" label="Clôture" error={dateErrors.closesAt} />
          <Field
            name="expectedResultAt"
            id="series-expectedResultAt"
            type="datetime-local"
            label="Résultat prévu (facultatif)"
            hint="Vide : chaque question garde sa date de résultat prévue."
            error={dateErrors.expectedResultAt}
          />
          <FormMessage
            feedback={dateErrors.form || dateErrors.questionIds ? { tone: "error", text: dateErrors.form ?? dateErrors.questionIds } : null}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setDatesOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" pending={pending}>
              Appliquer
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
