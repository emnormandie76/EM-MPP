import { expect, test } from "@playwright/test";
import { APP_NAME } from "../src/lib/app";

// Production smoke test (architecture §9.1), read-only: it signs nobody in and writes nothing.
// Run by hand, on the production address only:
//   BASE_URL=https://les-petits-pronos-de-la-promo.vercel.app npx playwright test e2e/prod-smoke.spec.ts
// (playwright.config.ts then runs this file alone, without the local server.)

test("/api/health answers ok: the database is reachable", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});

test("/connexion shows the sign-in form under the site's name, without indexing", async ({ page }) => {
  const response = await page.goto("/connexion");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await expect(page).toHaveTitle(`Connexion · ${APP_NAME}`);
  await expect(page.getByText(APP_NAME, { exact: true })).toBeAttached();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
});

test("an anonymous visitor is sent to /connexion", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/connexion$/);
});
