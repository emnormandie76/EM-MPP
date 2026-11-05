"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { anonymizeUser } from "@/lib/services/players";

// Server Action of /admin/joueurs (architecture §7.1): session, service, revalidation. The accesses
// and the roles are managed on the portal (§6.3).

export async function anonymizeUserAction(userId: string) {
  const result = await anonymizeUser(getDb(), await getActor(), { userId }, new Date());
  // The name changes in the header and the other pages.
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
