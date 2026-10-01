import { ListFilter, Plus } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { QUESTION_STATUS_LABELS } from "@/components/admin/QuestionStatusChip";
import { type QuestionListItem, QuestionsTable } from "@/components/admin/QuestionsTable";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/Field";
import { adminMetadata, requireAdmin } from "@/lib/auth/session";
import { type AdminQuestionFilters, getAdminQuestionsList, QUESTION_STATUSES } from "@/lib/data/admin";
import { getDb } from "@/lib/db/client";
import { formatDateTime } from "@/lib/format";
import type { QuestionStatus } from "@/lib/game/question-status";
import { QUESTION_KIND_LABELS } from "@/lib/validation/question";

export async function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Questions");
}

/** Status filter in the address, in French: /admin/questions?statut=programmee. */
const STATUS_SLUGS: Record<QuestionStatus, string> = {
  draft: "brouillon",
  scheduled: "programmee",
  open: "ouverte",
  closed: "cloturee",
  resolved: "resolue",
  cancelled: "annulee",
};

function single(value: string | string[] | undefined): string | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  return text === "" ? undefined : text;
}

function filtersOf(params: Record<string, string | string[] | undefined>): AdminQuestionFilters {
  const statusSlug = single(params.statut);
  const status = QUESTION_STATUSES.find((value) => STATUS_SLUGS[value] === statusSlug);
  const season = single(params.saison);
  const categoryId = Number(single(params.categorie));
  return {
    status,
    season: season === "sans" ? "none" : season,
    categoryId: Number.isInteger(categoryId) && categoryId > 0 ? categoryId : undefined,
  };
}

const optionalDate = (date: Date | null, now: Date) => (date ? formatDateTime(date, now) : null);

/** Questions list: filters, selection and group actions (architecture §8.3). */
export default async function QuestionsAdminPage({ searchParams }: PageProps<"/admin/questions">) {
  const viewer = await requireAdmin();
  const params = await searchParams;
  const filters = filtersOf(params);
  const now = new Date();
  const { rows, seasons, categories } = await getAdminQuestionsList(getDb(), viewer, filters, now);
  const filtered = Boolean(filters.status || filters.season || filters.categoryId);
  const items: QuestionListItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    categoryName: row.categoryName,
    kindLabel: QUESTION_KIND_LABELS[row.kind],
    coefficient: row.coefficient,
    seasonLabel: row.seasonLabel,
    status: row.status,
    opensLabel: optionalDate(row.opensAt, now),
    closesLabel: optionalDate(row.closesAt, now),
    expectedLabel: optionalDate(row.expectedResultAt, now),
    predictionCount: row.predictionCount,
  }));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[44px] font-extrabold uppercase leading-none">Questions</h1>
        <Link href="/admin/questions/nouvelle" className={buttonClasses()}>
          <Plus aria-hidden size={18} strokeWidth={2.4} />
          Nouvelle question
        </Link>
      </div>

      <Card as="section" className="flex flex-col gap-5">
        <h2 className="sr-only">Filtres</h2>
        <Form action="/admin/questions" className="flex flex-wrap items-end gap-3">
          <SelectField name="statut" label="Statut" defaultValue={filters.status ? STATUS_SLUGS[filters.status] : ""} className="w-48">
            <option value="">Tous</option>
            {QUESTION_STATUSES.map((status) => (
              <option key={status} value={STATUS_SLUGS[status]}>
                {QUESTION_STATUS_LABELS[status]}
              </option>
            ))}
          </SelectField>
          <SelectField
            name="saison"
            label="Saison"
            defaultValue={filters.season === "none" ? "sans" : (filters.season ?? "")}
            className="w-48"
          >
            <option value="">Toutes</option>
            {seasons.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
            <option value="sans">Sans saison</option>
          </SelectField>
          <SelectField name="categorie" label="Catégorie" defaultValue={filters.categoryId ?? ""} className="w-56">
            <option value="">Toutes</option>
            {categories.map(({ id, name, archived }) => (
              <option key={id} value={id}>
                {archived ? `${name} (archivée)` : name}
              </option>
            ))}
          </SelectField>
          <button type="submit" className={buttonClasses({ variant: "secondary" })}>
            <ListFilter aria-hidden size={16} strokeWidth={2.4} />
            Filtrer
          </button>
          {filtered ? (
            <Link href="/admin/questions" className="pb-2.5 text-[15px] font-semibold text-accent-text hover:underline">
              Effacer les filtres
            </Link>
          ) : null}
        </Form>

        {items.length > 0 ? (
          <QuestionsTable rows={items} />
        ) : (
          <p className="text-[15px] text-ink-2">
            {filtered ? "Aucune question ne correspond à ces filtres." : "Aucune question pour l'instant. Crée la première !"}
          </p>
        )}
      </Card>
    </>
  );
}
