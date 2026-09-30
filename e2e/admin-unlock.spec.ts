import { ACCOUNTS, expect, signIn, signOut, test } from "./fixtures";

// Unlocking (architecture §5.4, §11 É6): Mehdi validated his prediction on the seeded choice
// question; at his request, the admin unlocks it, and he can change it again.

const TITLE = "Quel programme recevra le plus de candidatures en décembre ?";

test("the admin unlocks a validated prediction; the player can change it again", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  await page.goto("/admin/questions");
  await page.getByRole("link", { name: TITLE }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
  const questionPath = new URL(page.url()).pathname.replace("/admin", "");

  const row = page.getByRole("table", { name: "Suivi des joueurs" }).getByRole("row").filter({ hasText: "Mehdi" });
  await expect(row).toContainText("Validé");
  // Only validated predictions can be unlocked.
  await expect(
    page.getByRole("table", { name: "Suivi des joueurs" }).getByRole("row").filter({ hasText: "Inès" }).getByRole("button"),
  ).toHaveCount(0);
  await row.getByRole("button", { name: "Déverrouiller le prono de Mehdi" }).click();
  await expect(row).toContainText("Enregistré");
  await expect(row.getByRole("button", { name: "Déverrouiller le prono de Mehdi" })).toHaveCount(0);

  // The history names the admin, without any value before the closing.
  const history = page.getByRole("table", { name: "Historique des pronos" });
  await expect(history.getByRole("row").filter({ hasText: "Mehdi" }).first()).toContainText("Déverrouillé par Admin");
  await expect(history.getByRole("columnheader", { name: "Prono" })).toHaveCount(0);

  await signOut(page);
  await signIn(page, ACCOUNTS.mehdi);
  await page.goto(questionPath);
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "MSc" }).check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Prono enregistré.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio", { name: "MSc" })).toBeChecked();
});
