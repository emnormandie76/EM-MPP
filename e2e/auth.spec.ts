import type { Page } from "@playwright/test";
import { ACCOUNTS, expect, SEED_PASSWORD, signIn, signOut, test } from "./fixtures";

// Accounts and access (architecture §11 É4). Each test that writes uses its own seeded accounts.

async function fillSignUp(page: Page, email: string, name: string, password = SEED_PASSWORD) {
  await page.goto("/inscription");
  await page.getByLabel("Email professionnel").fill(email);
  await page.getByLabel("Nom affiché").fill(name);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByLabel("Confirmation du mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
}

test("sign-up is refused to an address outside the allow list", async ({ page }) => {
  await fillSignUp(page, "inconnu@example.test", "Inconnu");
  await expect(page.getByText("Cette adresse n'est pas sur la liste des joueurs. Contacte l'admin.").first()).toBeVisible();
  await expect(page).toHaveURL("/inscription");
});

test("nouveau1@example.test signs up and lands on the home page", async ({ page }) => {
  await fillSignUp(page, "Nouveau1@Example.test", "Nina");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "Bonjour Nina" })).toBeVisible();
  await expect(page.getByRole("banner")).toContainText("Nina");
});

test("a player signs out", async ({ page }) => {
  await signIn(page, ACCOUNTS.sarah);
  await signOut(page);
  await page.goto("/");
  await expect(page).toHaveURL("/connexion");
});

test("a wrong password shows a message", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill(ACCOUNTS.sarah);
  await page.getByLabel("Mot de passe").fill("Mauvais-1234!");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Email ou mot de passe incorrect.")).toBeVisible();
  await expect(page).toHaveURL("/connexion");
  // The address stays filled in.
  await expect(page.getByLabel("Email")).toHaveValue(ACCOUNTS.sarah);
});

test("a player signs in and sees the header, without the admin link", async ({ page }) => {
  await signIn(page, ACCOUNTS.sarah);
  await expect(page.getByRole("heading", { level: 1, name: "Bonjour Sarah" })).toBeVisible();
  await expect(page.getByRole("banner")).toContainText("Sarah");
  await expect(page.getByRole("banner").getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("an anonymous visitor is sent to /connexion", async ({ page }) => {
  for (const url of ["/", "/profil", "/admin/joueurs"]) {
    await page.goto(url);
    await expect(page).toHaveURL("/connexion");
  }
});

test("a player gets the 404 page on the back office", async ({ page }) => {
  await signIn(page, ACCOUNTS.sarah);
  for (const url of ["/admin", "/admin/joueurs"]) {
    const response = await page.goto(url);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Cette page n'existe pas." })).toBeVisible();
  }
});

test("the admin reaches /admin/joueurs from the header", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  await page.getByRole("banner").getByRole("link", { name: "Admin" }).click();
  await expect(page).toHaveURL("/admin");
  await page.getByRole("navigation", { name: "Back-office" }).getByRole("link", { name: "Joueurs" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Joueurs" })).toBeVisible();
  const accounts = page.getByRole("table", { name: "Comptes des joueurs" });
  await expect(accounts.getByRole("row").filter({ hasText: ACCOUNTS.sarah })).toContainText("Joueur");
  await expect(accounts.getByRole("row").filter({ hasText: ACCOUNTS.admin })).toContainText("C'est toi");
  const allowList = page.getByRole("table", { name: "Adresses de la liste blanche" });
  await expect(allowList.getByRole("row").filter({ hasText: "nouveau1@example.test" })).toBeVisible();
});

test("the admin adds nouveau2@example.test, who can then sign up", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  await page.goto("/admin/joueurs");
  await page.getByLabel("Adresses à ajouter").fill("Nouveau2@example.test\npas-une-adresse");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("1 ajoutée, 0 déjà présente, 1 invalide. À corriger : pas-une-adresse")).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Adresses de la liste blanche" }).getByRole("row").filter({ hasText: "nouveau2@example.test" }),
  ).toContainText("Non");

  await signOut(page);
  await fillSignUp(page, "nouveau2@example.test", "Noé");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "Bonjour Noé" })).toBeVisible();
});

test("a disabled account cannot sign in", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill(ACCOUNTS.disabled);
  await page.getByLabel("Mot de passe").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Ton compte est désactivé. Contacte l'admin.")).toBeVisible();
  await expect(page).toHaveURL("/connexion");
});

test("a new display name shows in the header", async ({ page }) => {
  await signIn(page, "joueur5@example.test");
  const rename = async (name: string) => {
    await page.goto("/profil");
    await page.getByLabel("Nom affiché").fill(name);
    await page.getByRole("button", { name: "Enregistrer le nom" }).click();
    await expect(page.getByText("Nom enregistré.")).toBeVisible();
    await expect(page.getByRole("banner")).toContainText(name);
  };
  await rename("Thomas R.");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Bonjour Thomas R." })).toBeVisible();
  // Back to the seeded name, for the other tests.
  await rename("Thomas");
});

test("a temporary password lets the player in, who then changes it in the profile", async ({ page, browser, extraHTTPHeaders }) => {
  await signIn(page, ACCOUNTS.admin);
  await page.goto("/admin/joueurs");
  await page
    .getByRole("table", { name: "Comptes des joueurs" })
    .getByRole("row")
    .filter({ hasText: ACCOUNTS.hugo })
    .getByRole("button", { name: "Mot de passe provisoire" })
    .click();
  const confirm = page.getByRole("dialog", { name: "Mot de passe provisoire" });
  await confirm.getByRole("button", { name: "Créer le mot de passe" }).click();
  const shown = page.getByTestId("temporary-password");
  await expect(shown).toHaveText(/^[A-HJ-NP-Za-km-np-z2-9]{12}$/);
  const temporary = (await shown.textContent())!;
  await page.getByRole("button", { name: "Terminé" }).click();
  await signOut(page);

  await signIn(page, ACCOUNTS.hugo, temporary);
  // A second session, on another browser: the password change closes it.
  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL, extraHTTPHeaders });
  const otherPage = await other.newPage();
  await signIn(otherPage, ACCOUNTS.hugo, temporary);

  await page.goto("/profil");
  await page.getByLabel("Mot de passe actuel").fill(temporary);
  await page.getByLabel("Nouveau mot de passe", { exact: true }).fill(SEED_PASSWORD);
  await page.getByLabel("Confirmation du nouveau mot de passe").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Changer le mot de passe" }).click();
  await expect(page.getByText("Mot de passe changé.")).toBeVisible();
  // The current session is kept, the other one is closed.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Bonjour Hugo" })).toBeVisible();
  await otherPage.goto("/");
  await expect(otherPage).toHaveURL("/connexion");
  await other.close();

  await signOut(page);
  await signIn(page, ACCOUNTS.hugo);
});
