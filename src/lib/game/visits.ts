// "Nouveau" badge on open questions (architecture §5.9).

/** Beyond this gap since the last page seen, it is a new visit. */
export const NEW_VISIT_GAP_MS = 30 * 60 * 1000;

export type VisitFields = { lastSeenAt: Date | null; previousVisitAt: Date | null };

function isNewVisit(lastSeenAt: Date, now: Date): boolean {
  return now.getTime() - lastSeenAt.getTime() > NEW_VISIT_GAP_MS;
}

/**
 * Date after which an opened question is new to the player: the last visit when this is a new
 * visit, else the visit before (within a visit, badges stay until it ends). Null: no badge.
 */
export function newReference(user: VisitFields, now: Date): Date | null {
  if (!user.lastSeenAt) return null;
  return isNewVisit(user.lastSeenAt, now) ? user.lastSeenAt : user.previousVisitAt;
}

export function isNew(opensAt: Date, reference: Date | null): boolean {
  return reference !== null && opensAt > reference;
}

/** Values written by `recordVisit`, after the page is displayed. */
export function nextVisitFields(user: VisitFields, now: Date): { lastSeenAt: Date; previousVisitAt: Date | null } {
  const newVisit = user.lastSeenAt !== null && isNewVisit(user.lastSeenAt, now);
  return { lastSeenAt: now, previousVisitAt: newVisit ? user.lastSeenAt : user.previousVisitAt };
}
