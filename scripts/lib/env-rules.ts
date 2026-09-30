import { z } from "zod";

// Variables required locally (architecture §3.1). Values are never returned, only statuses.
export type EnvStatus = "OK" | "MANQUANTE" | "INVALIDE";
export type EnvCheck = { name: string; status: EnvStatus; hint?: string };

type Rule = { name: string; problem: (value: string) => string | undefined };

const email = z.email();

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function postgresUrl(value: string): string | undefined {
  const url = parseUrl(value);
  const ok = url && (url.protocol === "postgres:" || url.protocol === "postgresql:") && url.hostname !== "";
  return ok ? undefined : "URL PostgreSQL attendue";
}

function httpUrl(value: string): string | undefined {
  const url = parseUrl(value);
  return url && (url.protocol === "http:" || url.protocol === "https:") ? undefined : "URL http(s) attendue";
}

function secret(value: string): string | undefined {
  return value.length >= 32 ? undefined : "au moins 32 caractères";
}

function emailList(value: string): string | undefined {
  const emails = value.split(",").map((item) => item.trim());
  const invalid = emails.filter((item) => !email.safeParse(item).success).length;
  if (invalid === 0) return undefined;
  return invalid === 1 ? "1 adresse invalide" : `${invalid} adresses invalides`;
}

export const ENV_RULES: readonly Rule[] = [
  { name: "DATABASE_URL", problem: postgresUrl },
  { name: "DATABASE_URL_UNPOOLED", problem: postgresUrl },
  { name: "BETTER_AUTH_SECRET", problem: secret },
  { name: "BETTER_AUTH_URL", problem: httpUrl },
  { name: "ADMIN_EMAILS", problem: emailList },
];

export function checkEnv(env: Record<string, string | undefined>): EnvCheck[] {
  return ENV_RULES.map(({ name, problem }) => {
    const value = env[name]?.trim();
    if (!value) return { name, status: "MANQUANTE" };
    const hint = problem(value);
    return hint ? { name, status: "INVALIDE", hint } : { name, status: "OK" };
  });
}
