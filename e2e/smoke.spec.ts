import { expect, test } from "@playwright/test";
import { seasonLabelFor } from "../src/lib/game/time";

test("home page answers with the B5 header, in French", async ({ page }) => {
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
  await page.goto("/");
  await expect(page.getByRole("contentinfo")).toContainText(`Saison ${seasonLabelFor(new Date())}`);
});

test("an unknown address shows the French 404 page", async ({ page }) => {
  const response = await page.goto("/cette-page-n-existe-pas");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Cette page n'existe pas." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Retour à l'accueil" })).toHaveAttribute("href", "/");
});

test("at 390 px the page does not scroll sideways and the menu opens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);

  await page.getByText("Menu", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Classement" })).toBeVisible();
});
