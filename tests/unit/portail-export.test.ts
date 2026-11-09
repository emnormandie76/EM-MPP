import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildPortailExport,
  connectionStringFrom,
  EXPORT_FILE,
  exportReport,
  type SourceAccount,
} from "../../scripts/lib/portail-export";

// Accounts exported to the portal (D5, G11, G13, G16, contract §10).

const account = (overrides: Partial<SourceAccount> = {}): SourceAccount => ({
  email: "camille@em-normandie.fr",
  name: "Camille",
  role: "player",
  banned: false,
  ...overrides,
});

describe("buildPortailExport", () => {
  it("exports an account with its role and its pseudonym as the name", () => {
    const { rows } = buildPortailExport({ accounts: [account({ role: "admin", name: "La Patronne" })], listedEmails: [] });
    expect(rows).toEqual([{ email: "camille@em-normandie.fr", name: "La Patronne", role: "admin" }]);
  });

  it("exports an address of the list without an account as a player, without a name", () => {
    const { rows, counts } = buildPortailExport({ accounts: [], listedEmails: ["invite@em-normandie.fr"] });
    expect(rows).toEqual([{ email: "invite@em-normandie.fr", name: null, role: "player" }]);
    expect(counts.fromList).toBe(1);
  });

  it("writes an address once when it is both an account and on the list, and keeps the account's role", () => {
    const { rows, counts } = buildPortailExport({
      accounts: [account({ role: "admin" })],
      listedEmails: ["camille@em-normandie.fr"],
    });
    expect(rows).toEqual([{ email: "camille@em-normandie.fr", name: "Camille", role: "admin" }]);
    expect(counts).toMatchObject({ rows: 1, fromAccounts: 1, fromList: 0 });
  });

  it("counts a banned account without exporting it, and its address does not come back through the list", () => {
    const { rows, counts } = buildPortailExport({
      accounts: [account({ banned: true })],
      listedEmails: ["camille@em-normandie.fr"],
    });
    expect(rows).toEqual([]);
    expect(counts).toMatchObject({ banned: 1, rows: 0, fromList: 0 });
  });

  it("counts an anonymized account as anonymized only, though it is also banned and off the domain", () => {
    const { rows, counts } = buildPortailExport({
      accounts: [account({ email: "anonyme-abc@invalid.local", name: "Ancien joueur 1", banned: true })],
      listedEmails: [],
    });
    expect(rows).toEqual([]);
    expect(counts).toMatchObject({ anonymized: 1, banned: 0, offDomain: 0 });
  });

  it.each([
    "camille@gmail.com",
    "camille@student.em-normandie.fr",
    "camille@em-normandie.fr.example.com",
    "camille@em-normandie.com",
    "o'neil@em-normandie.fr",
  ])("counts %s as off the domain, on an account and on the list, as the portal would", (email) => {
    const { rows, counts } = buildPortailExport({
      accounts: [account({ email })],
      listedEmails: [`invite-${email}`],
    });
    expect(rows).toEqual([]);
    expect(counts.offDomain).toBe(2);
  });

  it("counts the test accounts, on an account and on the list, as test accounts only", () => {
    const { rows, counts } = buildPortailExport({
      accounts: [account({ email: "admin@example.test" })],
      listedEmails: ["joueur1@example.test"],
    });
    expect(rows).toEqual([]);
    expect(counts).toMatchObject({ test: 2, offDomain: 0 });
  });

  it("writes the addresses in lower case and without spaces, and compares them that way", () => {
    const { rows } = buildPortailExport({
      accounts: [account({ email: " Camille@EM-Normandie.fr " })],
      listedEmails: ["camille@em-normandie.fr"],
    });
    expect(rows).toEqual([{ email: "camille@em-normandie.fr", name: "Camille", role: "player" }]);
  });

  it("sorts the rows by address, so that two exports of the same data are identical", () => {
    const { rows } = buildPortailExport({
      accounts: [account({ email: "zoe@em-normandie.fr" }), account({ email: "marc@em-normandie.fr" })],
      listedEmails: ["anna@em-normandie.fr"],
    });
    expect(rows.map((row) => row.email)).toEqual(["anna@em-normandie.fr", "marc@em-normandie.fr", "zoe@em-normandie.fr"]);
  });

  it("gives the numbers of the report", () => {
    const { counts } = buildPortailExport({
      accounts: [
        account({ email: "a@em-normandie.fr", role: "admin" }),
        account({ email: "b@em-normandie.fr" }),
        account({ email: "c@em-normandie.fr", banned: true }),
        account({ email: "d@gmail.com" }),
      ],
      listedEmails: ["a@em-normandie.fr", "e@em-normandie.fr"],
    });
    expect(counts).toEqual({
      accounts: 4,
      listed: 2,
      rows: 3,
      fromAccounts: 2,
      fromList: 1,
      byRole: { player: 2, admin: 1 },
      banned: 1,
      anonymized: 0,
      offDomain: 1,
      test: 0,
    });
  });

  it.each(["user", "", null])("refuses the whole export for an undeclared role (%s), naming no address", (role) => {
    const build = () => buildPortailExport({ accounts: [account({ role }), account({ email: "b@em-normandie.fr" })], listedEmails: [] });
    expect(build).toThrow(/rôle non déclaré/);
    expect(build).not.toThrow(/@/);
  });

  it("does not refuse an undeclared role on an account that is not exported", () => {
    const { rows, counts } = buildPortailExport({ accounts: [account({ role: "user", banned: true })], listedEmails: [] });
    expect(rows).toEqual([]);
    expect(counts.banned).toBe(1);
  });

  it("refuses two accounts with the same address, which the portal would refuse with two roles", () => {
    const build = () =>
      buildPortailExport({
        accounts: [account({ role: "admin" }), account({ email: "CAMILLE@em-normandie.fr", name: "Camille 2" })],
        listedEmails: [],
      });
    expect(build).toThrow(/en double/);
    expect(build).not.toThrow(/@/);
  });
});

describe("exportReport", () => {
  it("gives only numbers: no address, no pseudonym", () => {
    const { counts } = buildPortailExport({
      accounts: [account({ role: "admin", name: "La Patronne" })],
      listedEmails: ["invite@em-normandie.fr"],
    });
    const report = exportReport(counts).join("\n");
    expect(report).toContain("2 lignes");
    expect(report).toContain("1 admin");
    expect(report).toContain("1 player");
    expect(report).not.toMatch(/@|Patronne|camille|invite/);
  });
});

describe("connectionStringFrom", () => {
  it("takes the connection string that the Neon command prints", () => {
    expect(connectionStringFrom("postgresql://role:pass@host/db?sslmode=require\r\n")).toBe("postgresql://role:pass@host/db?sslmode=require");
  });

  it.each(["", "  \n", "not a url", "postgresql://a@b/c\npostgresql://d@e/f"])("refuses %j without repeating it", (input) => {
    const read = () => connectionStringFrom(input);
    expect(read).toThrow(/neon connection-string/);
    if (input.trim()) expect(read).not.toThrow(input.trim());
  });
});

describe("the export file", () => {
  it("is ignored by Git", () => {
    expect(EXPORT_FILE).toBe("export-portail-mpplike.json");
    expect(readFileSync(".gitignore", "utf8").split(/\r?\n/)).toContain("export-portail-*.json");
  });
});
