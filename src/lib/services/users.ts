import { and, eq, ne, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { allowedEmail, user } from "@/lib/db/schema";

// Account reads shared by the services and the sign-up hook.

const ANONYMIZED_DOMAIN = "invalid.local";

/** Address given to an anonymized account (§6.3). */
export function anonymizedEmail(userId: string): string {
  return `anonyme-${userId}@${ANONYMIZED_DOMAIN}`;
}

export function isAnonymized(account: { email: string }): boolean {
  return account.email.endsWith(`@${ANONYMIZED_DOMAIN}`);
}

/** Whether another account already uses this display name, whatever the case (§6.2). */
export async function isDisplayNameTaken(db: Database, name: string, exceptUserId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(and(sql`lower(${user.name}) = lower(${name})`, exceptUserId ? ne(user.id, exceptUserId) : undefined))
    .limit(1);
  return rows.length > 0;
}

/** `email` must already be normalized. */
export async function hasAccount(db: Database, email: string): Promise<boolean> {
  const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
  return rows.length > 0;
}

/** `email` must already be normalized. */
export async function isAllowedEmail(db: Database, email: string): Promise<boolean> {
  const rows = await db.select({ email: allowedEmail.email }).from(allowedEmail).where(eq(allowedEmail.email, email)).limit(1);
  return rows.length > 0;
}
