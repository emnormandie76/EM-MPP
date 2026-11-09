import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { allowedEmail, user } from "@/lib/db/schema";
import { markAsProduction, openPglite, type ScriptDb } from "../../scripts/lib/db";
import { exportAccounts, inReadOnlySnapshot, readExportSource } from "../../scripts/lib/portail-export";
import { createUser } from "../helpers/factories";

// The export reads the production database and writes nothing in it (D11, B2).

describe("portal export on a database", () => {
  let target: ScriptDb;
  let folder: string;
  let file: string;

  beforeEach(async () => {
    target = await openPglite();
    await target.migrate();
    folder = mkdtempSync(join(tmpdir(), "export-portail-"));
    file = join(folder, "export.json");
  });

  afterEach(async () => {
    await target.close();
    rmSync(folder, { recursive: true, force: true });
  });

  it("writes the accounts and the addresses without an account, as the contract's JSON array", async () => {
    await markAsProduction(target.db);
    await createUser(target.db, { email: "admin@em-normandie.fr", name: "L'admin", role: "admin" });
    await createUser(target.db, { email: "joueur@em-normandie.fr", name: "Léa", role: "player" });
    await createUser(target.db, { email: "parti@em-normandie.fr", name: "Parti", role: "player", banned: true });
    await target.db
      .insert(allowedEmail)
      .values([{ email: "joueur@em-normandie.fr" }, { email: "invite@em-normandie.fr" }, { email: "parti@em-normandie.fr" }]);

    const counts = await exportAccounts(target.db, file);

    const text = readFileSync(file, "utf8");
    expect(text.charCodeAt(0)).not.toBe(0xfeff);
    expect(JSON.parse(text)).toEqual([
      { email: "admin@em-normandie.fr", name: "L'admin", role: "admin" },
      { email: "invite@em-normandie.fr", name: null, role: "player" },
      { email: "joueur@em-normandie.fr", name: "Léa", role: "player" },
    ]);
    expect(counts).toMatchObject({ accounts: 3, listed: 3, rows: 3, fromList: 1, banned: 1, byRole: { admin: 1, player: 2 } });
  });

  it("refuses a database that is not marked as production, and writes no file", async () => {
    await createUser(target.db, { email: "joueur@em-normandie.fr" });

    await expect(exportAccounts(target.db, file)).rejects.toThrow(/pas marquée « production »/);
    expect(existsSync(file)).toBe(false);
  });

  it("writes no file when an account has an undeclared role", async () => {
    await markAsProduction(target.db);
    await createUser(target.db, { email: "joueur@em-normandie.fr", role: "user" });

    await expect(exportAccounts(target.db, file)).rejects.toThrow(/rôle non déclaré/);
    expect(existsSync(file)).toBe(false);
  });

  it("reads in a transaction where the database itself refuses any write", async () => {
    let failure: unknown;
    await inReadOnlySnapshot(target.db, (tx) => tx.insert(allowedEmail).values({ email: "ecrit@em-normandie.fr" })).catch((error: unknown) => {
      failure = error;
    });

    expect(String((failure as Error).cause ?? failure)).toMatch(/read-only transaction/);
    expect(await target.db.select().from(allowedEmail)).toEqual([]);
  });

  it("changes nothing in the database", async () => {
    await markAsProduction(target.db);
    await createUser(target.db, { email: "joueur@em-normandie.fr" });
    await target.db.insert(allowedEmail).values({ email: "invite@em-normandie.fr" });
    const before = [await target.db.select().from(user), await target.db.select().from(allowedEmail)];

    await readExportSource(target.db);

    expect([await target.db.select().from(user), await target.db.select().from(allowedEmail)]).toEqual(before);
  });
});
