// @next/env is a CommonJS bundle whose named exports Node cannot detect from ESM: go through its default export.
import nextEnv from "@next/env";

/**
 * Loads the env files the way `next dev` does (§3.1): .env.development.local, .env.local, .env.
 * On Vercel none of them exist, and the platform variables are used as they are.
 */
export function loadLocalEnv(): void {
  nextEnv.loadEnvConfig(process.cwd(), true);
}
