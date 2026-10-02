// Constants of the general chat (architecture §5.15, v1.2, step 8d).

/** The chat page asks the server for new messages every 10 seconds… */
export const CHAT_POLL_MS = 10_000;
/** …while its tab is visible and the person acted in the last 5 minutes. */
export const CHAT_IDLE_MS = 5 * 60_000;
/** Failed polls in a row before « Connexion perdue, nouvel essai… » shows. */
export const CHAT_FAILURES_BEFORE_NOTICE = 3;

/** Length of a message, in Unicode code points. */
export const CHAT_MAX_LENGTH = 500;
/** Messages an account may post over the last minute. */
export const CHAT_MAX_PER_MINUTE = 10;
export const CHAT_RATE_WINDOW_MS = 60_000;

/** Messages loaded at once: the latest, or those before « Messages plus anciens ». */
export const CHAT_PAGE_SIZE = 50;
/** New messages sent at most by one poll; the next poll gets the rest. */
export const CHAT_UPDATES_LIMIT = 100;
