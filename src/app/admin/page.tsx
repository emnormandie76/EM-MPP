import { Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatars/Avatar";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { adminMetadata, requireAdmin } from "@/lib/auth/session";
import { getAdminDashboard } from "@/lib/data/admin";
import { getDb } from "@/lib/db/client";
import { formatCount, formatDateTime } from "@/lib/format";
import type { PredictionState } from "@/lib/game/prediction-state";

export async function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Back-office");
}

const SECTION_TITLE = "font-display text-[26px] font-extrabold uppercase leading-none";
const QUESTION_LINK = "text-[17px] font-semibold text-ink hover:text-accent-text hover:underline";

const STATES: Record<PredictionState, { text: string; className: string }> = {
  todo: { text: "à faire", className: "text-hot" },
  saved: { text: "enregistré", className: "text-warn" },
  validated: { text: "validé", className: "text-accent-text" },
};

/**
 * Dashboard (architecture §8.3): open questions to follow, questions to resolve (blocked while an
 * extension runs), running extensions (v1.2), next openings.
 */
export default async function AdminPage() {
  const viewer = await requireAdmin();
  const now = new Date();
  const { open, toResolve, extensions, upcoming } = await getAdminDashboard(getDb(), viewer, now);

  return (
    <>
      <h1 className="font-display text-[44px] font-extrabold uppercase leading-none">Tableau de bord</h1>

      <Card as="section" className="flex flex-col gap-4">
        <h2 className={SECTION_TITLE}>Questions ouvertes</h2>
        {open.length === 0 ? (
          <p className="text-[15px] text-ink-2">Aucune question ouverte en ce moment.</p>
        ) : (
          <>
            <p className="text-[15px] text-ink-2">
              Pour relancer les retardataires à ta façon (Teams, à l&apos;oral). Seuls les états sont visibles avant la clôture.
            </p>
            <ul className="flex flex-col gap-3">
              {open.map((q) => (
                <li key={q.id} className="flex flex-col gap-2.5 rounded-card bg-raised p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <Chip className="self-start">{q.categoryName}</Chip>
                      <Link href={`/admin/questions/${q.id}`} className={QUESTION_LINK}>
                        {q.title}
                      </Link>
                      <p className="flex items-center gap-1.5 text-sm text-muted">
                        <Clock aria-hidden size={14} strokeWidth={2.2} />
                        Clôture {formatDateTime(q.closesAt, now)}
                      </p>
                    </div>
                    <p className="font-display text-[26px] font-extrabold tabular-nums leading-none">
                      <span className="sr-only">Validés : </span>
                      {q.validated} / {q.total}
                      <span className="ml-1.5 text-sm font-bold uppercase tracking-[0.06em] text-muted" aria-hidden>
                        validés
                      </span>
                    </p>
                  </div>
                  {q.laggards.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-sm font-semibold text-ink-2">Pas encore validé :</p>
                      <ul className="flex flex-wrap gap-2">
                        {q.laggards.map((player) => (
                          <li key={player.id} className="flex items-center gap-1.5 rounded-pill bg-surface py-1 pr-3 pl-1 text-sm">
                            <Avatar avatar={player.avatar} name={player.name} size={24} />
                            <span className="font-semibold">{player.name}</span>
                            <span className={player.state === "todo" ? "text-hot" : "text-warn"}>
                              {player.state === "todo" ? "à faire" : "enregistré"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-up">Tout le monde a validé.</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card as="section" className="flex flex-col gap-4">
          <h2 className={SECTION_TITLE}>À résoudre</h2>
          {toResolve.length === 0 ? (
            <p className="text-[15px] text-ink-2">Aucune question clôturée en attente de son résultat.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {toResolve.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 last:border-b-0 last:pb-0">
                  <div className="flex flex-col gap-0.5">
                    <Link href={`/admin/questions/${q.id}`} className={QUESTION_LINK}>
                      {q.title}
                    </Link>
                    <p className="text-sm text-muted">
                      Clôturée {formatDateTime(q.closesAt, now)}
                      {q.expectedResultAt ? ` · résultat prévu ${formatDateTime(q.expectedResultAt, now)}` : ""}
                    </p>
                  </div>
                  {q.blocker ? (
                    <Button variant="secondary" disabled aria-label={`Saisir le résultat de « ${q.title} »`} aria-describedby={`blocage-${q.id}`}>
                      Saisir le résultat
                    </Button>
                  ) : (
                    <Link
                      href={`/admin/questions/${q.id}#resultat`}
                      className={buttonClasses({ variant: "secondary" })}
                      aria-label={`Saisir le résultat de « ${q.title} »`}
                    >
                      Saisir le résultat
                    </Link>
                  )}
                  {q.blocker ? (
                    <p id={`blocage-${q.id}`} className="basis-full text-sm text-ink-2">
                      {q.blocker}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card as="section" aria-labelledby="prolongations" className="flex flex-col gap-4">
          <h2 id="prolongations" className={SECTION_TITLE}>
            Prolongations en cours
          </h2>
          {extensions.length === 0 ? (
            <p className="text-[15px] text-ink-2">Aucune prolongation en cours.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {extensions.map((item) => (
                <li key={`${item.questionId}-${item.player.id}`} className="flex flex-col gap-1 border-b border-line pb-3 last:border-b-0 last:pb-0">
                  <Link href={`/admin/questions/${item.questionId}#suivi`} className={QUESTION_LINK}>
                    {item.questionTitle}
                  </Link>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <Avatar avatar={item.player.avatar} name={item.player.name} size={24} />
                    <span className="font-semibold">{item.player.name}</span>
                    <span className="text-muted">jusqu&apos;au {formatDateTime(item.closesAt, now)}</span>
                    <span className={`font-semibold ${STATES[item.state].className}`}>{STATES[item.state].text}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card as="section" className="flex flex-col gap-4">
          <h2 className={SECTION_TITLE}>Prochaines ouvertures</h2>
          {upcoming.length === 0 ? (
            <p className="text-[15px] text-ink-2">Aucune question programmée.</p>
          ) : (
            <>
              <p className="text-[15px] text-ink-2">{formatCount(upcoming.length, "question programmée", "questions programmées")}.</p>
              <ul className="flex flex-col gap-3">
                {upcoming.map((q) => (
                  <li key={q.id} className="flex flex-col gap-0.5 border-b border-line pb-3 last:border-b-0 last:pb-0">
                    <Link href={`/admin/questions/${q.id}`} className={QUESTION_LINK}>
                      {q.title}
                    </Link>
                    <p className="text-sm text-muted">
                      Ouverture {formatDateTime(q.opensAt, now)} · clôture {formatDateTime(q.closesAt, now)}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
