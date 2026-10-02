import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { APP_NAME, APP_NAME_LINES } from "@/lib/app";

// Architecture §11, É8b: the site is renamed. No form of the former name may stay in the code and
// the tests: « Le Bon Chiffre », « LE BON CHIFFRE », `le-bon-chiffre`, `leBonChiffre`, `le_bon_chiffre`…
const FORMER_NAME = /bon[\s_-]*chiffre/gi;

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const THIS_FILE = fileURLToPath(import.meta.url);

function filesToScan(): string[] {
  return ["src", "e2e", "tests"].flatMap((folder) => {
    const dir = path.join(ROOT, folder);
    return readdirSync(dir, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.(tsx?|css|json)$/.test(file))
      .map((file) => path.join(dir, file))
      .filter((file) => path.resolve(file) !== path.resolve(THIS_FILE));
  });
}

describe("site name", () => {
  it("is « Les petits pronos de la promo », shown by the logo on two lines", () => {
    expect(APP_NAME).toBe("Les petits pronos de la promo");
    expect(APP_NAME_LINES.join(" ")).toBe(APP_NAME);
  });

  it("detects every form of the former name", () => {
    const forms = ["Le Bon Chiffre", "LE BON CHIFFRE", "le-bon-chiffre", "leBonChiffreDb", "le_bon_chiffre", "Bon Chiffre"];
    expect(forms.filter((form) => form.match(FORMER_NAME))).toEqual(forms);
    expect("le bon chiffre de l'école".match(FORMER_NAME)).not.toBeNull();
    expect("les chiffres de l'école".match(FORMER_NAME)).toBeNull();
  });

  it("has files to scan", () => {
    expect(filesToScan().length).toBeGreaterThan(100);
  });

  it.each(filesToScan().map((file) => [path.relative(ROOT, file), file]))("former name absent from %s", (_, file) => {
    expect(readFileSync(file, "utf8").match(FORMER_NAME)).toBeNull();
  });
});
