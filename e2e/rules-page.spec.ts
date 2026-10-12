import { APP_NAME } from "../src/lib/app";
import { ACCOUNTS, expect, signIn, test } from "./fixtures";

// v1.4 (architecture §6.4, point 6, §11 É8e, decision of the user of 12/10/2026): until step 10, the
// rules page is for admins only. A player gets the 404 page, and no link shows it to them. These tests
// only read the seed.

const NOTICE =
  "Page réservée aux admins pour l'instant : les joueurs ne la voient pas. Elle leur sera ouverte avec les règles réglables par saison.";

test("a player gets the 404 page on /reglement, without the title of the page", async ({ page }) => {
  await signIn(page, ACCOUNTS.lea);
  const response = await page.goto("/reglement");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Cette page n'existe pas." })).toBeVisible();
  // The same tab title as an unknown address, and none of the content.
  await expect(page).toHaveTitle(APP_NAME);
  const html = await response!.text();
  expect(html).not.toContain(`Règlement · ${APP_NAME}`);
  expect(html).not.toContain("Prolongation pour un absent");
  expect(html).not.toContain("Page réservée aux admins");
});

test("a player sees no link to the rules: header, phone menu, footer and /lots", async ({ page }) => {
  await signIn(page, ACCOUNTS.lea);
  await page.goto("/lots");
  await expect(page.getByRole("heading", { level: 1, name: "Lots" })).toBeVisible();

  // The header (from 1 024 px) and the footer keep their other links.
  const navigation = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(navigation.getByRole("link", { name: "Palmarès" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: /règlement/i })).toHaveCount(0);
  const footer = page.getByRole("navigation", { name: "Liens utiles" });
  await expect(footer.getByRole("link")).toHaveText(["Lots", "Palmarès"]);
  // No separator left before « Lots ».
  await expect(footer).toHaveText("Lots·Palmarès");

  // /lots: the sentence, without the link nor a stray colon.
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: /règlement/i })).toHaveCount(0);
  await expect(main.getByText("Barème, jokers et départage : demande à l'admin.", { exact: true })).toBeVisible();

  // Nowhere in the page, not even in the closed phone menu.
  await expect(page.locator('a[href="/reglement"]')).toHaveCount(0);

  // The phone menu.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Menu", { exact: true }).click();
  const menu = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(menu.getByRole("link", { name: "Palmarès" })).toBeVisible();
  await expect(menu.getByRole("link", { name: /règlement/i })).toHaveCount(0);
});

test("the admin sees the rules page, with its notice, and every link to it", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);

  // The header tab.
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Règlement" }).click();
  await expect(page).toHaveURL("/reglement");
  await expect(page.getByRole("heading", { level: 1, name: "Règlement" })).toBeVisible();
  await expect(page).toHaveTitle(`Règlement · ${APP_NAME}`);
  await expect(page.getByText(NOTICE, { exact: true })).toBeVisible();
  // The content does not change.
  await expect(page.getByRole("region", { name: "Principe" })).toContainText("le moins de malus gagne");
  await expect(page.getByRole("region", { name: "Lots" })).toBeVisible();

  // The footer.
  const footer = page.getByRole("navigation", { name: "Liens utiles" });
  await expect(footer.getByRole("link")).toHaveText(["Règlement", "Lots", "Palmarès"]);
  await expect(footer.getByRole("link", { name: "Règlement" })).toHaveAttribute("href", "/reglement");

  // /lots.
  await page.goto("/lots");
  await expect(page.getByRole("main").getByRole("link", { name: "lire le règlement" })).toHaveAttribute("href", "/reglement");

  // The phone menu.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Menu", { exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Règlement" })).toBeVisible();
});
