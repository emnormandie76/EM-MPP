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
  // The page of the new question; `?creee=1` leaves the address once its notice is shown (R-04).
  await expect(page.getByText("Question créée en brouillon.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/questions\/\d+$/);
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

// Test report of 01/10/2026: after a deletion, « Saison créée. » stayed under the form (R-04), and the
// form offered a date based on the deleted season (R-05).
test("once a new season is deleted, its creation message goes and the form offers the next season again", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  await page.goto("/admin/saisons");
  const start = page.getByLabel("Date de début");
  const name = page.getByLabel("Nom", { exact: true });
  const offered = { start: await start.inputValue(), name: await name.inputValue() };

  // Far enough for no question to close in it: the season can be deleted.
  await start.fill(utcToParisLocalDate(inDays(300)));
  await name.fill("Test e2e R-05");
  await page.getByRole("button", { name: "Créer la saison" }).click();
  await expect(page.getByText(/^Saison créée\./)).toBeVisible();
  // The form now offers the season after the new one.
  await expect(start).not.toHaveValue(offered.start);

  await page.getByRole("button", { name: "Supprimer la saison Test e2e R-05" }).click();
  await page.getByRole("dialog", { name: "Supprimer la saison Test e2e R-05 ?" }).getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByRole("heading", { name: "Saison Test e2e R-05" })).toHaveCount(0);
  await expect(page.getByText(/^Saison créée\./)).toHaveCount(0);
  await expect(start).toHaveValue(offered.start);
  await expect(name).toHaveValue(offered.name);
});

// v1.2 (§5.13): jokers allowed or not for each season; they cannot be taken away once posed.
test("the jokers of a season: allowed by default, not taken away once a player has posed one", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  await page.goto("/admin/saisons");
  const currentSeason = seedSeasons(new Date()).current.label;
  const card = (label: string) => page.locator("section").filter({ has: page.getByRole("heading", { name: `Saison ${label}`, exact: true }) });

  // The seed's current season allows jokers, and players have posed some.
  await expect(card(currentSeason)).toContainText(/Jokers\s*autorisés/);
  await card(currentSeason).getByRole("button", { name: `Modifier la saison ${currentSeason}` }).click();
  const jokers = card(currentSeason).getByLabel("Jokers autorisés (2 par joueur)");
  await expect(jokers).toBeChecked();
  await expect(jokers).toHaveAccessibleDescription("Des jokers sont déjà posés dans cette saison : ils ne peuvent plus être retirés.");
  await jokers.uncheck();
  await card(currentSeason).getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(card(currentSeason).getByText("Des jokers sont déjà posés dans cette saison : impossible de les retirer.")).toBeVisible();
  await card(currentSeason).getByRole("button", { name: "Annuler" }).click();
  await expect(card(currentSeason)).toContainText(/Jokers\s*autorisés/);

  // A new season, far ahead, without jokers; then allowed; then deleted.
  const create = page.getByLabel("Jokers autorisés (2 par joueur)");
  await expect(create).toBeChecked();
  await page.getByLabel("Date de début").fill(utcToParisLocalDate(inDays(320)));
  await page.getByLabel("Nom", { exact: true }).fill("Test e2e sans jokers");
  await create.uncheck();
  await page.getByRole("button", { name: "Créer la saison" }).click();
  await expect(page.getByText(/^Saison créée\./)).toBeVisible();
  await expect(card("Test e2e sans jokers")).toContainText(/Jokers\s*non/);
  await card("Test e2e sans jokers").getByRole("button", { name: "Modifier la saison Test e2e sans jokers" }).click();
  await card("Test e2e sans jokers").getByLabel("Jokers autorisés (2 par joueur)").check();
  await card("Test e2e sans jokers").getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(card("Test e2e sans jokers")).toContainText(/Jokers\s*autorisés/);
  await card("Test e2e sans jokers").getByRole("button", { name: "Supprimer la saison Test e2e sans jokers" }).click();
  await page.getByRole("dialog", { name: "Supprimer la saison Test e2e sans jokers ?" }).getByRole("button", { name: "Supprimer" }).click();
  await expect(page.getByRole("heading", { name: "Saison Test e2e sans jokers" })).toHaveCount(0);
});
