import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatars/Avatar";
import { QuestionActions } from "@/components/admin/QuestionActions";
import { QuestionForm, type QuestionFormLocks } from "@/components/admin/QuestionForm";
import { QuestionStatusChip } from "@/components/admin/QuestionStatusChip";
import { ResultForm } from "@/components/admin/ResultForm";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { FormMessage } from "@/components/ui/FormMessage";
import { requireAdmin } from "@/lib/auth/session";
import { type AdminQuestion, getAdminQuestion, type TrackingRow } from "@/lib/data/admin";
import { getDb } from "@/lib/db/client";
import { formatCount, formatDateTime, formatNumber } from "@/lib/format";
import { ERROR_MESSAGES } from "@/lib/services/result";
import { NO_SEASON_YET } from "@/lib/validation/question";
import type { PredictionState } from "@/lib/game/prediction-state";
import { utcToParisLocalInput } from "@/lib/game/time";
import { QUESTION_KIND_LABELS } from "@/lib/validation/question";

export const metadata: Metadata = { title: "Question" };

const SECTION_TITLE = "font-display text-[26px] font-extrabold uppercase leading-none";
const TH = "px-3 py-2 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-muted";
const TD = "px-3 py-2.5 align-middle";

const CONTENT_LOCKS = {
  QUESTION_LOCKED:
    "Des pronos existent : le type, l'énoncé, la description, l'unité, les réponses, la source et le coefficient ne peuvent plus changer. Pour les modifier, annule la question et crée une nouvelle question.",
  QUESTION_CLOSED: "La question est clôturée : seuls la catégorie, l'aide et la date de résultat prévue peuvent encore changer.",
  QUESTION_CANCELLED: "La question est annulée : elle ne peut plus être modifiée.",
} as const;

const DATE_LOCKS = {
  QUESTION_LOCKED: "Des pronos existent : l'ouverture ne peut plus changer.",
  QUESTION_CLOSED: "La question est clôturée.",
  QUESTION_CANCELLED: "La question est annulée.",
} as const;

/** Reasons shown next to the locked fields (§5.11). */
function formLocks({ rules }: AdminQuestion): QuestionFormLocks {
  const reason = (code: string | null) => (code ? (CONTENT_LOCKS[code as keyof typeof CONTENT_LOCKS] ?? null) : null);
  const dateReason = (code: string | null) => (code ? (DATE_LOCKS[code as keyof typeof DATE_LOCKS] ?? null) : null);
  return {
    content: reason(rules.content),
    other: reason(rules.other),
    opensAt: dateReason(rules.opensAt),
    closesAt: dateReason(rules.closesAt),
    closesHint: rules.closesLaterOnly ? "Des pronos existent : la clôture peut seulement être repoussée, dans la même saison." : null,
  };
}

const localInput = (date: Date | null) => (date ? utcToParisLocalInput(date) : "");

/** Why the question cannot be published for lack of a season (§5.13), or null. */
function seasonNotice({ question: q, seasonsExist }: AdminQuestion): string | null {
  if (q.status === "cancelled") return null;
  if (!seasonsExist) return NO_SEASON_YET;
  return q.closesAt && q.seasonLabel === null ? ERROR_MESSAGES.NO_SEASON : null;
}

const STATE_LABELS: Record<PredictionState, { text: string; className: string }> = {
  todo: { text: "À faire", className: "text-hot" },
  saved: { text: "Enregistré", className: "text-warn" },
  validated: { text: "Validé", className: "text-accent-text" },
};

function StateLabel({ state }: { state: PredictionState }) {
  const { text, className } = STATE_LABELS[state];
  return (
    <span className={`inline-flex items-center gap-1.5 font-display text-[15px] font-extrabold uppercase tracking-[0.06em] ${className}`}>
      {state === "validated" ? <Lock aria-hidden size={14} strokeWidth={2.4} /> : null}
      {text}
    </span>
  );
}

function answerText(row: TrackingRow, detail: AdminQuestion): string {
  if (!row.answer) return "—";
  const { valueNumber, optionId } = row.answer;
  if (valueNumber !== null) {
    const unit = detail.question.unit;
    return unit ? `${formatNumber(valueNumber)} ${unit}` : formatNumber(valueNumber);
  }
  return detail.options.find(({ id }) => id === optionId)?.label ?? "—";
}

function Tracking({ detail, rows }: { detail: AdminQuestion; rows: TrackingRow[] }) {
  const revealed = rows.some(({ answer }) => answer !== null);
  const active = rows.filter(({ inactive }) => !inactive);
  const validated = active.filter(({ state }) => state === "validated").length;
  return (
    <Card as="section" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="suivi" className={SECTION_TITLE}>
          Suivi
        </h2>
        <p className="font-display text-xl font-bold tabular-nums">
          Validés {validated} / {active.length}
        </p>
      </div>
      {!revealed ? (
        <p className="text-[15px] text-ink-2">
          Avant la clôture, seuls les états sont visibles : personne ne voit les valeurs, pas même l&apos;admin.
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-140 text-left text-[15px]">
          <caption className="sr-only">Suivi des joueurs</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={TH}>Joueur</th>
              <th scope="col" className={TH}>État</th>
              <th scope="col" className={TH}>Validé le</th>
              {revealed ? (
                <>
                  <th scope="col" className={TH}>Prono</th>
                  <th scope="col" className={TH}>Joker</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId} className="border-b border-line last:border-b-0">
                <th scope="row" className={`${TD} font-semibold`}>
                  <span className="flex items-center gap-2.5 whitespace-nowrap">
                    <Avatar avatar={row.avatar} name={row.name} size={32} />
                    {row.name}
                    {row.inactive ? <span className="font-normal text-muted">(inactif)</span> : null}
                  </span>
                </th>
                <td className={TD}>
                  <StateLabel state={row.state} />
                </td>
                <td className={`${TD} whitespace-nowrap text-muted`}>{row.validatedAt ? formatDateTime(row.validatedAt) : "—"}</td>
                {revealed ? (
                  <>
                    <td className={`${TD} whitespace-nowrap tabular-nums`}>{answerText(row, detail)}</td>
                    <td className={TD}>{row.answer?.joker ? "Joker" : "—"}</td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const NOTICES: Record<string, string> = {
  creee: "Question créée en brouillon. Complète ses dates, puis publie-la.",
  copie: "Copie créée en brouillon, sans dates.",
};

/** One question: actions, result, follow-up and form (architecture §8.3). */
export default async function QuestionAdminPage({ params, searchParams }: PageProps<"/admin/questions/[id]">) {
  const viewer = await requireAdmin();
  const { id } = await params;
  const questionId = Number(id);
  if (!Number.isInteger(questionId) || questionId <= 0) notFound();
  const detail = await getAdminQuestion(getDb(), viewer, questionId, new Date());
  if (!detail) notFound();

  const query = await searchParams;
  const notice = Object.keys(NOTICES).find((key) => query[key] !== undefined);
  const { question: q, options, predictionCount } = detail;
  const status = q.computedStatus;
  const hasResultForm = status === "closed" || status === "resolved";

  return (
    <>
      <Link href="/admin/questions" className="self-start text-[15px] font-semibold text-accent-text hover:underline">
        ← Questions
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <QuestionStatusChip status={status} />
          <Chip>{q.categoryName}</Chip>
          <Chip tone="outline">Coef ×{q.coefficient}</Chip>
          {q.priceIsRight ? <Chip tone="outline">Juste Prix</Chip> : null}
        </div>
        <h1 className="font-display text-[32px] font-extrabold uppercase leading-tight">{q.title}</h1>
        <p className="text-[15px] text-muted">
          {QUESTION_KIND_LABELS[q.kind]} ·{" "}
          {q.seasonLabel ? `saison ${q.seasonLabel}` : q.closesAt ? "aucune saison ne couvre sa clôture" : "sans saison tant qu'il n'y a pas de clôture"} ·{" "}
          {formatCount(predictionCount, "prono")}
          {q.duplicatedFrom ? (
            <>
              {" "}
              · copie de{" "}
              <Link href={`/admin/questions/${q.duplicatedFrom.id}`} className="text-accent-text hover:underline">
                « {q.duplicatedFrom.title} »
              </Link>
            </>
          ) : null}
        </p>
        {q.cancelledAt ? <p className="text-[15px] font-semibold text-hot">Annulée le {formatDateTime(q.cancelledAt)}.</p> : null}
      </header>

      <FormMessage feedback={notice ? { tone: "success", text: NOTICES[notice] } : null} />
      <QuestionActions
        questionId={q.id}
        canCancel={q.status === "published"}
        canDelete={q.status === "draft" && predictionCount === 0}
      />

      {hasResultForm ? (
        <Card as="section" className="flex flex-col gap-4">
          <h2 id="resultat" className={SECTION_TITLE}>
            Résultat
          </h2>
          <p className="text-[15px] text-ink-2">
            {q.resolvedAt ? `Résolue le ${formatDateTime(q.resolvedAt)}.` : "La question est clôturée : saisis la valeur réelle dès qu'elle est connue."}
            {q.correctedAt ? ` Résultat corrigé le ${formatDateTime(q.correctedAt)}.` : ""}
            {!q.resolvedAt && q.expectedResultAt ? ` Résultat prévu le ${formatDateTime(q.expectedResultAt)}.` : ""}
          </p>
          <p className="text-[15px] text-ink-2">Source : {q.source}</p>
          <ResultForm
            questionId={q.id}
            type={q.type}
            unit={q.unit}
            options={options}
            currentValue={q.resultNumber === null ? "" : String(q.resultNumber).replace(".", ",")}
            currentOptionId={q.resultOptionId}
            resolved={q.resolvedAt !== null}
          />
        </Card>
      ) : null}

      {detail.tracking ? <Tracking detail={detail} rows={detail.tracking} /> : null}

      <QuestionForm
        key={q.id}
        questionId={q.id}
        categories={detail.categories}
        locks={formLocks(detail)}
        canPublish={q.status === "draft"}
        readOnly={q.status === "cancelled"}
        seasonNotice={seasonNotice(detail)}
        initial={{
          kind: q.kind,
          categoryId: q.categoryId,
          title: q.title,
          description: q.description ?? "",
          unit: q.unit ?? "",
          options: options.map(({ label }) => label),
          source: q.source,
          coefficient: q.coefficient,
          helpBiUrl: q.helpBiUrl ?? "",
          helpLastYear: q.helpLastYear ?? "",
          helpHint: q.helpHint ?? "",
          opensAt: localInput(q.opensAt),
          closesAt: localInput(q.closesAt),
          expectedResultAt: localInput(q.expectedResultAt),
        }}
      />
    </>
  );
}
