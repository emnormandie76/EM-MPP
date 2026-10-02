"use server";

import { revalidatePath } from "next/cache";
import { getActor, getViewer } from "@/lib/auth/session";
import { getUnreadChatCount } from "@/lib/data/chat";
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
 *
 * Returns the unread chat messages (step 8d, §8.2): Next keeps the layout, and so the header and its
 * Chat badge, across the navigations between pages; the badge follows each page seen this way,
 * without any periodic polling. Null without a valid session.
 */
export async function recordVisitAction(): Promise<{ unreadChat: number } | null> {
  const viewer = await getViewer();
  const result = await recordVisit(getDb(), await getActor(), new Date());
  if (!result.ok || !viewer) return null;
  return { unreadChat: await getUnreadChatCount(getDb(), viewer) };
}
