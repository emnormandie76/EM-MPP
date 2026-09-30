"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { recordVisit, updateAvatar, updateDisplayName } from "@/lib/services/profile";

// Profile Server Actions (architecture §7.1): session, service, revalidation. The header shows
// the name and the avatar on every page, hence the layout revalidation.

export async function updateDisplayNameAction(_: unknown, formData: FormData) {
  const result = await updateDisplayName(getDb(), await getActor(), { name: formData.get("name") }, new Date());
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateAvatarAction(_: unknown, formData: FormData) {
  const result = await updateAvatar(getDb(), await getActor(), { avatar: formData.get("avatar") }, new Date());
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/**
 * A page seen, once displayed (§5.9): called by VisitTracker. No revalidation, so that the
 * "Nouveau" badges of the page stay until the next one. Reading the session here, in a Server
 * Action, also renews it (at most once a day), which a page render cannot do.
 */
export async function recordVisitAction(): Promise<void> {
  await recordVisit(getDb(), await getActor(), new Date());
}
