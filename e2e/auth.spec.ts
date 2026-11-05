import { APP_NAME } from "../src/lib/app";
import { ACCOUNTS, expect, FAKE_PORTAIL_ORIGIN, readPortail, setPortail, signIn, test } from "./fixtures";

// Accounts and access (architecture §6.2, §11 É4). The sign-in flow runs for real here, against the
// fake portal; everywhere else, signIn() gives the browser a session (D8).

const SCHOOL = "em-normandie.fr";
const PORTAIL_PAGE = new RegExp(`^${FAKE_PORTAIL_ORIGIN}/api/auth/oauth2/authorize`);
const NEUTRAL_MESSAGE = "La connexion n'a pas abouti. Retourne sur le portail pour réessayer.";

test.beforeEach(async ({ request }) => {
  await setPortail(request, {});
});

test("an anonymous visitor goes straight to the portal", async ({ page }) => {
  for (const url of ["/", "/profil", "/admin/joueurs"]) {
    await page.goto(url);
    await expect(page).toHaveURL(PORTAIL_PAGE);
    await expect(page.getByRole("heading", { level: 1, name: "Portail de test" })).toBeVisible();
  }
});

test("the tile leads straight to the game when the portal has a session, and links the account by its address", async ({
  page,
  request,
}) => {
  await setPortail(request, { identity: { sub: "sub-ines", email: "joueur3@example.test", name: "Inès Martin", role: "player" } });
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "Salut Inès" })).toBeVisible();
});

test("the button signs a new player in through the portal, and creates the account", async ({ page, request }) => {
  await setPortail(request, { identity: { sub: "sub-nina", email: `nina@${SCHOOL}`, name: "Nina", role: "player" } });
  await page.goto("/connexion");
  await page.getByRole("button", { name: "Se connecter avec le portail" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "Salut Nina" })).toBeVisible();
  await expect(page.getByRole("banner")).toContainText("Nina");
});

test("signing out goes through the portal, and stays on the page of the button", async ({ page, request }) => {
  await setPortail(request, { identity: { sub: "sub-noe", email: `noe@${SCHOOL}`, name: "Noé", role: "player" } });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Salut Noé" })).toBeVisible();

  const before = (await readPortail(request)).authorizeCount;
  await page.getByRole("banner").locator("summary[aria-label^='Mon compte']").click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL("/connexion");
  await expect(page.getByRole("button", { name: "Se connecter avec le portail" })).toBeEnabled();

  const report = await readPortail(request);
  expect(report.logoutRequests.at(-1)).toMatchObject({
    client_id: expect.any(String),
    id_token_hint: expect.any(String),
    post_logout_redirect_uri: `${test.info().project.use.baseURL}/connexion`,
  });
  // The portal closed its session, and the flow did not start again by itself.
  expect(report.state.identity).toBeNull();
  expect(report.authorizeCount).toBe(before);

  // The session is really gone: the next visit goes back to the portal.
  await page.goto("/");
  await expect(page).toHaveURL(PORTAIL_PAGE);
});

test("a refusal comes back as a neutral message with a link to the portal, without any loop", async ({ page, request }) => {
  await setPortail(request, { authorizeError: "access_denied" });
  const before = (await readPortail(request)).authorizeCount;

  await page.goto("/");
  await expect(page).toHaveURL("/connexion?error=access_denied");
  await expect(page.getByText(NEUTRAL_MESSAGE)).toBeVisible();
  await expect(page.getByRole("link", { name: "Aller sur le portail" })).toHaveAttribute("href", FAKE_PORTAIL_ORIGIN);

  // One request, not one more: the page does not start the flow again.
  await page.waitForTimeout(500);
  expect((await readPortail(request)).authorizeCount).toBe(before + 1);
});

test("a role the site does not know refuses the sign-in", async ({ page, request }) => {
  await setPortail(request, { identity: { sub: "sub-iris", email: `iris@${SCHOOL}`, name: "Iris", role: "superviseur" } });
  await page.goto("/");
  await expect(page).toHaveURL(/\/connexion\?error=role_not_allowed/);
  await expect(page.getByText(NEUTRAL_MESSAGE)).toBeVisible();
});

test("the role of the portal applies at the next sign-in: the back office opens, then closes", async ({ page, request }) => {
  const identity = { sub: "sub-yann", email: `yann@${SCHOOL}`, name: "Yann", role: "admin" };
  await setPortail(request, { identity });
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "Admin" })).toBeVisible();

  await page.context().clearCookies();
  await setPortail(request, { identity: { ...identity, role: "player" } });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Salut Yann" })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("the password and sign-up routes are closed", async ({ request }) => {
  for (const path of ["/api/auth/sign-in/email", "/api/auth/sign-up/email"]) {
    const response = await request.post(path, { data: { email: ACCOUNTS.sarah, password: "Test-1234!", name: "Sarah" } });
    expect(response.status(), path).toBe(404);
  }
});

test("a player signs in and sees the header, without the admin link", async ({ page }) => {
  await signIn(page, ACCOUNTS.sarah);
  await expect(page.getByRole("heading", { level: 1, name: "Salut Sarah" })).toBeVisible();
  await expect(page.getByRole("banner")).toContainText("Sarah");
  await expect(page.getByRole("banner").getByRole("link", { name: "Admin" })).toHaveCount(0);
});

test("the profile no longer has a password form", async ({ page }) => {
  await signIn(page, ACCOUNTS.sarah);
  await page.goto("/profil");
  await expect(page.getByRole("heading", { level: 2, name: "Mon nom" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Mot de passe" })).toHaveCount(0);
});

test("a player gets the 404 page on the back office, without the title of the page", async ({ page }) => {
  await signIn(page, ACCOUNTS.sarah);
  // Every back-office page, with its tab title: none may reach the player (test report of 01/10/2026, R-02).
  for (const [url, title] of [
    ["/admin", "Back-office"],
    ["/admin/questions", "Questions"],
    ["/admin/questions/nouvelle", "Nouvelle question"],
    ["/admin/questions/1", "Question"],
    ["/admin/joueurs", "Joueurs"],
    ["/admin/categories", "Catégories"],
    ["/admin/saisons", "Saisons et lots"],
    ["/admin/annonces", "Annonces"],
  ]) {
    const response = await page.goto(url);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Cette page n'existe pas." })).toBeVisible();
    // The same tab title as an unknown address.
    await expect(page).toHaveTitle(APP_NAME);
    expect(await response!.text(), url).not.toContain(`${title} · ${APP_NAME}`);
  }
});

test("the admin reaches /admin/joueurs from the header: the accounts, read only, and a link to the portal", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  await page.getByRole("banner").getByRole("link", { name: "Admin" }).click();
  await expect(page).toHaveURL("/admin");
  await expect(page).toHaveTitle(`Back-office · ${APP_NAME}`);
  await page.getByRole("navigation", { name: "Back-office" }).getByRole("link", { name: "Joueurs" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Joueurs" })).toBeVisible();
  await expect(page).toHaveTitle(`Joueurs · ${APP_NAME}`);
  await expect(page.getByRole("link", { name: "Aller sur le portail" })).toHaveAttribute("href", FAKE_PORTAIL_ORIGIN);

  const accounts = page.getByRole("table", { name: "Comptes des joueurs" });
  const sarah = accounts.getByRole("row").filter({ hasText: ACCOUNTS.sarah });
  await expect(sarah).toContainText("Joueur");
  await expect(sarah.getByRole("button", { name: "Anonymiser" })).toBeVisible();
  await expect(sarah.getByRole("button")).toHaveCount(1);
  await expect(accounts.getByRole("row").filter({ hasText: ACCOUNTS.admin })).toContainText("C'est toi");
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
  await expect(page.getByRole("heading", { level: 1, name: "Salut Thomas R." })).toBeVisible();
  // Back to the seeded name, for the other tests.
  await rename("Thomas");
});
