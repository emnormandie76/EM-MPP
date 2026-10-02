import { CHAT_IDLE_MS } from "./constants";

// When the chat page asks the server for new messages (architecture §5.15). Vercel keeps no open
// connection, and the project uses no third-party service: the page polls. It pauses when its tab
// is hidden or the person has not acted for 5 minutes, so that a forgotten tab does not keep the
// Neon database awake all day.

export type PollingState = {
  /** `document.visibilityState === "visible"`. */
  visible: boolean;
  /** Last mouse, keyboard, scroll or focus action, in milliseconds. */
  lastActivityAt: number;
  /** In milliseconds. */
  now: number;
};

export function shouldPoll({ visible, lastActivityAt, now }: PollingState): boolean {
  return visible && now - lastActivityAt < CHAT_IDLE_MS;
}
