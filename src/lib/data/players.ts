import "server-only";
import { asc, eq } from "drizzle-orm";
import type { Viewer } from "@/lib/auth/session";
import { isAvatarKey, type AvatarKey } from "@/lib/avatars";
import type { Database } from "@/lib/db/client";
import { allowedEmail, user } from "@/lib/db/schema";
import type { Role } from "@/lib/services/result";
import { isAnonymized } from "@/lib/services/users";

// Reads of the /admin/joueurs page (architecture §7.4). Admin only.

type ViewerRole = Pick<Viewer, "id" | "role">;

function assertAdmin(viewer: ViewerRole): void {
  if (viewer.role !== "admin") throw new Error("FORBIDDEN: admin reads only");
}

export type AllowedEmailRow = { email: string; hasAccount: boolean };

/** The allow list, with whether an account uses each address. */
export async function getAllowedEmails(db: Database, viewer: ViewerRole): Promise<AllowedEmailRow[]> {
  assertAdmin(viewer);
  const rows = await db
    .select({ email: allowedEmail.email, userId: user.id })
    .from(allowedEmail)
    .leftJoin(user, eq(user.email, allowedEmail.email))
    .orderBy(asc(allowedEmail.email));
  return rows.map(({ email, userId }) => ({ email, hasAccount: userId !== null }));
}

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  banned: boolean;
  anonymized: boolean;
  avatar: AvatarKey;
  lastSeenAt: Date | null;
  isViewer: boolean;
};

const byName = new Intl.Collator("fr", { sensitivity: "base" });

/** Every account, by name (French order); anonymized accounts last. */
export async function getAccounts(db: Database, viewer: ViewerRole): Promise<AccountRow[]> {
  assertAdmin(viewer);
  const rows = await db.select().from(user);
  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role === "admin" ? ("admin" as const) : ("player" as const),
      banned: row.banned === true,
      anonymized: isAnonymized(row),
      avatar: isAvatarKey(row.avatar) ? row.avatar : ("maillot-bleu-uni" as const),
      lastSeenAt: row.lastSeenAt,
      isViewer: row.id === viewer.id,
    }))
    .sort((a, b) => Number(a.anonymized) - Number(b.anonymized) || byName.compare(a.name, b.name));
}
