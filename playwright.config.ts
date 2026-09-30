import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run e2e:serve",
    // Step 2 switches this to /api/health once the database is wired.
    url: `${baseURL}/`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      DB_DRIVER: "pglite",
      PGLITE_DIR: ".pglite-e2e",
      // Fixed test-only value, never used outside end-to-end tests.
      BETTER_AUTH_SECRET: "e2e-only-secret-0123456789abcdefghij",
      BETTER_AUTH_URL: baseURL,
      ADMIN_EMAILS: "admin@example.test",
      TZ: "UTC",
    },
  },
});
