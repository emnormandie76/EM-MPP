"use server";

import { z } from "zod";
import { getActor, getViewer } from "@/lib/auth/session";
import { type ChatPage, getChatMessages } from "@/lib/data/chat";
import { getDb } from "@/lib/db/client";
import { deleteChatMessage, markChatRead, postChatMessage } from "@/lib/services/chat";
import type { Result } from "@/lib/services/result";

// Server Actions of the chat (architecture §5.15, §7.1). No revalidation: the chat page fetches the
// new messages itself (polling), and the other pages read the unread count when they are seen.

export async function postChatMessageAction(input: { body: string }): Promise<Result<{ id: number }>> {
  return postChatMessage(getDb(), await getActor(), input, new Date());
}

export async function deleteChatMessageAction(input: { messageId: number }): Promise<Result> {
  return deleteChatMessage(getDb(), await getActor(), input, new Date());
}

export async function markChatReadAction(input: { lastMessageId: number }): Promise<Result> {
  return markChatRead(getDb(), await getActor(), input, new Date());
}

const olderInput = z.object({ beforeId: z.number().int().positive() });

/**
 * « Messages plus anciens »: the 50 messages before `beforeId` (a read, made from the chat page).
 * Null without a valid session: the page then goes back to /connexion.
 */
export async function loadOlderChatMessagesAction(input: { beforeId: number }): Promise<ChatPage | null> {
  const viewer = await getViewer();
  if (!viewer || viewer.banned) return null;
  const parsed = olderInput.safeParse(input);
  if (!parsed.success) return null;
  return getChatMessages(getDb(), viewer, parsed.data, new Date());
}
