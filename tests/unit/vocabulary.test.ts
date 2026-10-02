import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findForbiddenWords } from "../helpers/vocabulary";

// Architecture §8.6 and §9.3: never "pari", "mise"… ("Paris", the city, is allowed). The chat
// texts written by the code (src/lib/chat, step 8d) are scanned too.

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

function filesToScan(): string[] {
  const src = path.join(ROOT, "src");
  const tsx = readdirSync(src, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => path.join(src, file));
  const constants = path.join(src, "lib", "game", "constants.ts");
  const chatDir = path.join(src, "lib", "chat");
  const chat = existsSync(chatDir)
    ? readdirSync(chatDir, { encoding: "utf8" })
        .filter((file) => file.endsWith(".ts"))
        .map((file) => path.join(chatDir, file))
    : [];
  return [...tsx, ...(existsSync(constants) ? [constants] : []), ...chat];
}

describe("betting vocabulary", () => {
  it("is detected, while the city of Paris is allowed", () => {
    expect(findForbiddenWords("Fais ton pari")).toEqual(["pari"]);
    expect(findForbiddenWords("la mise de départ")).toEqual(["mise"]);
    expect(findForbiddenWords("Paris sportifs")).toEqual(["Paris sportifs"]);
    expect(findForbiddenWords("à 18 h, heure de Paris")).toEqual([]);
    expect(findForbiddenWords("pronostic, prono, points, joker, classement")).toEqual([]);
  });

  it("has files to scan", () => {
    expect(filesToScan().length).toBeGreaterThan(0);
  });

  it.each(filesToScan().map((file) => [path.relative(ROOT, file), file]))(
    "is absent from %s",
    (_, file) => {
      expect(findForbiddenWords(readFileSync(file, "utf8"))).toEqual([]);
    },
  );
});
