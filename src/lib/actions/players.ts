"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  addAllowedEmails,
  anonymizeUser,
  disableUser,
  enableUser,
  removeAllowedEmail,
  setRole,
  setTemporaryPassword,
} from "@/lib/services/players";
import type { Result } from "@/lib/services/result";

// Server Actions of /admin/joueurs (architecture §7.1): session, service, revalidation.

const PAGE = "/admin/joueurs";

async function run<T>(service: (actor: Awaited<ReturnType<typeof getActor>>) => Promise<Result<T>>): Promise<Result<T>> {
  const result = await service(await getActor());
  // A role or a name may change the header and the other pages.
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function addAllowedEmailsAction(_: unknown, formData: FormData) {
  const result = await addAllowedEmails(getDb(), await getActor(), { emails: formData.get("emails") }, new Date());
  if (result.ok) revalidatePath(PAGE);
  return result;
}

export async function removeAllowedEmailAction(email: string) {
  const result = await removeAllowedEmail(getDb(), await getActor(), { email });
  if (result.ok) revalidatePath(PAGE);
  return result;
}

export async function setRoleAction(userId: string, role: "player" | "admin") {
  return run((actor) => setRole(getDb(), actor, { userId, role }, new Date()));
}

export async function disableUserAction(userId: string) {
  return run((actor) => disableUser(getDb(), actor, { userId }, new Date()));
}

export async function enableUserAction(userId: string) {
  return run((actor) => enableUser(getDb(), actor, { userId }, new Date()));
}

export async function setTemporaryPasswordAction(userId: string) {
  return run((actor) => setTemporaryPassword(getDb(), actor, { userId }, new Date()));
}

export async function anonymizeUserAction(userId: string) {
  return run((actor) => anonymizeUser(getDb(), actor, { userId }, new Date()));
}
