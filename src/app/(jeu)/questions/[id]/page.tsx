import { Ban } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuestionStatusChip } from "@/components/admin/QuestionStatusChip";
import { Countdown } from "@/components/game/Countdown";
import { hasHelp, HelpPanel } from "@/components/game/HelpPanel";
import { PredictionForm } from "@/components/game/PredictionForm";
import { PredictionsTable } from "@/components/game/PredictionsTable";
import { predictionFormProps } from "@/components/game/prediction-form-props";
import { ResultPanel } from "@/components/game/ResultPanel";
import { StatusChip } from "@/components/game/StatusChip";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { requireUser } from "@/lib/auth/session";
import { getQuestionDetail, type QuestionDetail } from "@/lib/data/questions";
import { getQuestionResults, type QuestionResults } from "@/lib/data/results";
import { getDb } from "@/lib/db/client";
import { formatDateTime, formatNumber } from "@/lib/format";
import { JOKER_MULTIPLIER } from "@/lib/game/constants";

export const metadata: Metadata = { title: "Question" };

const LABEL = "font-display text-[15px] font-bold uppercase tracking-[0.08em] text-muted";
const SECTION_TITLE = "font-display text-[26px] font-extrabold uppercase leading-none";

function answerText(q: QuestionDetail, answer: { valueNumber: number | null; optionId: number | null }): string {
  if (answer.valueNumber !== null) return q.unit ? `${formatNumber(answer.valueNumber)} ${q.unit}` : formatNumber(answer.valueNumber);
  return q.options.find(({ id }) => id === answer.optionId)?.label ?? "—";
}

/** Closed, waiting for the result: my prediction and the expected result date. */
function MyClosedPrediction({ q, now }: { q: QuestionDetail; now: Date }) {
  return (
    <Card as="section" className="flex flex-col gap-4">
      <p className="text-[15px] text-ink-2">
        La question est clôturée.
        {q.expectedResultAt ? ` Résultat attendu le ${formatDateTime(q.expectedResultAt, now)}.` : " Le résultat sera publié dès qu'il sera connu."}
      </p>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={LABEL}>Ton prono</h2>
          {q.mine ? <StatusChip state="validated" /> : null}
        </div>
        {q.mine ? (
          <p className="font-display text-4xl font-bold tabular-nums">
            {answerText(q, q.mine)}
            {q.mine.joker ? (
              <span className="ml-3 align-middle font-display text-[17px] font-extrabold uppercase tracking-[0.06em] text-accent-text">
                Joker ×{JOKER_MULTIPLIER}
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-[15px] text-ink-2">Tu n&apos;as pas fait de prono sur cette question.</p>
        )}
      </div>
    </Card>
  );
}

/**
 * After the closing (§8.3): the wisdom of the crowd and everyone's predictions; once resolved, the
 * real value, the viewer's points and everyone's points.
 */
function AfterClosing({ q, results, now }: { q: QuestionDetail; results: QuestionResults; now: Date }) {
  const resolved = q.status === "resolved";
  return (
    <>
      {resolved ? null : <MyClosedPrediction q={q} now={now} />}
      <Card as="section" aria-labelledby="resultat" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="resultat" className={SECTION_TITLE}>
            {resolved ? "Résultat" : "Sagesse de la foule"}
          </h2>
          {resolved && q.correctedAt ? <p className="text-sm text-muted">Résultat corrigé le {formatDateTime(q.correctedAt, now)}.</p> : null}
        </div>
        <ResultPanel question={q} results={results} withChartTable={false} />
      </Card>
      {results.rows.length > 0 ? (
        <Card as="section" aria-labelledby="tous-les-pronos" className="flex flex-col gap-3">
          <h2 id="tous-les-pronos" className={SECTION_TITLE}>
            Tous les pronos
          </h2>
          <PredictionsTable question={q} rows={results.rows} />
        </Card>
      ) : null}
    </>
  );
}

/** One question (architecture §8.3). Draft, scheduled or cancelled before opening: 404. */
export default async function QuestionPage({ params }: PageProps<"/questions/[id]">) {
  const viewer = await requireUser();
  const { id } = await params;
  const questionId = Number(id);
  if (!Number.isInteger(questionId) || questionId <= 0) notFound();
  const now = new Date();
  const q = await getQuestionDetail(getDb(), viewer, questionId, now);
  if (!q) notFound();
  const results = await getQuestionResults(getDb(), viewer, q, now);

  return (
    <>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{q.categoryName}</Chip>
          <Chip tone="outline">Coef ×{q.coefficient}</Chip>
          {q.priceIsRight ? <Chip tone="outline">Juste Prix</Chip> : null}
          <span className="lg:ml-auto">
            {q.status === "open" ? (
              <Countdown closesAt={q.closesAt.getTime()} serverNow={now.getTime()} variant="compact" />
            ) : (
              <QuestionStatusChip status={q.status} />
            )}
          </span>
        </div>
        <h1 className="font-display text-[32px] leading-[1.05] font-extrabold uppercase">{q.title}</h1>
        {q.description ? <p className="text-base whitespace-pre-line text-ink-2">{q.description}</p> : null}
        <p className="text-sm text-muted">Source : {q.source}</p>
        {q.status === "open" ? <p className="text-sm text-muted">Clôture {formatDateTime(q.closesAt, now)}</p> : null}
      </header>

      {q.status === "cancelled" ? (
        <p role="status" className="flex items-start gap-2.5 rounded-field border border-hot bg-surface px-4 py-3 text-[15px] font-semibold text-hot">
          <Ban aria-hidden size={18} strokeWidth={2.2} className="mt-0.5 shrink-0" />
          Question annulée : aucun point n&apos;est attribué et les jokers sont rendus.
        </p>
      ) : q.status === "open" ? (
        <div className={`grid grid-cols-1 gap-5 ${hasHelp(q.help) ? "lg:grid-cols-2" : ""}`}>
          <Card as="section" className="flex flex-col gap-4">
            <PredictionForm {...predictionFormProps(q)} />
          </Card>
          <HelpPanel help={q.help} />
        </div>
      ) : results ? (
        <AfterClosing q={q} results={results} now={now} />
      ) : null}
    </>
  );
}
