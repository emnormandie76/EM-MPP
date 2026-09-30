import { utcToParisLocalDate, utcToParisLocalInput } from "../src/lib/game/time";
import { seedSeasons } from "../scripts/lib/seed-seasons";
import { ACCOUNTS, expect, signIn, test } from "./fixtures";

// Seasons created by the admin (architecture §5.13, §11 É5b). The seed's current season has no
// end: a season created in the future takes over the questions that close after its start.

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY_MS);

test("the admin creates a future season, renames it, moves its start, then deletes it", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  const currentSeason = seedSeasons(new Date()).current.label;

  // A draft that closes in 70 days, in the seed's current season for now.
  const title = "Combien de visiteurs au salon de printemps ?";
  await page.goto("/admin/questions/nouvelle");
  await page.getByLabel("Catégorie").selectOption({ label: "JPO" });
  await page.getByLabel("Énoncé").fill(title);
  await page.getByLabel("Source").fill("Compteur du stand, relevé par l'équipe salons");
  await page.getByLabel("Clôture").fill(`${utcToParisLocalInput(inDays(70)).slice(0, 10)}T18:00`);
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(page).toHaveURL(/\/admin\/questions\/\d+\?creee=1$/);
  const questionUrl = page.url().replace(/\?.*$/, "");
  await expect(page.getByRole("main").getByText(`saison ${currentSeason}`)).toBeVisible();

  // Creation, 60 days from now: the draft moves to the new season.
  await page.goto("/admin/saisons");
  await page.getByLabel("Date de début").fill(utcToParisLocalDate(inDays(60)));
  await page.getByLabel("Nom", { exact: true }).fill("Test e2e");
  await page.getByRole("button", { name: "Créer la saison" }).click();
  await expect(page.getByText("Saison créée. 1 question a changé de saison.")).toBeVisible();
  const created = page.locator("section").filter({ has: page.getByRole("heading", { name: "Saison Test e2e" }) });
  await expect(created).toContainText(`à partir du`);
  // The seed's season now ends the day before.
  const previous = page.locator("section").filter({ has: page.getByRole("heading", { name: `Saison ${currentSeason}` }) });
  await expect(previous).toContainText(/du .+ au .+/);
  await expect(previous.getByText("En cours")).toBeVisible();

  await page.goto("/admin/questions?statut=brouillon");
  await expect(page.getByRole("row").filter({ hasText: title })).toContainText("saison Test e2e");

  // Renaming.
  await page.goto("/admin/saisons");
  await page.getByRole("button", { name: "Modifier la saison Test e2e" }).click();
  await page.getByLabel("Nom de la saison Test e2e").fill("Test e2e renommée");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Saison Test e2e renommée" })).toBeVisible();

  // A start after the closing of the draft: it goes back to the seed's season.
  await page.getByRole("button", { name: "Modifier la saison Test e2e renommée" }).click();
  await page.getByLabel("Début de la saison Test e2e renommée").fill(utcToParisLocalDate(inDays(80)));
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Saison modifiée. 1 question a changé de saison.")).toBeVisible();
  await page.goto("/admin/questions?statut=brouillon");
  await expect(page.getByRole("row").filter({ hasText: title })).toContainText(`saison ${currentSeason}`);

  // Deletion, with a confirmation.
  await page.goto("/admin/saisons");
  await page.getByRole("button", { name: "Supprimer la saison Test e2e renommée" }).click();
  const dialog = page.getByRole("dialog", { name: "Supprimer la saison Test e2e renommée ?" });
  await dialog.getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByRole("heading", { name: "Saison Test e2e renommée" })).toHaveCount(0);
  await expect(page.getByText(`La saison ${currentSeason} est la dernière créée`)).toBeVisible();

  // The seed's season cannot be deleted: questions are attached to it.
  await expect(page.getByRole("button", { name: `Supprimer la saison ${currentSeason}` })).toBeDisabled();

  // Clean up the draft.
  await page.goto(questionUrl);
  await page.getByRole("button", { name: "Supprimer" }).click();
  await page.getByRole("dialog", { name: "Supprimer le brouillon ?" }).getByRole("button", { name: "Supprimer" }).click();
  await expect(page).toHaveURL(/\/admin\/questions/);
});
