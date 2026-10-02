import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import type { PlayerQuestion } from "@/lib/data/questions";
import { malusText } from "@/lib/format";
import type { PredictionState } from "@/lib/game/prediction-state";
import { toHundredths } from "@/lib/game/scoring";
import { QUESTION_KIND_LABELS } from "@/lib/validation/question";
import { Countdown } from "./Countdown";
import { ExtendedChip, NewChip } from "./NewChip";
import { StatusChip } from "./StatusChip";

const ACTIONS: Record<PredictionState, { label: string; variant: "primary" | "secondary" }> = {
  todo: { label: "Pronostiquer", variant: "primary" },
  saved: { label: "Modifier", variant: "secondary" },
  validated: { label: "Voir", variant: "secondary" },
};

/**
 * An open question (§8.2): category, badge, title, kind (with the malus of a wrong answer for a
 * choice), countdown to the viewer's deadline (their extension's, v1.2), state and the way to its page.
 */
export function QuestionCard({ question: q, serverNow, headingLevel = 3 }: { question: PlayerQuestion; serverNow: number; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const action = ACTIONS[q.state];
  const titleId = `question-${q.id}-titre`;
  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-card border border-line bg-surface px-4.5 py-4 lg:flex-row lg:items-center lg:gap-5"
    >
      <div className="flex min-w-0 grow flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Chip>{q.categoryName}</Chip>
          {q.extendedUntil ? <ExtendedChip /> : q.isNew ? <NewChip /> : null}
        </div>
        <Heading id={titleId} className="text-lg font-semibold">
          {q.title}
        </Heading>
        <p className="text-sm text-muted">
          {QUESTION_KIND_LABELS[q.kind]} · coef. ×{q.coefficient}
          {q.wrongAnswerMalus !== null ? ` · mauvaise réponse : ${malusText(toHundredths(q.wrongAnswerMalus))}` : ""}
        </p>
      </div>
      <div className="hidden lg:block">
        <Countdown closesAt={q.deadline.getTime()} serverNow={serverNow} />
      </div>
      <div className="lg:hidden">
        <Countdown closesAt={q.deadline.getTime()} serverNow={serverNow} variant="compact" />
      </div>
      <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap lg:gap-5">
        <StatusChip state={q.state} />
        <Link href={`/questions/${q.id}`} className={buttonClasses({ variant: action.variant, className: "w-34" })}>
          {action.label}
          <span className="sr-only"> : {q.title}</span>
        </Link>
      </div>
    </article>
  );
}
