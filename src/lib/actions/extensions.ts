"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { cancelQuestionExtension, type ExtensionEnded, type ExtensionSaved, setQuestionExtension } from "@/lib/services/extensions";
import type { Result } from "@/lib/services/result";

// Server Actions of the extensions (architecture §5.14, §7.1): session, service, revalidation. An
// extension changes the extended player's pages and the back office, hence the layout revalidation.

function refresh<T>(result: Result<T>): Result<T> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** `closesAt`: the `datetime-local` value, Paris time. */
export async function setQuestionExtensionAction(input: { questionId: number; userId: string; closesAt: string }): Promise<Result<ExtensionSaved>> {
  return refresh(await setQuestionExtension(getDb(), await getActor(), input, new Date()));
}

export async function cancelQuestionExtensionAction(input: { questionId: number; userId: string }): Promise<Result<ExtensionEnded>> {
  return refresh(await cancelQuestionExtension(getDb(), await getActor(), input, new Date()));
}
