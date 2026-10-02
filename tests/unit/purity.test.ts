import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Architecture §1.1 and §9.3: the rules of the game are pure functions. The time is a parameter
// (no Date.now(), no new Date() without argument), and they never import Next or the database.
// The rules of the chat (src/lib/chat, step 8d) follow the same rule.
const FORBIDDEN = [
  /\bDate\.now\s*\(/g,
  /\bnew\s+Date\s*\(\s*\)/g,
  /from\s+["'](next|next\/[^"']*|react|server-only|drizzle-orm[^"']*|pg|better-auth[^"']*|@\/lib\/(db|auth|data|services|actions)[^"']*)["']/g,
];

const GAME_DIR = fileURLToPath(new URL("../../src/lib/game", import.meta.url));
const CHAT_DIR = fileURLToPath(new URL("../../src/lib/chat", import.meta.url));

function filesOf(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".ts"))
    .map((file) => path.join(dir, file));
}

function findForbidden(text: string): string[] {
  return FORBIDDEN.flatMap((pattern) => text.match(pattern) ?? []);
}

describe("purity of src/lib/game", () => {
  it("detects the forbidden patterns", () => {
    expect(findForbidden("const t = Date.now();")).toEqual(["Date.now("]);
    expect(findForbidden("const t = new Date();")).toEqual(["new Date()"]);
    expect(findForbidden("const t = new Date(value);")).toEqual([]);
    expect(findForbidden('import { getDb } from "@/lib/db/client";')).toHaveLength(1);
    expect(findForbidden('import { redirect } from "next/navigation";')).toHaveLength(1);
    expect(findForbidden('import { sql } from "drizzle-orm";')).toHaveLength(1);
    expect(findForbidden('import { TZDate } from "@date-fns/tz";')).toEqual([]);
    expect(findForbidden('import { scoreQuestion } from "./scoring";')).toEqual([]);
  });

  it("has files to scan", () => {
    expect(filesOf(GAME_DIR).length).toBeGreaterThanOrEqual(12);
  });

  it.each(filesOf(GAME_DIR).map((file) => [path.basename(file), file]))("%s reads no clock and imports no framework", (_, file) => {
    expect(findForbidden(readFileSync(file, "utf8"))).toEqual([]);
  });
});

describe("purity of src/lib/chat", () => {
  it("has files to scan", () => {
    expect(filesOf(CHAT_DIR).length).toBeGreaterThanOrEqual(4);
  });

  it.each(filesOf(CHAT_DIR).map((file) => [path.basename(file), file]))("%s reads no clock and imports no framework", (_, file) => {
    expect(findForbidden(readFileSync(file, "utf8"))).toEqual([]);
  });
});
