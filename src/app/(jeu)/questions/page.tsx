import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { QuestionStatusChip } from "@/components/admin/QuestionStatusChip";
import { StatusChip } from "@/components/game/StatusChip";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "@/components/ui/Tabs";
import { requireUser } from "@/lib/auth/session";
import { getQuestionsList, type QuestionListItem, type QuestionListTab } from "@/lib/data/questions";
import { getDb } from "@/lib/db/client";
import { formatDateTime, formatMalus } from "@/lib/format";
import { QUESTION_KIND_LABELS } from "@/lib/validation/question";

export const metadata: Metadata = { title: "Questions" };

/** Tabs of /questions, in the address (`?onglet=resolues`). */
const TABS: { key: string; tab: QuestionListTab; label: string; empty: string }[] = [
  { key: "ouvertes", tab: "open", label: "Ouvertes", empty: "Aucune question ouverte pour l'instant." },
  { key: "en-attente", tab: "closed", label: "En attente du résultat", empty: "Aucune question en attente de son résultat." },
  { key: "resolues", tab: "resolved", label: "Résolues", empty: "Aucune question résolue pour l'instant." },
  { key: "annulees", tab: "cancelled", label: "Annulées", empty: "Aucune question annulée." },
];

/** The questions of past seasons are listed too: their dates carry the year (R-08). */
function Dates({ item, now }: { item: QuestionListItem; now: Date }) {
  switch (item.status) {
    case "open":
      return item.extendedUntil ? <>Prolongée pour toi jusqu&apos;au {formatDateTime(item.extendedUntil, now)}</> : <>Clôture {formatDateTime(item.closesAt, now)}</>;
    case "closed":
      return (
        <>
          {item.expectedResultAt
            ? `Résultat attendu ${formatDateTime(item.expectedResultAt, now)}`
            : `Clôturée ${formatDateTime(item.closesAt, now)}`}
        </>
      );
    case "resolved":
      return <>{item.resolvedAt ? `Résolue ${formatDateTime(item.resolvedAt, now)}` : "Résolue"}</>;
    case "cancelled":
      return <>{item.cancelledAt ? `Annulée ${formatDateTime(item.cancelledAt, now)}` : "Annulée"}</>;
  }
}

function QuestionItem({ item, now }: { item: QuestionListItem; now: Date }) {
  return (
    <li className="flex flex-col gap-3 rounded-card border border-line bg-surface px-4.5 py-4 lg:flex-row lg:items-center lg:gap-5">
      <div className="flex min-w-0 grow flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{item.categoryName}</Chip>
        </div>
        <h2 className="text-lg font-semibold">
          <Link href={`/questions/${item.id}`} className="hover:text-accent-text hover:underline">
            {item.title}
          </Link>
        </h2>
        <p className="text-sm text-muted">
          {QUESTION_KIND_LABELS[item.kind]} · coef. ×{item.coefficient} · <Dates item={item} now={now} />
        </p>
      </div>
      {item.status === "resolved" ? (
        <p className="font-display text-[26px] leading-none font-extrabold tabular-nums">
          {item.myMalus === null ? (
            <span className="text-base font-bold uppercase tracking-[0.06em] text-muted">Pas de prono</span>
          ) : (
            <>
              {item.absent ? <span className="mr-2 text-base font-bold uppercase tracking-[0.06em] text-muted">Pas de prono ·</span> : null}
              <span className="text-accent-text">{formatMalus(item.myMalus)}</span>{" "}
              <span className="text-sm font-bold uppercase tracking-[0.06em] text-muted">de malus</span>
            </>
          )}
        </p>
      ) : null}
      {item.status === "open" ? <StatusChip state={item.state} /> : <QuestionStatusChip status={item.status} />}
    </li>
  );
}

/** Questions (architecture §8.3): open ones, waiting for their result, resolved, cancelled. */
export default async function QuestionsPage({ searchParams }: PageProps<"/questions">) {
  const viewer = await requireUser();
  const { onglet } = await searchParams;
  const current = TABS.find(({ key }) => key === onglet) ?? TABS[0];
  const now = new Date();
  const { counts, items } = await getQuestionsList(getDb(), viewer, current.tab, now);

  return (
    <>
      <h1 className="font-display text-[44px] leading-none font-extrabold uppercase">Questions</h1>
      <Tabs
        label="Questions par état"
        items={TABS.map(({ key, tab, label }) => ({
          href: key === "ouvertes" ? "/questions" : `/questions?onglet=${key}`,
          label,
          count: counts[tab],
          current: tab === current.tab,
        }))}
      />
      {items.length === 0 ? (
        <EmptyState icon={ListChecks}>{current.empty}</EmptyState>
      ) : (
        <ul aria-label={current.label} className="flex flex-col gap-3">
          {items.map((item) => (
            <QuestionItem key={item.id} item={item} now={now} />
          ))}
        </ul>
      )}
    </>
  );
}
