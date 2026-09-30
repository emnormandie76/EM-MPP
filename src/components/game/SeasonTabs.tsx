import { Tabs } from "@/components/ui/Tabs";
import type { SeasonRef } from "@/lib/data/standings";

/**
 * Season picker (§5.6): one link per season with a published question, latest first, in the
 * address (`?saison=<id>`). Hidden while there is only one season to show.
 */
export function SeasonTabs({ seasons, currentId, basePath }: { seasons: SeasonRef[]; currentId: number | null; basePath: string }) {
  if (seasons.length < 2) return null;
  return (
    <Tabs
      label="Choisir la saison"
      items={seasons.map(({ id, label }) => ({ href: `${basePath}?saison=${id}`, label, current: id === currentId }))}
    />
  );
}

/** The season id of `?saison=`, when it is one of `seasons`; otherwise the default season is shown. */
export function seasonParam(value: string | string[] | undefined, seasons: SeasonRef[]): number | undefined {
  const id = typeof value === "string" ? Number(value) : Number.NaN;
  return seasons.find((season) => season.id === id)?.id;
}
