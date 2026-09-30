"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { createAnnouncement, deleteAnnouncement, updateAnnouncement } from "@/lib/services/announcements";
import { archiveCategory, createCategory, renameCategory, unarchiveCategory } from "@/lib/services/categories";
import type { Result } from "@/lib/services/result";
import { createSeason, deleteSeason, type PrizeInput, proclaimSeason, updateSeason, upsertPrizes } from "@/lib/services/seasons";
import type { FormState } from "./form-state";

// Server Actions of /admin/categories, /admin/saisons and /admin/annonces (architecture §7.1).
// Categories, seasons, prizes and announcements show on player pages, hence the layout revalidation.

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

// Seasons and prizes

/** "Saison créée. 2 questions y sont passées." */
function seasonMessage(done: string, moved: number): string {
  if (moved === 0) return done;
  return `${done} ${moved === 1 ? "1 question a changé de saison." : `${moved} questions ont changé de saison.`}`;
}

export async function createSeasonAction(_: FormState, formData: FormData): Promise<FormState> {
  const input = { label: formData.get("label"), startsOn: formData.get("startsOn") };
  const result = await createSeason(getDb(), await getActor(), input, new Date());
  return toFormState(result, seasonMessage("Saison créée.", result.ok ? result.data.moved : 0));
}

export async function updateSeasonAction(_: FormState, formData: FormData): Promise<FormState> {
  const input = { seasonId: formData.get("seasonId"), label: formData.get("label"), startsOn: formData.get("startsOn") };
  const result = await updateSeason(getDb(), await getActor(), input, new Date());
  return toFormState(result, seasonMessage("Saison modifiée.", result.ok ? result.data.moved : 0));
}

export async function deleteSeasonAction(seasonId: number): Promise<Result> {
  const result = await deleteSeason(getDb(), await getActor(), { seasonId });
  if (result.ok) refresh();
  return result;
}

export async function savePrizesAction(seasonId: number, prizes: PrizeInput[]): Promise<FormState> {
  const result = await upsertPrizes(getDb(), await getActor(), { seasonId, prizes });
  return toFormState(result, "Lots enregistrés.");
}

export async function proclaimSeasonAction(seasonId: number): Promise<FormState> {
  const result = await proclaimSeason(getDb(), await getActor(), { seasonId }, new Date());
  return toFormState(result, "Classement final proclamé : il est maintenant au palmarès.");
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
