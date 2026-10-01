import { seedSeasons } from "../scripts/lib/seed-seasons";
import { ACCOUNTS, expect, signIn, test } from "./fixtures";

test("home page answers with the B5 header, in French", async ({ page }) => {
  await signIn(page, ACCOUNTS.sarah);
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");

  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  const logo = page.getByRole("banner").getByRole("link", { name: "Le Bon Chiffre" });
  await expect(logo).toBeVisible();
  await expect(logo).toHaveText("LE BON CHIFFRE", { useInnerText: true });
  await expect(
    page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Accueil" }),
  ).toHaveAttribute("aria-current", "page");
});

test("the footer shows the current season, computed on each request", async ({ page }) => {
  await signIn(page, ACCOUNTS.sarah);
  await expect(page.getByRole("contentinfo")).toContainText(`Saison ${seedSeasons(new Date()).current.label}`);
});

test("an unknown address shows the French 404 page", async ({ page }) => {
  await signIn(page, ACCOUNTS.sarah);
  const response = await page.goto("/cette-page-n-existe-pas");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Cette page n'existe pas." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Retour à l'accueil" })).toHaveAttribute("href", "/");
});
