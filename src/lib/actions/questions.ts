"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  type BatchReport,
  cancelQuestion,
  createQuestion,
  deleteDraftQuestion,
  duplicateQuestion,
  publishQuestions,
  resolveQuestion,
  setQuestionDates,
  updateQuestion,
} from "@/lib/services/questions";
import { ERROR_MESSAGES, type Result } from "@/lib/services/result";
import type { FormState } from "./form-state";

// Server Actions of the back-office questions (architecture §7.1): session, service, revalidation.
// Questions show on every player page, hence the layout revalidation.

const FIELDS = [
  "kind",
  "categoryId",
  "title",
  "description",
  "unit",
  "source",
  "coefficient",
  "helpBiUrl",
  "helpLastYear",
  "helpHint",
  "opensAt",
  "closesAt",
  "expectedResultAt",
] as const;

/** The fields present in the form: a locked (disabled) field is not sent, so it keeps its value. */
function questionInput(formData: FormData): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const key of FIELDS) {
    const value = formData.get(key);
    if (value !== null) input[key] = value;
  }
  // The answers are sent with the kind, even when every answer line has been removed.
  if (formData.has("kind")) input.options = formData.getAll("options");
  return input;
}

function refresh() {
  revalidatePath("/", "layout");
}

function failure(result: Extract<Result<unknown>, { ok: false }>): FormState {
  return { ok: false, message: result.message, fieldErrors: result.fieldErrors };
}

/** The question form: creation (then its page), or saving, possibly followed by the publication. */
export async function saveQuestionAction(_: FormState, formData: FormData): Promise<FormState> {
  const db = getDb();
  const actor = await getActor();
  const questionId = formData.get("questionId");

  if (questionId === null) {
    const created = await createQuestion(db, actor, questionInput(formData), new Date());
    if (!created.ok) return failure(created);
    refresh();
    redirect(`/admin/questions/${created.data.id}?creee=1`);
  }

  const updated = await updateQuestion(db, actor, { ...questionInput(formData), questionId }, new Date());
  if (!updated.ok) return failure(updated);
  refresh();
  if (formData.get("intent") !== "publish") return { ok: true, message: "Question enregistrée." };

  const published = await publishQuestions(db, actor, { questionIds: [updated.data.id] }, new Date());
  if (!published.ok) return failure(published);
  const failed = published.data.failed[0];
  if (failed) {
    return { ok: false, message: `Question enregistrée, mais pas publiée : ${failed.reasons.join(" ")}` };
  }
  return { ok: true, message: "Question enregistrée et publiée." };
}

export async function publishQuestionsAction(questionIds: number[]): Promise<Result<BatchReport>> {
  const result = await publishQuestions(getDb(), await getActor(), { questionIds }, new Date());
  if (result.ok) refresh();
  return result;
}

export async function setQuestionDatesAction(input: {
  questionIds: number[];
  opensAt: string;
  closesAt: string;
  expectedResultAt: string;
}): Promise<Result<BatchReport>> {
  const result = await setQuestionDates(getDb(), await getActor(), input, new Date());
  if (result.ok) refresh();
  return result;
}

/** Duplicates each selected question; the copies are drafts. */
export async function duplicateQuestionsAction(questionIds: number[]): Promise<Result<{ ids: number[] }>> {
  const db = getDb();
  const actor = await getActor();
  const ids: number[] = [];
  for (const questionId of questionIds) {
    const result = await duplicateQuestion(db, actor, { questionId }, new Date());
    if (!result.ok) return result;
    ids.push(result.data.id);
  }
  refresh();
  return { ok: true, data: { ids } };
}

/** Duplicates one question and opens the copy. */
export async function duplicateQuestionAction(questionId: number): Promise<Result<never>> {
  const result = await duplicateQuestion(getDb(), await getActor(), { questionId }, new Date());
  if (!result.ok) return result;
  refresh();
  redirect(`/admin/questions/${result.data.id}?copie=1`);
}

export async function cancelQuestionAction(questionId: number): Promise<Result> {
  const result = await cancelQuestion(getDb(), await getActor(), { questionId }, new Date());
  if (result.ok) refresh();
  return result;
}

/** Deletes a draft and goes back to the list. */
export async function deleteQuestionAction(questionId: number): Promise<Result<never>> {
  const result = await deleteDraftQuestion(getDb(), await getActor(), { questionId });
  if (!result.ok) return result;
  refresh();
  redirect("/admin/questions");
}

export async function resolveQuestionAction(_: FormState, formData: FormData): Promise<FormState> {
  const input = {
    questionId: formData.get("questionId"),
    rawValue: formData.get("rawValue") ?? undefined,
    optionId: formData.get("optionId") ?? undefined,
  };
  const result = await resolveQuestion(getDb(), await getActor(), input, new Date());
  if (!result.ok) {
    // A choice question without a selected answer.
    if (result.code === "INVALID_INPUT") return { ok: false, message: ERROR_MESSAGES.INVALID_OPTION };
    return failure(result);
  }
  refresh();
  if (result.data.unchanged) return { ok: true, message: "Résultat inchangé." };
  return { ok: true, message: result.data.corrected ? "Résultat corrigé." : "Résultat enregistré : la question est résolue." };
}
