import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Architecture §8.6 and §9.3: never "pari", "mise"… ("Paris", the city, is allowed).
const FORBIDDEN = [/\b(pari|parier|parieur|mise|miser)\b/g, /\bparis sportifs?\b/gi];

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

function filesToScan(): string[] {
  const src = path.join(ROOT, "src");
  const tsx = readdirSync(src, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => path.join(src, file));
  const constants = path.join(src, "lib", "game", "constants.ts");
  return existsSync(constants) ? [...tsx, constants] : tsx;
}

function findForbidden(text: string): string[] {
  return FORBIDDEN.flatMap((pattern) => text.match(pattern) ?? []);
}

describe("betting vocabulary", () => {
  it("is detected, while the city of Paris is allowed", () => {
    expect(findForbidden("Fais ton pari")).toEqual(["pari"]);
    expect(findForbidden("la mise de départ")).toEqual(["mise"]);
    expect(findForbidden("Paris sportifs")).toEqual(["Paris sportifs"]);
    expect(findForbidden("à 18 h, heure de Paris")).toEqual([]);
    expect(findForbidden("pronostic, prono, points, joker, classement")).toEqual([]);
  });

  it("has files to scan", () => {
    expect(filesToScan().length).toBeGreaterThan(0);
  });

  it.each(filesToScan().map((file) => [path.relative(ROOT, file), file]))(
    "is absent from %s",
    (_, file) => {
      expect(findForbidden(readFileSync(file, "utf8"))).toEqual([]);
    },
  );
});
