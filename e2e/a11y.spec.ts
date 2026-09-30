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

const ADMIN_PAGES = [
  "/admin",
  "/admin/joueurs",
  "/admin/questions",
  "/admin/questions/nouvelle",
  "/admin/categories",
  "/admin/saisons",
  "/admin/annonces",
];

for (const url of ADMIN_PAGES) {
  test(`${url} (admin) has no serious or critical accessibility violation`, async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto(url);
    expect(await blockingViolations(page)).toEqual([]);
  });
}

// §9.4: /admin/questions/<id>, on an open question (follow-up) and on a closed one (result form).
for (const title of ["Combien de participants à la JPO du 15 novembre ?", "Combien de visiteurs sur le stand du salon Studyrama ?"]) {
  test(`/admin/questions/<id> « ${title} » has no serious or critical accessibility violation`, async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto("/admin/questions");
    await page.getByRole("link", { name: title }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    expect(await blockingViolations(page)).toEqual([]);
  });
}
