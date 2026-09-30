import { Ban } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuestionStatusChip } from "@/components/admin/QuestionStatusChip";
import { Countdown } from "@/components/game/Countdown";
import { hasHelp, HelpPanel } from "@/components/game/HelpPanel";
import { PredictionForm } from "@/components/game/PredictionForm";
import { predictionFormProps } from "@/components/game/prediction-form-props";
import { StatusChip } from "@/components/game/StatusChip";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { requireUser } from "@/lib/auth/session";
import { getQuestionDetail, type QuestionDetail } from "@/lib/data/questions";
import { getDb } from "@/lib/db/client";
import { formatDateTime, formatNumber } from "@/lib/format";
import { JOKER_MULTIPLIER } from "@/lib/game/constants";

export const metadata: Metadata = { title: "Question" };

const LABEL = "font-display text-[15px] font-bold uppercase tracking-[0.08em] text-muted";

function answerText(q: QuestionDetail, answer: { valueNumber: number | null; optionId: number | null }): string {
  if (answer.valueNumber !== null) return q.unit ? `${formatNumber(answer.valueNumber)} ${q.unit}` : formatNumber(answer.valueNumber);
  return q.options.find(({ id }) => id === answer.optionId)?.label ?? "—";
}

/** After the closing: my prediction, and the result once known. The full results arrive in step 7. */
function Closed({ q }: { q: QuestionDetail }) {
  return (
    <Card as="section" className="flex flex-col gap-4">
      {q.result ? (
        <div className="flex flex-col gap-1">
          <h2 className={LABEL}>Résultat</h2>
          <p className="font-display text-[40px] leading-none font-extrabold tabular-nums">{answerText(q, q.result)}</p>
          {q.correctedAt ? <p className="text-sm text-muted">Résultat corrigé le {formatDateTime(q.correctedAt)}.</p> : null}
        </div>
      ) : (
        <p className="text-[15px] text-ink-2">
          La question est clôturée.
          {q.expectedResultAt ? ` Résultat attendu le ${formatDateTime(q.expectedResultAt)}.` : " Le résultat sera publié dès qu'il sera connu."}
        </p>
      )}
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

/** One question (architecture §8.3). Draft, scheduled or cancelled before opening: 404. */
export default async function QuestionPage({ params }: PageProps<"/questions/[id]">) {
  const viewer = await requireUser();
  const { id } = await params;
  const questionId = Number(id);
  if (!Number.isInteger(questionId) || questionId <= 0) notFound();
  const now = new Date();
  const q = await getQuestionDetail(getDb(), viewer, questionId, now);
  if (!q) notFound();

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
        {q.status === "open" ? <p className="text-sm text-muted">Clôture {formatDateTime(q.closesAt)}</p> : null}
      </header>

      {q.status === "cancelled" ? (
        <p role="status" className="flex items-start gap-2.5 rounded-field border border-hot bg-surface px-4 py-3 text-[15px] font-semibold text-hot">
          <Ban aria-hidden size={18} strokeWidth={2.2} className="mt-0.5 shrink-0" />
          Question annulée : aucun point n&apos;est attribué et les jokers sont rendus.
        </p>
      ) : q.status === "open" ? (
        <div className={`grid gap-5 ${hasHelp(q.help) ? "lg:grid-cols-2" : ""}`}>
          <Card as="section" className="flex flex-col gap-4">
            <PredictionForm {...predictionFormProps(q)} />
          </Card>
          <HelpPanel help={q.help} />
        </div>
      ) : (
        <Closed q={q} />
      )}
    </>
  );
}
