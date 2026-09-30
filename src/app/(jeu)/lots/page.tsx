import { Gift } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireUser } from "@/lib/auth/session";
import { getCurrentSeason, getPrizes } from "@/lib/data/content";
import { getDb } from "@/lib/db/client";

export const metadata: Metadata = { title: "Lots" };

/** Prizes of the current season (architecture §8.3), with how they are given. */
export default async function PrizesPage() {
  const viewer = await requireUser();
  const db = getDb();
  const season = await getCurrentSeason(db, viewer, new Date());
  const prizes = season ? await getPrizes(db, viewer, season.id) : [];

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-[44px] leading-none font-extrabold uppercase">Lots</h1>
        {season ? <p className="text-[15px] text-muted">Saison {season.label}</p> : null}
      </div>
      {prizes.length === 0 ? (
        <EmptyState icon={Gift}>Les lots seront annoncés bientôt.</EmptyState>
      ) : (
        <Card as="section" className="flex flex-col gap-4">
          <p className="text-[15px] text-ink-2">
            Les lots récompensent le classement final de la saison, proclamé par l&apos;admin une fois toutes ses questions
            résolues.
          </p>
          <ol aria-label={`Lots de la saison ${season!.label}`} className="flex flex-col gap-2">
            {prizes.map((prize) => (
              <li key={prize.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-button bg-raised px-4 py-3">
                <span className="min-w-16 font-display text-2xl font-extrabold uppercase text-accent-text">{prize.rankLabel}</span>
                <span className="text-base">{prize.description}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
      <p className="text-[15px] text-ink-2">
        Barème, jokers et départage :{" "}
        <Link href="/reglement" className="font-semibold text-accent-text hover:underline">
          lire le règlement
        </Link>
        .
      </p>
    </>
  );
}
