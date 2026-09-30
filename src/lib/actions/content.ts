"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { createAnnouncement, deleteAnnouncement, updateAnnouncement } from "@/lib/services/announcements";
import { archiveCategory, createCategory, renameCategory, unarchiveCategory } from "@/lib/services/categories";
import type { Result } from "@/lib/services/result";
import { type PrizeInput, upsertPrizes } from "@/lib/services/seasons";
import type { FormState } from "./form-state";

// Server Actions of /admin/categories, /admin/saisons and /admin/annonces (architecture §7.1).
// Categories, prizes and announcements show on player pages, hence the layout revalidation.

function refresh() {
  revalidatePath("/", "layout");
}

function toFormState(result: Result<unknown>, message: string): FormState {
  if (!result.ok) return { ok: false, message: result.message, fieldErrors: result.fieldErrors };
  refresh();
  return { ok: true, message };
}

// Categories

export async function createCategoryAction(_: FormState, formData: FormData): Promise<FormState> {
  const result = await createCategory(getDb(), await getActor(), { name: formData.get("name") }, new Date());
  return toFormState(result, "Catégorie ajoutée.");
}

export async function renameCategoryAction(_: FormState, formData: FormData): Promise<FormState> {
  const input = { categoryId: formData.get("categoryId"), name: formData.get("name") };
  return toFormState(await renameCategory(getDb(), await getActor(), input), "Catégorie renommée.");
}

export async function archiveCategoryAction(categoryId: number): Promise<Result> {
  const result = await archiveCategory(getDb(), await getActor(), { categoryId }, new Date());
  if (result.ok) refresh();
  return result;
}

export async function unarchiveCategoryAction(categoryId: number): Promise<Result> {
  const result = await unarchiveCategory(getDb(), await getActor(), { categoryId });
  if (result.ok) refresh();
  return result;
}

// Prizes

export async function savePrizesAction(seasonLabel: string, prizes: PrizeInput[]): Promise<FormState> {
  const result = await upsertPrizes(getDb(), await getActor(), { seasonLabel, prizes }, new Date());
  return toFormState(result, "Lots enregistrés.");
}

// Announcements

export async function createAnnouncementAction(_: FormState, formData: FormData): Promise<FormState> {
  const result = await createAnnouncement(getDb(), await getActor(), { body: formData.get("body") }, new Date());
  return toFormState(result, "Annonce publiée.");
}

export async function updateAnnouncementAction(_: FormState, formData: FormData): Promise<FormState> {
  const input = { announcementId: formData.get("announcementId"), body: formData.get("body") };
  return toFormState(await updateAnnouncement(getDb(), await getActor(), input, new Date()), "Annonce modifiée.");
}

export async function deleteAnnouncementAction(announcementId: number): Promise<Result> {
  const result = await deleteAnnouncement(getDb(), await getActor(), { announcementId });
  if (result.ok) refresh();
  return result;
}
