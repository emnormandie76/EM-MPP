import { Info } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PrizesEditor } from "@/components/admin/PrizesEditor";
import { ProclaimButton } from "@/components/admin/ProclaimButton";
import { SeasonActions, SeasonCreateForm } from "@/components/admin/SeasonForms";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { adminMetadata, requireAdmin } from "@/lib/auth/session";
import { type AdminSeason, getSeasonsAdmin } from "@/lib/data/admin";
import { getDb } from "@/lib/db/client";
import { formatDate, formatDateTime } from "@/lib/format";
import { utcToParisLocalDate } from "@/lib/game/time";

export async function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Saisons et lots");
}

const SECTION_TITLE = "font-display text-[26px] font-extrabold uppercase leading-none";

/** "du 28 sept. 2026 au 5 sept. 2027", or "depuis le 28 sept. 2026" for the last season. */
function datesOf(season: AdminSeason, now: Date): string {
  if (season.endsAt) {
    // The end is exclusive (00:00 on the next start day): the last day is the day before.
    return `du ${formatDate(season.startsAt)} au ${formatDate(new Date(season.endsAt.getTime() - 1))}`;
  }
  return `${season.startsAt > now ? "à partir du" : "depuis le"} ${formatDate(season.startsAt)}`;
}

function deleteBlocked(season: AdminSeason): string | null {
  if (season.proclaimedAt) return "Saison proclamée : elle ne peut pas être supprimée.";
  if (season.questionsAttached > 0) return "Des questions sont rattachées à cette saison : elle ne peut pas être supprimée.";
  return null;
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-field bg-raised px-4 py-3 text-[15px] text-ink-2">
      <Info aria-hidden size={18} strokeWidth={2.2} className="mt-0.5 shrink-0 text-accent-text" />
      <span>{children}</span>
    </p>
  );
}

/**
 * Seasons created by the admin, their prizes and the proclamation of their final standings
 * (architecture §5.12, §5.13, §8.3).
 */
export default async function SeasonsAdminPage() {
  const viewer = await requireAdmin();
  const now = new Date();
  const { seasons, current, remindNext, suggestedStart, suggestedLabel } = await getSeasonsAdmin(getDb(), viewer, now);

  return (
    <>
      <h1 className="font-display text-[44px] font-extrabold uppercase leading-none">Saisons et lots</h1>
      <p className="text-[15px] text-ink-2">
        Une saison commence à 0 h, heure de Paris, le jour que tu choisis, et se termine quand la suivante commence : la
        bascule se fait toute seule. Une question appartient à la saison de sa date de clôture.
      </p>

      {seasons.length === 0 ? (
        <Notice>
          Aucune saison pour l&apos;instant. Crée la première : sans saison, les questions s&apos;enregistrent en brouillon
          mais ne peuvent pas être publiées.
        </Notice>
      ) : null}
      {seasons.length > 0 && !current ? (
        <Notice>Aucune saison n&apos;est en cours : la première commence le {formatDate(seasons.at(-1)!.startsAt)}.</Notice>
      ) : null}
      {remindNext && current ? (
        <Notice>
          La saison {current.label} est la dernière créée : pense à créer la suivante avant la prochaine rentrée. Elle
          commencera toute seule à sa date de début, et d&apos;ici là la saison {current.label} continue.
        </Notice>
      ) : null}

      <Card as="section" className="flex flex-col gap-4">
        <h2 className={SECTION_TITLE}>Nouvelle saison</h2>
        <SeasonCreateForm suggestedStart={suggestedStart} suggestedLabel={suggestedLabel} />
      </Card>

      {seasons.map((season) => (
        <Card as="section" key={season.id} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className={SECTION_TITLE}>Saison {season.label}</h2>
            {season.isCurrent ? <Chip tone="accent">En cours</Chip> : null}
          </div>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-1 text-[15px] sm:grid-cols-[auto_1fr]">
            <dt className="text-muted">Dates</dt>
            <dd>{datesOf(season, now)}</dd>
            <dt className="text-muted">Questions résolues</dt>
            <dd className="tabular-nums">
              {season.questionsResolved} / {season.questionsTotal}
            </dd>
            <dt className="text-muted">Classement final</dt>
            <dd>{season.proclaimedAt ? `Proclamé le ${formatDateTime(season.proclaimedAt, now)}` : "Pas encore proclamé"}</dd>
          </dl>
          <ProclaimButton
            seasonId={season.id}
            label={season.label}
            proclaimed={season.proclaimedAt !== null}
            blocker={season.proclamationBlocker}
            lastSeason={season.endsAt === null}
          />
          <SeasonActions
            season={{
              id: season.id,
              label: season.label,
              startsOn: utcToParisLocalDate(season.startsAt),
              proclaimed: season.proclaimedAt !== null,
              prizeCount: season.prizes.length,
            }}
            deleteBlocked={deleteBlocked(season)}
          />
          <h3 className="font-display text-xl font-extrabold uppercase">Lots</h3>
          {season.proclaimedAt ? (
            <>
              <p className="text-[15px] text-ink-2">Le classement est proclamé : les lots ne changent plus.</p>
              {season.prizes.length === 0 ? (
                <p className="text-[15px] text-ink-2">Aucun lot.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-[15px]">
                  {season.prizes.map((prize) => (
                    <li key={prize.id}>
                      <strong>{prize.rankLabel}</strong> : {prize.description}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <PrizesEditor
              seasonId={season.id}
              initial={season.prizes.map(({ rankLabel, description }) => ({ rankLabel, description }))}
            />
          )}
        </Card>
      ))}
    </>
  );
}
