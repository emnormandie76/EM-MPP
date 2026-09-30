import type { Metadata } from "next";
import Link from "next/link";
import { QuestionForm } from "@/components/admin/QuestionForm";
import { requireAdmin } from "@/lib/auth/session";
import { getActiveCategories, hasSeasons } from "@/lib/data/admin";
import { getDb } from "@/lib/db/client";
import { NO_SEASON_YET } from "@/lib/validation/question";

export const metadata: Metadata = { title: "Nouvelle question" };

/** New question, saved as a draft (architecture §5.11, §8.3). */
export default async function NewQuestionPage() {
  const viewer = await requireAdmin();
  const categories = await getActiveCategories(getDb(), viewer);
  const seasonsExist = await hasSeasons(getDb(), viewer);

  return (
    <>
      <Link href="/admin/questions" className="self-start text-[15px] font-semibold text-accent-text hover:underline">
        ← Questions
      </Link>
      <h1 className="font-display text-[44px] font-extrabold uppercase leading-none">Nouvelle question</h1>
      <p className="text-[15px] text-ink-2">
        La question est enregistrée en brouillon : tu la publies ensuite, seule ou avec d&apos;autres depuis la liste.
      </p>
      <QuestionForm
        categories={categories}
        seasonNotice={seasonsExist ? null : NO_SEASON_YET}
        initial={{
          kind: "number",
          categoryId: null,
          title: "",
          description: "",
          unit: "",
          options: [],
          source: "",
          coefficient: 1,
          helpBiUrl: "",
          helpLastYear: "",
          helpHint: "",
          opensAt: "",
          closesAt: "",
          expectedResultAt: "",
        }}
      />
    </>
  );
}
