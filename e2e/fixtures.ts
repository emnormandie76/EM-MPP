import { expect, type Page, test as base } from "@playwright/test";

// Shared end-to-end helpers (architecture §9.4).

export const SEED_PASSWORD = "Test-1234!";

export const ACCOUNTS = {
  admin: "admin@example.test",
  sarah: "joueur1@example.test",
  julien: "joueur2@example.test",
  camille: "joueur4@example.test",
  thomas: "joueur5@example.test",
  mehdi: "joueur6@example.test",
  lea: "joueur7@example.test",
  hugo: "joueur8@example.test",
  disabled: "desactive@example.test",
} as const;

/** A distinct client address per test, from the testId: the attempt limits count per address (§6.1). */
function clientAddress(testId: string): string {
  let hash = 0;
  for (const char of testId) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return `10.${(hash >>> 16) & 255}.${(hash >>> 8) & 255}.${hash & 255}`;
}

export const test = base.extend({
  // Next.js keeps the incoming x-forwarded-for; on Vercel, the platform sets it.
  // (The second parameter is Playwright's `use`, renamed: the React hooks lint rule would flag it.)
  extraHTTPHeaders: async ({ extraHTTPHeaders }, provide, testInfo) => {
    await provide({ ...extraHTTPHeaders, "x-forwarded-for": clientAddress(`${testInfo.testId}-${testInfo.retry}`) });
  },
});

export { expect };

/** Signs in through the /connexion form and waits for the home page. */
export async function signIn(page: Page, email: string, password = SEED_PASSWORD): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Salut");
}

/** Opens the account menu (from 1 024 px) and signs out. */
export async function signOut(page: Page): Promise<void> {
  await page.getByRole("banner").locator("summary[aria-label^='Mon compte']").click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL("/connexion");
}
