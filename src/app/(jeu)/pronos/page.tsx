import { CalendarClock, Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Countdown } from "@/components/game/Countdown";
import { hasHelp, HelpPanel } from "@/components/game/HelpPanel";
import { ExtendedChip, NewChip } from "@/components/game/NewChip";
import { PredictionForm } from "@/components/game/PredictionForm";
import { predictionFormProps } from "@/components/game/prediction-form-props";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "@/components/ui/Tabs";
import { requireUser } from "@/lib/auth/session";
import { getOpenQuestionsForViewer, type PlayerQuestion } from "@/lib/data/questions";
import { getDb } from "@/lib/db/client";
import { malusText } from "@/lib/format";
import type { PredictionState } from "@/lib/game/prediction-state";
import { toHundredths } from "@/lib/game/scoring";
import { QUESTION_KIND_LABELS } from "@/lib/validation/question";

export const metadata: Metadata = { title: "Mes pronos" };

/** Tabs of /pronos, in the address (`?onglet=a-faire`); without it, every open question (decision of 30/09/2026). */
const TABS = [
  { key: "a-faire", label: "À faire", state: "todo" },
  { key: "enregistres", label: "Enregistrés", state: "saved" },
  { key: "valides", label: "Validés", state: "validated" },
  { key: "tous", label: "Tous", state: null },
] as const satisfies readonly { key: string; label: string; state: PredictionState | null }[];

const EMPTY_TAB: Record<PredictionState, string> = {
  todo: "Tu as un prono sur chaque question ouverte.",
  saved: "Aucun prono enregistré en attente de validation.",
  validated: "Aucun prono validé pour l'instant.",
};

function QuestionRow({ question: q, serverNow }: { question: PlayerQuestion; serverNow: number }) {
  const titleId = `prono-${q.id}-titre`;
  return (
    <article aria-labelledby={titleId} className="grid grid-cols-1 gap-5 rounded-card border border-line bg-surface p-5 lg:grid-cols-2 lg:px-6.5">
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{q.categoryName}</Chip>
          <Chip tone="outline">Coef ×{q.coefficient}</Chip>
          {q.extendedUntil ? <ExtendedChip /> : q.isNew ? <NewChip /> : null}
        </div>
        <h2 id={titleId} className="text-lg font-semibold">
          <Link href={`/questions/${q.id}`} className="hover:text-accent-text hover:underline">
            {q.title}
          </Link>
        </h2>
        <p className="text-sm text-muted">
          {QUESTION_KIND_LABELS[q.kind]}
          {q.wrongAnswerMalus !== null ? ` · mauvaise réponse : ${malusText(toHundredths(q.wrongAnswerMalus))}` : ""}
        </p>
        {/* Until the viewer's own deadline while their extension runs (v1.2). */}
        <Countdown closesAt={q.deadline.getTime()} serverNow={serverNow} variant="compact" />
        {hasHelp(q.help) ? (
          <details className="group mt-1">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-button border border-line-strong px-3 py-1.5 font-display text-base font-bold uppercase tracking-[0.06em] text-ink-2 hover:bg-chip [&::-webkit-details-marker]:hidden">
              <Lightbulb aria-hidden size={16} strokeWidth={2.2} />
              Pour t&apos;aider
            </summary>
            <div className="mt-3">
              <HelpPanel help={q.help} title={false} />
            </div>
          </details>
        ) : null}
      </div>
      <PredictionForm {...predictionFormProps(q)} />
    </article>
  );
}

/** Mes pronos (architecture §8.3): every open question with its form, to fill the campaign at once. */
export default async function PronosPage({ searchParams }: PageProps<"/pronos">) {
  const viewer = await requireUser();
  const now = new Date();
  const questions = await getOpenQuestionsForViewer(getDb(), viewer, now);
  const { onglet } = await searchParams;
  const tab = TABS.find(({ key }) => key === onglet) ?? TABS[3];
  const count = (state: PredictionState) => questions.filter((q) => q.state === state).length;
  const shown = tab.state === null ? questions : questions.filter((q) => q.state === tab.state);
  const validated = count("validated");

  return (
    <>
      <h1 className="font-display text-[44px] leading-none font-extrabold uppercase">Mes pronos</h1>
      {questions.length === 0 ? (
        <EmptyState icon={CalendarClock}>Aucune question ouverte pour l&apos;instant. Les prochaines arrivent bientôt.</EmptyState>
      ) : (
        <>
          <Tabs
            label="Filtrer mes pronos"
            items={TABS.map(({ key, label, state }) => ({
              href: key === "tous" ? "/pronos" : `/pronos?onglet=${key}`,
              label,
              count: state === null ? undefined : count(state),
              current: key === tab.key,
            }))}
          />
          {shown.length === 0 && tab.state !== null ? (
            <EmptyState icon={CalendarClock}>{EMPTY_TAB[tab.state]}</EmptyState>
          ) : (
            <div className="flex flex-col gap-4">
              {shown.map((question) => (
                <QuestionRow key={question.id} question={question} serverNow={now.getTime()} />
              ))}
            </div>
          )}
          <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur lg:-mx-12 lg:px-12">
            <p className="font-display text-xl font-bold uppercase tracking-[0.04em] tabular-nums">
              {validated} / {questions.length} validés
            </p>
          </div>
        </>
      )}
    </>
  );
}
