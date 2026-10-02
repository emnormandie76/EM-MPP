"use client";

import { ArrowDown, MessagesSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { deleteChatMessageAction, loadOlderChatMessagesAction, markChatReadAction } from "@/lib/actions/chat";
import { CHAT_FAILURES_BEFORE_NOTICE, CHAT_POLL_MS } from "@/lib/chat/constants";
import { shouldPoll } from "@/lib/chat/polling";
import type { ChatMessageView, ChatPage, ChatUpdates } from "@/lib/data/chat";
import { formatChatDay, parisDayKey } from "@/lib/format";
import { ChatComposer } from "./ChatComposer";
import { ChatMessage } from "./ChatMessage";

// The chat thread (§5.15, §8.3 /chat). New messages come by polling `GET /api/chat` every 10 s,
// only while the tab is visible and the person acted in the last 5 minutes (`shouldPoll`); without
// it, a forgotten tab would keep the Neon database awake. Paused, the page sets no timer at all,
// and polls at once when the tab shows again or the person acts.

/** Distance to the bottom under which the thread counts as read to the end. */
const BOTTOM_SLACK_PX = 48;
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "focus"] as const;

type ScrollIntent = { kind: "bottom" } | { kind: "keep"; fromBottom: number } | null;

/** Merges fresh views into the thread, by id. The deletions erase the text of known messages. */
function merge(current: ChatMessageView[], incoming: ChatMessageView[], deletedIds: number[], floor: number): ChatMessageView[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  // A message older than the loaded ones would leave a gap: « Messages plus anciens » brings it.
  for (const message of incoming) if (message.id >= floor) byId.set(message.id, message);
  for (const id of deletedIds) {
    const message = byId.get(id);
    if (message && !message.deleted) byId.set(id, { ...message, deleted: true, body: null, result: null, canDelete: false });
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/** The messages grouped by Paris day, for the day separators. */
function byDay(messages: ChatMessageView[]): { key: string; first: string; messages: ChatMessageView[] }[] {
  const days: { key: string; first: string; messages: ChatMessageView[] }[] = [];
  for (const message of messages) {
    const key = parisDayKey(new Date(message.createdAt));
    const last = days.at(-1);
    if (last?.key === key) last.messages.push(message);
    else days.push({ key, first: message.createdAt, messages: [message] });
  }
  return days;
}

/** What a screen reader hears when messages of the others arrive (§8.3: only after the loading). */
function announce(messages: ChatMessageView[]): string {
  if (messages.length === 0) return "";
  if (messages.length > 1) return `${messages.length} nouveaux messages.`;
  const [message] = messages;
  if (message.result) return `Nouveau message : ${message.result.text}`;
  return `Nouveau message de ${message.author?.name ?? "quelqu'un"} : ${message.body ?? "message supprimé"}`;
}

export function ChatRoom({ initial, viewerId }: { initial: ChatPage; viewerId: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial.messages);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [now, setNow] = useState(() => new Date(initial.serverTime));
  const [lost, setLost] = useState(false);
  const [newBelow, setNewBelow] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [toDelete, setToDelete] = useState<ChatMessageView | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const log = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  const hasMoreRef = useRef(hasMore);
  const since = useRef(initial.serverTime);
  const failures = useRef(0);
  const inFlight = useRef(false);
  /** A poll asked while another one runs: it runs right after (followOwn: after one's own message). */
  const pollAgain = useRef<{ followOwn: boolean } | null>(null);
  const pollRef = useRef<(followOwn?: boolean) => Promise<void>>(async () => {});
  const atBottom = useRef(true);
  const scrollIntent = useRef<ScrollIntent>({ kind: "bottom" });
  const lastMarked = useRef(0);

  useEffect(() => {
    messagesRef.current = messages;
    hasMoreRef.current = hasMore;
  }, [messages, hasMore]);

  // Scroll: to the bottom on loading and after the viewer's own message, kept when older messages
  // come on top, and moved by new messages only when the thread was already at its bottom.
  useLayoutEffect(() => {
    const element = log.current;
    const intent = scrollIntent.current;
    scrollIntent.current = null;
    if (!element || !intent) return;
    if (intent.kind === "bottom") element.scrollTop = element.scrollHeight;
    else element.scrollTop = element.scrollHeight - intent.fromBottom;
  }, [messages]);

  // The thread shrinks when the emoji grid opens: it stays on its latest messages if it showed them.
  useEffect(() => {
    const element = log.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (atBottom.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function onScroll() {
    const element = log.current;
    if (!element) return;
    atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < BOTTOM_SLACK_PX;
    if (atBottom.current) setNewBelow(false);
  }

  function scrollToBottom() {
    const element = log.current;
    if (element) element.scrollTop = element.scrollHeight;
    setNewBelow(false);
  }

  const apply = useCallback(
    (updates: ChatUpdates, followOwn: boolean) => {
      const current = messagesRef.current;
      const lastId = current.at(-1)?.id ?? 0;
      const fresh = updates.messages.filter((message) => message.id > lastId);
      const fromOthers = fresh.filter((message) => message.author?.id !== viewerId);
      const floor = hasMoreRef.current ? (current[0]?.id ?? 0) : 0;
      const next = merge(current, updates.messages, updates.deletedIds, floor);
      messagesRef.current = next;
      if (followOwn || atBottom.current) scrollIntent.current = { kind: "bottom" };
      else if (fresh.length > 0) setNewBelow(true);
      if (fromOthers.length > 0) setAnnouncement(announce(fromOthers));
      setMessages(next);
      setNow(new Date(updates.serverTime));
    },
    [viewerId],
  );

  /** Asks the server what changed since the previous poll; a poll asked meanwhile runs right after. */
  const poll = useCallback(
    async (followOwn = false): Promise<void> => {
      if (inFlight.current) {
        pollAgain.current = { followOwn: followOwn || (pollAgain.current?.followOwn ?? false) };
        return;
      }
      inFlight.current = true;
      try {
        const after = messagesRef.current.at(-1)?.id ?? 0;
        const response = await fetch(`/api/chat?after=${after}&since=${encodeURIComponent(since.current)}`, { cache: "no-store" });
        if (response.status === 401) {
          router.replace("/connexion");
          return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const updates = (await response.json()) as ChatUpdates;
        since.current = updates.serverTime;
        failures.current = 0;
        setLost(false);
        apply(updates, followOwn);
      } catch {
        // Tried again at the next turn; after 3 failures in a row, a discreet notice.
        failures.current += 1;
        if (failures.current >= CHAT_FAILURES_BEFORE_NOTICE) setLost(true);
      } finally {
        inFlight.current = false;
        const again = pollAgain.current;
        pollAgain.current = null;
        if (again) void pollRef.current(again.followOwn);
      }
    },
    [apply, router],
  );

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  // Polling loop (§5.15): a timer only while polling; paused otherwise, until the tab shows again
  // or the person acts, which polls at once.
  useEffect(() => {
    let timer: number | null = null;
    let paused = false;
    let lastActivityAt = Date.now();
    let stopped = false;
    const visible = () => document.visibilityState === "visible";
    const polling = () => shouldPoll({ visible: visible(), lastActivityAt, now: Date.now() });

    function schedule() {
      if (!stopped) timer = window.setTimeout(tick, CHAT_POLL_MS);
    }
    async function tick() {
      timer = null;
      if (!polling()) {
        paused = true;
        return;
      }
      await poll();
      schedule();
    }
    function resume() {
      if (!paused || !polling()) return;
      paused = false;
      void poll().then(schedule);
    }
    function onActivity() {
      lastActivityAt = Date.now();
      resume();
    }
    function onVisibility() {
      if (!visible()) return;
      lastActivityAt = Date.now();
      resume();
    }

    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, onActivity, { passive: true });
    // Scrolling the thread counts too (a scroll event does not bubble up to the window).
    document.addEventListener("scroll", onActivity, { capture: true, passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    schedule();
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, onActivity);
      document.removeEventListener("scroll", onActivity, { capture: true });
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [poll]);

  // Read up to the latest message shown, while the tab is visible (§5.15).
  useEffect(() => {
    const latest = messages.at(-1)?.id ?? 0;
    function mark() {
      if (document.visibilityState !== "visible" || latest <= lastMarked.current) return;
      lastMarked.current = latest;
      markChatReadAction({ lastMessageId: latest }).catch(() => {
        lastMarked.current = 0;
      });
    }
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [messages]);

  async function loadOlder() {
    const first = messages[0];
    if (!first || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await loadOlderChatMessagesAction({ beforeId: first.id });
      if (!page) {
        router.replace("/connexion");
        return;
      }
      const element = log.current;
      scrollIntent.current = { kind: "keep", fromBottom: element ? element.scrollHeight - element.scrollTop : 0 };
      const next = merge(page.messages, messagesRef.current, [], 0);
      messagesRef.current = next;
      hasMoreRef.current = page.hasMore;
      setHasMore(page.hasMore);
      setMessages(next);
    } finally {
      setLoadingOlder(false);
    }
  }

  function askDelete(message: ChatMessageView) {
    setDeleteError(null);
    setToDelete(message);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    const result = await deleteChatMessageAction({ messageId: toDelete.id });
    setDeleting(false);
    if (!result.ok && result.code !== "MESSAGE_NOT_FOUND") {
      setDeleteError(result.message);
      return;
    }
    const next = merge(messagesRef.current, [], [toDelete.id], 0);
    messagesRef.current = next;
    setMessages(next);
    setToDelete(null);
  }

  return (
    // The whole screen below the title: the message field stays at the bottom of the screen, and
    // the thread shrinks when the emoji grid opens (§8.3: fixed on a phone).
    <section aria-label="Discussion" className="flex h-[calc(100dvh-14rem)] min-h-[26rem] flex-col rounded-card border border-line bg-surface">
      <div className="relative min-h-0 flex-1">
        <div
          ref={log}
          role="log"
          aria-label="Messages du chat"
          aria-live="off"
          tabIndex={0}
          onScroll={onScroll}
          className="flex h-full flex-col gap-4 overflow-y-auto px-3 py-4 sm:px-5"
        >
          {hasMore ? (
            <Button variant="secondary" className="self-center" pending={loadingOlder} onClick={loadOlder}>
              Messages plus anciens
            </Button>
          ) : null}
          {messages.length === 0 ? (
            <div className="my-auto">
              <EmptyState icon={MessagesSquare}>Aucun message pour l&apos;instant. Lance la discussion !</EmptyState>
            </div>
          ) : (
            byDay(messages).map((day) => (
              <div key={day.key} className="flex flex-col gap-3">
                <h2 className="flex items-center gap-3 font-display text-sm font-bold uppercase tracking-[0.08em] text-muted before:h-px before:grow before:bg-line after:h-px after:grow after:bg-line">
                  {formatChatDay(new Date(day.first), now)}
                </h2>
                <ol className="flex flex-col gap-3">
                  {day.messages.map((message) => (
                    <li key={message.id}>
                      <ChatMessage message={message} onDelete={askDelete} />
                    </li>
                  ))}
                </ol>
              </div>
            ))
          )}
        </div>
        {newBelow ? (
          <Button className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-lg" onClick={scrollToBottom}>
            <ArrowDown aria-hidden size={18} strokeWidth={2.4} />
            Nouveaux messages
          </Button>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <div className="flex shrink-0 flex-col gap-1 border-t border-line px-3 py-3 sm:px-5">
        <p role="status" className="text-[13px] text-muted empty:hidden">
          {lost ? "Connexion perdue, nouvel essai…" : null}
        </p>
        <ChatComposer onSent={() => void poll(true)} />
      </div>

      <Dialog open={toDelete !== null} onClose={() => setToDelete(null)} title="Supprimer ce message ?">
        <p className="text-[15px] text-ink-2">Il sera remplacé par « Message supprimé. » pour tout le monde.</p>
        {deleteError ? <p className="text-sm font-medium text-hot">{deleteError}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setToDelete(null)}>
            Annuler
          </Button>
          <Button variant="danger" pending={deleting} onClick={confirmDelete}>
            Supprimer
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
