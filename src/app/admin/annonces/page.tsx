import type { Metadata } from "next";
import { AnnouncementCreateForm, AnnouncementItem } from "@/components/admin/AnnouncementForms";
import { Card } from "@/components/ui/Card";
import { adminMetadata, requireAdmin } from "@/lib/auth/session";
import { getAnnouncements } from "@/lib/data/content";
import { getDb } from "@/lib/db/client";
import { formatRelative } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Annonces");
}

const SECTION_TITLE = "font-display text-[26px] font-extrabold uppercase leading-none";

/** Announcements: create, edit, delete (architecture §8.3). The home page shows the 3 latest. */
export default async function AnnouncementsAdminPage() {
  const viewer = await requireAdmin();
  const announcements = await getAnnouncements(getDb(), viewer);
  const now = new Date();

  return (
    <>
      <h1 className="font-display text-[44px] font-extrabold uppercase leading-none">Annonces</h1>
      <Card as="section" className="flex flex-col gap-4">
        <h2 className={SECTION_TITLE}>Publier</h2>
        <p className="text-[15px] text-ink-2">L&apos;accueil affiche les 3 annonces les plus récentes.</p>
        <AnnouncementCreateForm />
      </Card>
      <Card as="section" className="flex flex-col gap-4">
        <h2 className={SECTION_TITLE}>Annonces publiées</h2>
        {announcements.length === 0 ? (
          <p className="text-[15px] text-ink-2">Aucune annonce pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {announcements.map((announcement) => {
              const edited = announcement.updatedAt.getTime() - announcement.createdAt.getTime() > 1000;
              const dateLabel = `Publiée ${formatRelative(announcement.createdAt, now)}${edited ? `, modifiée ${formatRelative(announcement.updatedAt, now)}` : ""}`;
              return (
                <li key={announcement.id} className="border-b border-line pb-4 last:border-b-0 last:pb-0">
                  <AnnouncementItem announcement={{ id: announcement.id, body: announcement.body, dateLabel }} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
