import type { Metadata } from "next";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { requireUser } from "@/lib/auth/session";
import { getChatMessages } from "@/lib/data/chat";
import { getDb } from "@/lib/db/client";

export const metadata: Metadata = { title: "Chat" };

/** General chat (architecture §5.15, §8.3): the latest 50 messages, then the polling of ChatRoom. */
export default async function ChatPage() {
  const viewer = await requireUser();
  const page = await getChatMessages(getDb(), viewer, {}, new Date());
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[44px] leading-none font-extrabold uppercase">Chat</h1>
        <p className="text-[15px] text-ink-2">Le chat de toute l&apos;équipe. Les nouveaux messages arrivent toutes les 10 secondes environ.</p>
      </div>
      <ChatRoom initial={page} viewerId={viewer.id} />
    </>
  );
}
