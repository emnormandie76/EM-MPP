import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { isQuestionVisible } from "@/lib/data/questions";
import { getDb } from "@/lib/db/client";

/**
 * A question players cannot see (draft, scheduled, cancelled before opening) answers 404 here,
 * before the page streams behind its loading skeleton: once a response streams, its status code
 * can no longer change (§8.3).
 */
export default async function QuestionLayout({ children, params }: LayoutProps<"/questions/[id]">) {
  // The session first: reading the headers stops `next build` before the database is opened.
  await requireUser();
  const { id } = await params;
  const questionId = Number(id);
  if (!Number.isInteger(questionId) || questionId <= 0) notFound();
  if (!(await isQuestionVisible(getDb(), questionId, new Date()))) notFound();
  return children;
}
