import { Megaphone } from "lucide-react";
import type { AnnouncementView } from "@/lib/data/content";
import { formatRelative } from "@/lib/format";

/** The latest announcements of the admin, newest first (§8.2). */
export function AnnouncementBar({ announcements, now }: { announcements: AnnouncementView[]; now: Date }) {
  if (announcements.length === 0) return null;
  return (
    <ul aria-label="Annonces" className="flex flex-col gap-2">
      {announcements.map(({ id, body, createdAt }) => (
        <li key={id} className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-field border border-line bg-surface px-4 py-3 text-[15px]">
          <span className="inline-flex items-center gap-1.5 rounded-chip bg-accent px-2 py-0.75 font-display text-sm font-extrabold uppercase tracking-[0.08em] text-accent-ink">
            <Megaphone aria-hidden size={14} strokeWidth={2.4} />
            Annonce
          </span>
          <p className="min-w-0 grow whitespace-pre-line text-ink-2">{body}</p>
          <time dateTime={createdAt.toISOString()} className="ml-auto text-[13px] text-muted">
            {formatRelative(createdAt, now)}
          </time>
        </li>
      ))}
    </ul>
  );
}
