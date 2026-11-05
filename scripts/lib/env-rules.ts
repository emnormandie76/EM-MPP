// Variables required locally (architecture §3.1). Values are never returned, only statuses.
export type EnvStatus = "OK" | "MANQUANTE" | "INVALIDE";
export type EnvCheck = { name: string; status: EnvStatus; hint?: string };

type Rule = { name: string; problem: (value: string) => string | undefined };

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

/** The portal's issuer: compared exactly, without a trailing slash (contract §3.3). */
function issuerUrl(value: string): string | undefined {
  if (httpUrl(value)) return "URL http(s) attendue";
  return value.endsWith("/") ? "sans barre finale" : undefined;
}

function present(): undefined {
  return undefined;
}

export const ENV_RULES: readonly Rule[] = [
  { name: "DATABASE_URL", problem: postgresUrl },
  { name: "DATABASE_URL_UNPOOLED", problem: postgresUrl },
  { name: "BETTER_AUTH_SECRET", problem: secret },
  { name: "BETTER_AUTH_URL", problem: httpUrl },
  { name: "PORTAIL_ISSUER", problem: issuerUrl },
  { name: "PORTAIL_CLIENT_ID", problem: present },
  { name: "PORTAIL_CLIENT_SECRET", problem: present },
];

export function checkEnv(env: Record<string, string | undefined>): EnvCheck[] {
  return ENV_RULES.map(({ name, problem }) => {
    const value = env[name]?.trim();
    if (!value) return { name, status: "MANQUANTE" };
    const hint = problem(value);
    return hint ? { name, status: "INVALIDE", hint } : { name, status: "OK" };
  });
}
