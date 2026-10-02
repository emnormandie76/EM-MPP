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

for (const url of [
  "/",
  "/pronos",
  "/questions",
  "/questions?onglet=annulees",
  "/profil",
  "/classement",
  "/palmares",
  "/reglement",
  "/lots",
  "/cette-page-n-existe-pas",
]) {
  test(`${url} (player) has no serious or critical accessibility violation`, async ({ page }) => {
    await signIn(page, ACCOUNTS.julien);
    await page.goto(url);
    expect(await blockingViolations(page)).toEqual([]);
  });
}

// §9.4: the page of an open question, with its form and its help.
test("/questions/<id> (open, player) has no serious or critical accessibility violation", async ({ page }) => {
  await signIn(page, ACCOUNTS.julien);
  await page.goto("/pronos");
  await page.getByRole("link", { name: "Combien de participants à la JPO du 15 novembre ?" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Combien de participants à la JPO du 15 novembre ?");
  // After a client navigation, Next streams the <title> later: axe would find none.
  await expect(page).toHaveTitle(/^Question · /);
  expect(await blockingViolations(page)).toEqual([]);
});

// §9.4: the pages of a resolved question (number and choice) and of a closed one, with their
// results; a player's profile.
for (const [tab, title] of [
  ["resolues", "Combien de participants à la JPO de septembre ?"],
  ["resolues", "Quel campus comptera le plus d'intégrés en Bachelor ?"],
  ["en-attente", "Combien d'inscrits au webinaire Grande École de septembre ?"],
]) {
  test(`/questions/<id> « ${title} » (player) has no serious or critical accessibility violation`, async ({ page }) => {
    await signIn(page, ACCOUNTS.julien);
    await page.goto(`/questions?onglet=${tab}`);
    // A full load, as for the other pages: after a client navigation, Next streams the <title> later.
    await page.goto((await page.getByRole("link", { name: title }).getAttribute("href"))!);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    expect(await blockingViolations(page)).toEqual([]);
  });
}

// v1.2 (§9.4): a closed question the player did not predict (« Les pronos s'afficheront au résultat »).
test("/questions/<id> (closed, without a prediction) has no serious or critical accessibility violation", async ({ page }) => {
  await signIn(page, ACCOUNTS.hugo);
  await page.goto("/questions?onglet=en-attente");
  const title = "Combien d'inscrits au webinaire Grande École de septembre ?";
  await page.goto((await page.getByRole("link", { name: title }).getAttribute("href"))!);
  await expect(page.getByText(/les pronos s'afficheront au résultat/)).toBeVisible();
  expect(await blockingViolations(page)).toEqual([]);
});

test("/joueurs/<id> (player) has no serious or critical accessibility violation", async ({ page }) => {
  await signIn(page, ACCOUNTS.julien);
  await page.goto("/classement");
  await page.goto((await page.getByRole("link", { name: "Sarah", exact: true }).getAttribute("href"))!);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sarah");
  await expect(page).toHaveTitle(/Joueur/);
  expect(await blockingViolations(page)).toEqual([]);
});

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

// §9.4: /admin/questions/<id>, on an open question (follow-up), on a closed one (result form) and on
// the closed one with an extension (v1.2).
for (const title of [
  "Combien de participants à la JPO du 15 novembre ?",
  "Combien de visiteurs sur le stand du salon Studyrama ?",
  "Combien d'inscrits au webinaire Grande École de septembre ?",
]) {
  test(`/admin/questions/<id> « ${title} » has no serious or critical accessibility violation`, async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto("/admin/questions");
    await page.getByRole("link", { name: title }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page).toHaveTitle(/^Question · /);
    expect(await blockingViolations(page)).toEqual([]);
  });
}

// §8.4, §8.5: at 390 px, the wide tables scroll in their container, which must then take the
// keyboard focus (axe "scrollable-region-focusable"); the colours stay readable on every background.
test.describe("at 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the player pages have no serious or critical accessibility violation", async ({ page }) => {
    await signIn(page, ACCOUNTS.julien);
    for (const url of ["/", "/pronos", "/classement", "/palmares", "/profil"]) {
      await page.goto(url);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await blockingViolations(page), url).toEqual([]);
    }
    await page.goto("/questions?onglet=resolues");
    await page.goto((await page.getByRole("link", { name: "Combien de candidatures Grande École au 31 mars ?" }).getAttribute("href"))!);
    // The table of the predictions overflows: its container is a named region in the tab order.
    await expect(page.getByRole("region", { name: "Pronos de tous les joueurs" })).toHaveAttribute("tabindex", "0");
    expect(await blockingViolations(page), "question résolue").toEqual([]);
    await page.goto("/classement");
    await page.goto((await page.getByRole("link", { name: "Sarah", exact: true }).getAttribute("href"))!);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sarah");
    expect(await blockingViolations(page), "profil de Sarah").toEqual([]);
  });

  test("the back-office pages have no serious or critical accessibility violation", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    for (const url of ["/admin/joueurs", "/admin/questions", "/admin/categories"]) {
      await page.goto(url);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await blockingViolations(page), url).toEqual([]);
    }
    await page.goto("/admin/questions");
    await page.getByRole("link", { name: "Combien de participants à la JPO du 15 novembre ?" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Combien de participants à la JPO du 15 novembre ?");
    await expect(page).toHaveTitle(/^Question · /);
    expect(await blockingViolations(page), "suivi d'une question ouverte").toEqual([]);
  });
});
