import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const localURL = `http://localhost:${PORT}`;

/**
 * Production smoke test (architecture §9.1), run by hand:
 * `BASE_URL=<production> npx playwright test e2e/prod-smoke.spec.ts`. With BASE_URL, only that
 * read-only file runs, against that address and without the local server: the other tests write in
 * their database. Without it, the smoke test is left out.
 */
const productionURL = process.env.BASE_URL;
const PROD_SMOKE = "prod-smoke.spec.ts";

export default defineConfig({
  testDir: "e2e",
  ...(productionURL ? { testMatch: PROD_SMOKE } : { testIgnore: PROD_SMOKE }),
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: productionURL ?? localURL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: productionURL
    ? undefined
    : {
        command: "npm run e2e:serve",
        // Ready once the server answers and reaches the PGlite database.
        url: `${localURL}/api/health`,
        timeout: 180_000,
        reuseExistingServer: false,
        env: {
          DB_DRIVER: "pglite",
          PGLITE_DIR: ".pglite-e2e",
          // Fixed test-only value, never used outside end-to-end tests.
          BETTER_AUTH_SECRET: "e2e-only-secret-0123456789abcdefghij",
          BETTER_AUTH_URL: localURL,
          ADMIN_EMAILS: "admin@example.test",
          TZ: "UTC",
        },
      },
});
