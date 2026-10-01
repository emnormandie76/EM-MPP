import type { Metadata } from "next";
import { CategoryActions, CategoryCreateForm } from "@/components/admin/CategoryForms";
import { Card } from "@/components/ui/Card";
import { TableScroll } from "@/components/ui/TableScroll";
import { adminMetadata, requireAdmin } from "@/lib/auth/session";
import { getCategoriesAdmin } from "@/lib/data/admin";
import { getDb } from "@/lib/db/client";
import { formatCount } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Catégories");
}

const TH = "px-3 py-2 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-muted";
const TD = "px-3 py-2.5 align-middle";

/** Categories: add, rename, archive (architecture §8.3). */
export default async function CategoriesAdminPage() {
  const viewer = await requireAdmin();
  const categories = await getCategoriesAdmin(getDb(), viewer);

  return (
    <>
      <h1 className="font-display text-[44px] font-extrabold uppercase leading-none">Catégories</h1>
      <Card as="section" className="flex flex-col gap-5">
        <h2 className="sr-only">Liste des catégories</h2>
        <p className="text-[15px] text-ink-2">
          Une catégorie archivée disparaît des choix du formulaire de question, mais reste sur ses questions.
        </p>
        <CategoryCreateForm />
        {categories.length === 0 ? (
          <p className="text-[15px] text-ink-2">Aucune catégorie pour l&apos;instant.</p>
        ) : (
          <TableScroll label="Catégories">
            <table className="w-full min-w-160 text-left text-[15px]">
              <caption className="sr-only">Catégories</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className={TH}>Nom</th>
                  <th scope="col" className={TH}>Questions</th>
                  <th scope="col" className={TH}>État</th>
                  <th scope="col" className={TH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(({ id, name, archivedAt, questionCount }) => (
                  <tr key={id} className="border-b border-line last:border-b-0">
                    <th scope="row" className={`${TD} font-semibold`}>
                      {name}
                    </th>
                    <td className={`${TD} tabular-nums`}>{formatCount(questionCount, "question")}</td>
                    <td className={TD}>{archivedAt ? <span className="text-muted">Archivée</span> : "Active"}</td>
                    <td className={TD}>
                      <CategoryActions category={{ id, name, archived: archivedAt !== null }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Card>
    </>
  );
}
