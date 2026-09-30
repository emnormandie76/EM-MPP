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
import { formatDateTime } from "@/lib/format";
import { QUESTION_KIND_LABELS } from "@/lib/validation/question";

export const metadata: Metadata = { title: "Questions" };

/** Tabs of /questions, in the address (`?onglet=resolues`). */
const TABS: { key: string; tab: QuestionListTab; label: string; empty: string }[] = [
  { key: "ouvertes", tab: "open", label: "Ouvertes", empty: "Aucune question ouverte pour l'instant." },
  { key: "en-attente", tab: "closed", label: "En attente du résultat", empty: "Aucune question en attente de son résultat." },
  { key: "resolues", tab: "resolved", label: "Résolues", empty: "Aucune question résolue pour l'instant." },
  { key: "annulees", tab: "cancelled", label: "Annulées", empty: "Aucune question annulée." },
];

function Dates({ item }: { item: QuestionListItem }) {
  switch (item.status) {
    case "open":
      return <>Clôture {formatDateTime(item.closesAt)}</>;
    case "closed":
      return <>{item.expectedResultAt ? `Résultat attendu ${formatDateTime(item.expectedResultAt)}` : `Clôturée ${formatDateTime(item.closesAt)}`}</>;
    case "resolved":
      return <>{item.resolvedAt ? `Résolue ${formatDateTime(item.resolvedAt)}` : "Résolue"}</>;
    case "cancelled":
      return <>{item.cancelledAt ? `Annulée ${formatDateTime(item.cancelledAt)}` : "Annulée"}</>;
  }
}

function QuestionItem({ item }: { item: QuestionListItem }) {
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
          {QUESTION_KIND_LABELS[item.kind]} · coef. ×{item.coefficient} · <Dates item={item} />
        </p>
      </div>
      {item.status === "resolved" ? (
        <p className="font-display text-[26px] leading-none font-extrabold tabular-nums">
          {item.myPoints === null ? (
            <span className="text-base font-bold uppercase tracking-[0.06em] text-muted">Pas de prono</span>
          ) : (
            <>
              <span className="text-accent-text">{item.myPoints}</span>
              <span className="ml-1 text-sm font-bold uppercase tracking-[0.06em] text-muted">pts</span>
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
  const { counts, items } = await getQuestionsList(getDb(), viewer, current.tab, new Date());

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
            <QuestionItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </>
  );
}
