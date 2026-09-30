import { ACCOUNTS, expect, test } from "./fixtures";

// Attempt limit (architecture §6.1): 5 sign-in attempts per minute and per address.

test("the 6th failed attempt within a minute shows « Trop de tentatives »", async ({ page }) => {
  await page.goto("/connexion");
  const statuses: number[] = [];
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await page.getByLabel("Email").fill(ACCOUNTS.julien);
    await page.getByLabel("Mot de passe").fill(`Mauvais-${attempt}!`);
    const response = page.waitForResponse((r) => r.url().endsWith("/api/auth/sign-in/email"));
    await page.getByRole("button", { name: "Se connecter" }).click();
    statuses.push((await response).status());
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeEnabled();
  }
  expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
  await expect(page.getByText("Trop de tentatives. Réessaie dans une minute.")).toBeVisible();
  await expect(page).toHaveURL("/connexion");
});
