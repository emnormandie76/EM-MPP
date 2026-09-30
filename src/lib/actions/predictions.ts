"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { type JokerState, type SavedPrediction, savePrediction, setJoker, unlockPrediction, validatePrediction } from "@/lib/services/predictions";
import type { Result } from "@/lib/services/result";

// Server Actions of the predictions (architecture §7.1): session, service, revalidation. A
// prediction shows on the home page, /pronos, /questions and the back-office follow-up, hence the
// layout revalidation.

export type AnswerInput = { questionId: number; rawValue?: string; optionId?: number };

function refresh<T>(result: Result<T>): Result<T> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function savePredictionAction(input: AnswerInput): Promise<Result<SavedPrediction>> {
  return refresh(await savePrediction(getDb(), await getActor(), input, new Date()));
}

/** Always called with the answer shown in the form (§5.4). */
export async function validatePredictionAction(input: AnswerInput): Promise<Result<SavedPrediction>> {
  return refresh(await validatePrediction(getDb(), await getActor(), input, new Date()));
}

export async function setJokerAction(input: { questionId: number; enabled: boolean }): Promise<Result<JokerState>> {
  return refresh(await setJoker(getDb(), await getActor(), input, new Date()));
}

export async function unlockPredictionAction(predictionId: number): Promise<Result> {
  return refresh(await unlockPrediction(getDb(), await getActor(), { predictionId }, new Date()));
}
