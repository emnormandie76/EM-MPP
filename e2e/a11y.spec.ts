import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ACCOUNTS, expect, signIn, test } from "./fixtures";

// Architecture §9.4: no "serious" or "critical" violation. Pages are added step by step.

async function blockingViolations(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(" ")).join(", ")})`);
}

for (const url of ["/connexion", "/inscription"]) {
  test(`${url} has no serious or critical accessibility violation`, async ({ page }) => {
    await page.goto(url);
    expect(await blockingViolations(page)).toEqual([]);
  });
}

for (const url of ["/", "/profil", "/cette-page-n-existe-pas"]) {
  test(`${url} (player) has no serious or critical accessibility violation`, async ({ page }) => {
    await signIn(page, ACCOUNTS.julien);
    await page.goto(url);
    expect(await blockingViolations(page)).toEqual([]);
  });
}

for (const url of ["/admin", "/admin/joueurs"]) {
  test(`${url} (admin) has no serious or critical accessibility violation`, async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto(url);
    expect(await blockingViolations(page)).toEqual([]);
  });
}
