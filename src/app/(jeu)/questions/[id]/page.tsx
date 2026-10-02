import { Ban } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuestionStatusChip } from "@/components/admin/QuestionStatusChip";
import { Countdown } from "@/components/game/Countdown";
import { hasHelp, HelpPanel } from "@/components/game/HelpPanel";
import { ExtendedChip } from "@/components/game/NewChip";
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
import { formatCount, formatDateTime, formatNumber, malusText } from "@/lib/format";
import { JOKER_DIVISOR } from "@/lib/game/constants";
import { toHundredths } from "@/lib/game/scoring";

export const metadata: Metadata = { title: "Question" };

const LABEL = "font-display text-[15px] font-bold uppercase tracking-[0.08em] text-muted";
const SECTION_TITLE = "font-display text-[26px] font-extrabold uppercase leading-none";

function answerText(q: QuestionDetail, answer: { valueNumber: number | null; optionId: number | null }): string {
  if (answer.valueNumber !== null) return q.unit ? `${formatNumber(answer.valueNumber)} ${q.unit}` : formatNumber(answer.valueNumber);
  return q.options.find(({ id }) => id === answer.optionId)?.label ?? "—";
}

/** "Résultat attendu le …", or the result is published as soon as it is known. */
function expectedResult(q: QuestionDetail, now: Date): string {
  return q.expectedResultAt ? ` Résultat attendu le ${formatDateTime(q.expectedResultAt, now)}.` : " Le résultat sera publié dès qu'il sera connu.";
}

/**
 * Other players' extensions running on the question (§6.6): their number and the latest deadline,
 * without names. Their predictions show once they end.
 */
function ExtensionsNote({ q, now }: { q: QuestionDetail; now: Date }) {
  if (!q.othersExtended) return null;
  const { count, until } = q.othersExtended;
  return (
    <p className="rounded-field bg-raised px-3 py-2 text-[15px] text-ink-2">
      Prolongation en cours pour {formatCount(count, "joueur", "joueurs")}, jusqu&apos;au {formatDateTime(until, now)} :{" "}
      {count > 1 ? "leurs pronos s'afficheront ensuite." : "son prono s'affichera ensuite."}
    </p>
  );
}

/** Closed, waiting for the result: my prediction and the expected result date. */
function MyClosedPrediction({ q, now }: { q: QuestionDetail; now: Date }) {
  return (
    <Card as="section" className="flex flex-col gap-4">
      <p className="text-[15px] text-ink-2">
        La question est clôturée.
        {expectedResult(q, now)}
      </p>
      <ExtensionsNote q={q} now={now} />
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
                Joker ÷{JOKER_DIVISOR}
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
 * After the closing (§8.3): the wisdom of the crowd and the predictions the viewer may see; once
 * resolved, the real value, the viewer's malus and everyone's, absent players included. A viewer
 * without a prediction sees nothing before the result (v1.2, decision of 02/10/2026).
 */
function AfterClosing({ q, results, now }: { q: QuestionDetail; results: QuestionResults; now: Date }) {
  const resolved = q.status === "resolved";
  if (!resolved && !q.mine) {
    return (
      <Card as="section" className="flex flex-col gap-4">
        <p className="text-[15px] text-ink-2">
          Tu n&apos;as pas pronostiqué cette question : les pronos s&apos;afficheront au résultat.
          {expectedResult(q, now)}
        </p>
        <ExtensionsNote q={q} now={now} />
      </Card>
    );
  }
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
          <PredictionsTable question={q} rows={results.rows} absents={results.absents} />
        </Card>
      ) : null}
    </>
  );
}

/**
 * One question (architecture §8.3). Draft, scheduled or cancelled before opening: 404. Open for the
 * viewer while their extension runs (v1.2), with their own deadline.
 */
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
          {q.wrongAnswerMalus !== null ? <Chip tone="outline">Mauvaise réponse : {malusText(toHundredths(q.wrongAnswerMalus))}</Chip> : null}
          {q.extendedUntil ? <ExtendedChip /> : null}
          <span className="lg:ml-auto">
            {q.status === "open" ? (
              <Countdown closesAt={q.deadline.getTime()} serverNow={now.getTime()} variant="compact" />
            ) : (
              <QuestionStatusChip status={q.status} />
            )}
          </span>
        </div>
        <h1 className="font-display text-[32px] leading-[1.05] font-extrabold uppercase">{q.title}</h1>
        {q.description ? <p className="text-base whitespace-pre-line text-ink-2">{q.description}</p> : null}
        <p className="text-sm text-muted">Source : {q.source}</p>
        {q.status === "open" ? (
          <p className="text-sm text-muted">
            {q.extendedUntil
              ? `Prolongée pour toi jusqu'au ${formatDateTime(q.extendedUntil, now)} (clôture pour les autres : ${formatDateTime(q.closesAt, now)})`
              : `Clôture ${formatDateTime(q.closesAt, now)}`}
          </p>
        ) : null}
      </header>

      {q.status === "cancelled" ? (
        <p role="status" className="flex items-start gap-2.5 rounded-field border border-hot bg-surface px-4 py-3 text-[15px] font-semibold text-hot">
          <Ban aria-hidden size={18} strokeWidth={2.2} className="mt-0.5 shrink-0" />
          Question annulée : aucun malus n&apos;est attribué et les jokers sont rendus.
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
