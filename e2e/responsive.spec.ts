import type { Page } from "@playwright/test";
import { seedSeasons } from "../scripts/lib/seed-seasons";
import { ACCOUNTS, expect, signIn, test } from "./fixtures";

// Architecture §8.4: at 390 × 844, the page never scrolls sideways (wide tables scroll in their own
// container) and every action stays reachable.

const SEASONS = seedSeasons(new Date());

test.use({ viewport: { width: 390, height: 844 } });

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, page.url()).toBeLessThanOrEqual(clientWidth);
}

/** The address of a seeded question, from a tab of /questions (its id depends on the seed). */
async function questionHref(page: Page, tab: string, title: string): Promise<string> {
  await page.goto(`/questions${tab}`);
  return (await page.getByRole("link", { name: title }).getAttribute("href"))!;
}

test("at 390 px the page does not scroll sideways and the menu opens", async ({ page }) => {
  await signIn(page, ACCOUNTS.sarah);
  await page.goto("/");
  await expectNoSidewaysScroll(page);

  await page.getByText("Menu", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Classement", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mon profil" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
});

for (const url of ["/connexion", "/inscription"]) {
  test(`${url} does not scroll sideways at 390 px`, async ({ page }) => {
    await page.goto(url);
    await expectNoSidewaysScroll(page);
  });
}

test("the player pages do not scroll sideways at 390 px", async ({ page }) => {
  await signIn(page, ACCOUNTS.julien);
  for (const url of ["/", "/pronos", "/questions", "/classement", "/chat", "/palmares", "/reglement", "/lots", "/profil"]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSidewaysScroll(page);
  }
});

// Open (two numbers), closed and resolved (number with a joker, choice) questions.
for (const [tab, title] of [
  ["", "Combien de participants à la JPO du 15 novembre ?"],
  ["", "Combien de candidatures Grande École au 31 mai ?"],
  ["?onglet=en-attente", "Combien d'inscrits au webinaire Grande École de septembre ?"],
  ["?onglet=resolues", "Combien de candidatures Grande École au 31 mars ?"],
  ["?onglet=resolues", "Quel campus comptera le plus d'intégrés en Bachelor ?"],
]) {
  test(`/questions/<id> « ${title} » does not scroll sideways at 390 px`, async ({ page }) => {
    await signIn(page, ACCOUNTS.julien);
    await page.goto(await questionHref(page, tab, title));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expectNoSidewaysScroll(page);
  });
}

test("on an open question at 390 px, the prediction field and both buttons fit the screen", async ({ page }) => {
  await signIn(page, ACCOUNTS.julien);
  await page.goto(await questionHref(page, "", "Combien de participants à la JPO du 15 novembre ?"));
  for (const target of [
    page.getByLabel("Ton prono", { exact: true }),
    page.getByRole("button", { name: "Enregistrer" }),
    page.getByRole("button", { name: "Valider" }),
  ]) {
    await expect(target).toBeInViewport({ ratio: 1 });
  }
});

test("/classement shows the compact standings at 390 px, with the malus and the links to the profiles", async ({ page }) => {
  await signIn(page, ACCOUNTS.hugo);
  await page.goto("/classement");
  // The wide table is hidden on a phone: it would push the malus out of the screen.
  await expect(page.getByRole("table")).toHaveCount(0);
  const list = page.getByRole("list", { name: `Classement de la saison ${SEASONS.current.label}` });
  await expect(list.getByRole("listitem").first()).toContainText(/^Rang 1.*Sarah.*\d+ de malus$/);
  await expect(list.getByRole("listitem").filter({ hasText: "Hugo" })).toContainText("(toi)");
  const julien = list.getByRole("link", { name: "Julien" });
  await expect(julien).toBeInViewport();
  await expect(julien).toHaveAttribute("href", /^\/joueurs\/[^?]+\?saison=\d+$/);
  await expectNoSidewaysScroll(page);
});

test("a player profile does not scroll sideways at 390 px", async ({ page }) => {
  await signIn(page, ACCOUNTS.julien);
  await page.goto("/classement");
  await page.getByRole("link", { name: "Sarah", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sarah");
  await expectNoSidewaysScroll(page);
});

/** Renames the signed-in player from /profil. */
async function rename(page: Page, name: string): Promise<void> {
  await page.goto("/profil");
  await page.getByLabel("Nom affiché").fill(name);
  await page.getByRole("button", { name: "Enregistrer le nom" }).click();
  await expect(page.getByText("Nom enregistré.")).toBeVisible();
}

// The seeded names are short. A long one (30 characters, the maximum, or « Ancien joueur 1 (inactif) »
// after an anonymization) widened the home page to 424 px (test report of 01/10/2026, R-01).
test("with a 30-character name, the pages that show it do not scroll sideways at 390 px", async ({ page, browser, extraHTTPHeaders }) => {
  const longName = "Wilhelmina-Maximiliana Wolfson";
  await signIn(page, ACCOUNTS.thomas);
  await rename(page, longName);
  try {
    // The home page always shows the viewer's row in the standings, with « (toi) ».
    for (const url of ["/", "/classement", "/profil"]) {
      await page.goto(url);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoSidewaysScroll(page);
    }
    await page.goto(await questionHref(page, "?onglet=resolues", "Combien de participants à la JPO de septembre ?"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Combien de participants à la JPO de septembre ?");
    await expectNoSidewaysScroll(page);
    await page.goto("/classement");
    await page.getByRole("link", { name: longName }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(longName);
    await expectNoSidewaysScroll(page);

    // The back office lists the name too: dashboard, accounts, follow-up of an open question.
    const admin = await browser.newContext({ baseURL: test.info().project.use.baseURL, extraHTTPHeaders, viewport: { width: 390, height: 844 } });
    const adminPage = await admin.newPage();
    await signIn(adminPage, ACCOUNTS.admin);
    for (const url of ["/admin", "/admin/joueurs"]) {
      await adminPage.goto(url);
      await expect(adminPage.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(adminPage.getByText(longName).first()).toBeAttached();
      await expectNoSidewaysScroll(adminPage);
    }
    await adminPage.goto("/admin/questions");
    await adminPage.goto((await adminPage.getByRole("link", { name: "Combien de participants à la JPO du 15 novembre ?" }).getAttribute("href"))!);
    await expect(adminPage.getByText(longName).first()).toBeAttached();
    await expectNoSidewaysScroll(adminPage);
    await admin.close();
  } finally {
    // Back to the seeded name, for the other tests.
    await rename(page, "Thomas");
  }
});

test("the back-office pages do not scroll sideways at 390 px", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  for (const url of ["/admin", "/admin/joueurs", "/admin/questions", "/admin/questions/nouvelle", "/admin/categories", "/admin/saisons", "/admin/annonces"]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSidewaysScroll(page);
  }
  // An open question (follow-up, history), a choice question (editor of the answers) and the closed
  // webinar question (extensions, v1.2).
  for (const title of [
    "Combien de participants à la JPO du 15 novembre ?",
    "Quel programme recevra le plus de candidatures en décembre ?",
    "Combien d'inscrits au webinaire Grande École de septembre ?",
  ]) {
    await page.goto("/admin/questions");
    await page.goto((await page.getByRole("link", { name: title }).getAttribute("href"))!);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expectNoSidewaysScroll(page);
  }
});

test("the extension dialog fits the screen at 390 px (v1.2)", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  await page.goto("/admin/questions");
  await page.goto((await page.getByRole("link", { name: "Combien d'inscrits au webinaire Grande École de septembre ?" }).getAttribute("href"))!);
  // Mehdi's extension, from the seed: its date can be changed.
  await page.getByRole("button", { name: "Changer la date limite de Mehdi" }).click();
  const dialog = page.getByRole("dialog", { name: "Changer la date de Mehdi" });
  for (const target of [dialog.getByLabel("Date limite (heure de Paris)"), dialog.getByRole("button", { name: "Annuler" }), dialog.getByRole("button", { name: "Enregistrer" })]) {
    await expect(target).toBeInViewport({ ratio: 1 });
  }
  await expectNoSidewaysScroll(page);
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(dialog).toBeHidden();
});

// v1.2 (§8.4, step 8d): the chat at 390 px: the message field, the emoji grid and the « Envoyer »
// button fit the screen, and a very long word wraps instead of widening the page.
test("/chat fits the screen at 390 px, emoji grid open, with a very long word", async ({ page }) => {
  await signIn(page, ACCOUNTS.julien);
  await page.goto("/chat");
  const longWord = `https://exemple.test/${"tres-long-".repeat(20)}`;
  await page.getByLabel("Ton message").fill(longWord);
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByRole("log", { name: "Messages du chat" }).getByText(longWord)).toBeVisible();
  // The address stays text: never a link (§5.15).
  await expect(page.getByRole("log", { name: "Messages du chat" }).getByRole("link", { name: longWord })).toHaveCount(0);
  await expectNoSidewaysScroll(page);

  await page.getByRole("button", { name: "Ajouter un emoji" }).click();
  const grid = page.getByRole("group", { name: "Emojis" });
  await expect(grid).toBeVisible();
  await expect(grid.getByRole("button", { name: "fusée" })).toBeInViewport();
  for (const control of [page.getByLabel("Ton message"), page.getByRole("button", { name: "Envoyer" })]) {
    await expect(control).toBeInViewport();
  }
  await expectNoSidewaysScroll(page);
});

// Step 8d (§8.2, decision of the user of 02/10/2026): with the Chat tab, the header is compacted
// between 1 024 and 1 279 px; at 1 024 px, it no longer widens the page, for an admin (one more
// link) as for a player, and every link of the navigation stays visible.
test.describe("at 1 024 px", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  for (const [who, email] of [
    ["an admin", ACCOUNTS.admin],
    ["a player", ACCOUNTS.julien],
  ] as const) {
    test(`the header fits the screen for ${who}`, async ({ page }) => {
      await signIn(page, email);
      for (const url of ["/", "/chat", "/classement"]) {
        await page.goto(url);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expectNoSidewaysScroll(page);
        const header = await page.getByRole("banner").locator("> div").evaluate((element) => element.scrollWidth - element.clientWidth);
        expect(header, url).toBeLessThanOrEqual(0);
      }
      const navigation = page.getByRole("navigation", { name: "Navigation principale" });
      for (const label of ["Accueil", "Mes pronos", "Classement", "Chat", "Palmarès", "Règlement"]) {
        await expect(navigation.getByRole("link", { name: new RegExp(`^${label}`) })).toBeInViewport();
      }
      await expect(page.getByRole("banner").locator("summary[aria-label^='Mon compte']")).toBeInViewport();
    });
  }
});
