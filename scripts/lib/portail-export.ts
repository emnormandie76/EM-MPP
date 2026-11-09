import { writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { isRole, type Role, ROLES } from "../../src/lib/auth/portail";
import type { Database } from "../../src/lib/db/client";
import { allowedEmail, user } from "../../src/lib/db/schema";
import { isAnonymized } from "../../src/lib/services/users";
import { isMarkedAsProduction } from "./db";

// The account export for the portal (B2, D5, D11, contract §10): a JSON array of
// { email, name, role }, read from the production database and kept out of Git.
// Addresses and pseudonyms stay in the file: errors and reports only give numbers.

/** The name the portal's .gitignore expects; `export-portail-*.json` is in ours too. */
export const EXPORT_FILE = "export-portail-mpplike.json";

/** The portal's own rule (I1): exact domain, no subdomain, a plain local part. */
const SCHOOL_ADDRESS = /^[a-z0-9._%+-]+@em-normandie\.fr$/;
const MAX_ADDRESS_LENGTH = 254;

/** The domain of the seed's accounts (§9.6). */
const TEST_DOMAIN = "example.test";

export type SourceAccount = { email: string; name: string; role: string | null; banned: boolean | null };
export type ExportSource = { accounts: SourceAccount[]; listedEmails: string[] };
export type ExportRow = { email: string; name: string | null; role: Role };

type Exclusion = "anonymized" | "banned" | "test" | "offDomain";

export type ExportCounts = Record<Exclusion, number> & {
  accounts: number;
  listed: number;
  rows: number;
  fromAccounts: number;
  fromList: number;
  byRole: Record<Role, number>;
};

const normalized = (email: string) => email.trim().toLowerCase();

/** Why an address stays out of the file, or null. An anonymized account is banned and off the domain too: it counts once. */
function exclusionOf(email: string, banned: boolean): Exclusion | null {
  if (isAnonymized({ email })) return "anonymized";
  if (banned) return "banned";
  if (email.endsWith(`@${TEST_DOMAIN}`)) return "test";
  return email.length <= MAX_ADDRESS_LENGTH && SCHOOL_ADDRESS.test(email) ? null : "offDomain";
}

/**
 * The rows of the file (D5): the accounts that can still play, then the addresses of the list
 * without any account, as players without a name. An address whose account is excluded does not
 * come back through the list. An undeclared role refuses everything, as the portal would (G16).
 */
export function buildPortailExport({ accounts, listedEmails }: ExportSource): { rows: ExportRow[]; counts: ExportCounts } {
  const excluded: Record<Exclusion, number> = { anonymized: 0, banned: 0, test: 0, offDomain: 0 };
  const rows = new Map<string, ExportRow>();
  const undeclared: string[] = [];
  let duplicates = 0;

  for (const account of accounts) {
    const email = normalized(account.email);
    const exclusion = exclusionOf(email, account.banned === true);
    if (exclusion) excluded[exclusion] += 1;
    else if (!isRole(account.role)) undeclared.push(account.role || "aucun");
    else if (rows.has(email)) duplicates += 1;
    else rows.set(email, { email, name: account.name, role: account.role });
  }
  if (undeclared.length > 0) {
    throw new Error(
      `${undeclared.length} compte(s) à exporter ont un rôle non déclaré (${[...new Set(undeclared)].join(", ")}) : rien n'est écrit. Rôles déclarés : ${ROLES.join(", ")}.`,
    );
  }
  if (duplicates > 0) throw new Error(`${duplicates} adresse(s) en double parmi les comptes : rien n'est écrit.`);

  const fromAccounts = rows.size;
  const withAccount = new Set(accounts.map((account) => normalized(account.email)));
  for (const listed of listedEmails) {
    const email = normalized(listed);
    if (withAccount.has(email)) continue;
    const exclusion = exclusionOf(email, false);
    if (exclusion) excluded[exclusion] += 1;
    else rows.set(email, { email, name: null, role: "player" });
  }

  const sorted = [...rows.values()].sort((a, b) => (a.email < b.email ? -1 : 1));
  const byRole = Object.fromEntries(ROLES.map((role) => [role, sorted.filter((row) => row.role === role).length])) as Record<Role, number>;
  return {
    rows: sorted,
    counts: {
      ...excluded,
      accounts: accounts.length,
      listed: listedEmails.length,
      rows: sorted.length,
      fromAccounts,
      fromList: sorted.length - fromAccounts,
      byRole,
    },
  };
}

/**
 * `read` inside a read-only transaction: the database refuses any write, and both tables come
 * from the same snapshot while the site stays open. The tests run on PGlite and the export on
 * another driver: the setting is read back, so that a driver losing it stops the export.
 */
export function inReadOnlySnapshot<T>(db: Database, read: (tx: Database) => Promise<T>): Promise<T> {
  return db.transaction(
    async (tx) => {
      const result = (await tx.execute(sql`select current_setting('transaction_read_only') as value`)) as unknown as { rows: { value: string }[] };
      if (result.rows[0]?.value !== "on") throw new Error("La transaction n'est pas en lecture seule : export arrêté.");
      return read(tx);
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

/** What the export needs, from the production database only: any other base has no real players (D11). */
export function readExportSource(db: Database): Promise<ExportSource> {
  return inReadOnlySnapshot(db, async (tx) => {
    if (!(await isMarkedAsProduction(tx))) throw new Error("Cette base n'est pas marquée « production » : export refusé (D11).");
    const accounts = await tx.select({ email: user.email, name: user.name, role: user.role, banned: user.banned }).from(user);
    const listed = await tx.select({ email: allowedEmail.email }).from(allowedEmail);
    return { accounts, listedEmails: listed.map((row) => row.email) };
  });
}

/** Writes the file, only once everything has been read and accepted. */
export async function exportAccounts(db: Database, file: string): Promise<ExportCounts> {
  const { rows, counts } = buildPortailExport(await readExportSource(db));
  writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`);
  return counts;
}

/** The numbers of the report (contract §10), the only output of the export. */
export function exportReport(counts: ExportCounts): string[] {
  return [
    `Source : ${counts.accounts} comptes, ${counts.listed} adresses sur la liste.`,
    `Exporté : ${counts.rows} lignes (${counts.fromAccounts} comptes, ${counts.fromList} adresses sans compte).`,
    `Rôles : ${ROLES.map((role) => `${counts.byRole[role]} ${role}`).join(", ")}.`,
    `Comptés, pas exportés : ${counts.banned} bannis, ${counts.anonymized} anonymisés, ${counts.offDomain} hors domaine, ${counts.test} comptes de test.`,
  ];
}

/** The connection string received on the standard input. It is never repeated, even when refused. */
export function connectionStringFrom(input: string): string {
  const url = input.trim();
  if (!/^postgres(ql)?:\/\/\S+$/.test(url)) {
    throw new Error("Aucune adresse de base lue. Passe-la par un tube : neon connection-string main --project-id <projet> | npm run export:portail");
  }
  return url;
}
