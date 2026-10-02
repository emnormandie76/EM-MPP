"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

// Unread chat messages, for the badge of the Chat tab (§8.2). The layout computes the count when it
// renders; Next keeps it across the navigations, so VisitTracker updates it with each page seen.

type UnreadChat = { count: number; setCount: (count: number) => void };

const UnreadChatContext = createContext<UnreadChat>({ count: 0, setCount: () => {} });

export function UnreadChatProvider({ initial, children }: { initial: number; children: ReactNode }) {
  const [count, setCount] = useState(initial);
  // A new render of the layout (a revalidation) brings a fresh count.
  const [received, setReceived] = useState(initial);
  if (received !== initial) {
    setReceived(initial);
    setCount(initial);
  }
  return <UnreadChatContext value={{ count, setCount }}>{children}</UnreadChatContext>;
}

export function useUnreadChat(): UnreadChat {
  return useContext(UnreadChatContext);
}
