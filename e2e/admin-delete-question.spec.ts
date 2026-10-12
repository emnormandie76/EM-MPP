import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { utcToParisLocalInput } from "../src/lib/game/time";
import { seedSeasons } from "../scripts/lib/seed-seasons";
import { ACCOUNTS, expect, signIn, signOut, test } from "./fixtures";

// Deletion of a question for good (v1.4, architecture §5.11, §8.2, §11 É8e). No question of the
// seed is deleted: the other files depend on them. The admin publishes a question of their own, open
// at once, Julien saves a prediction on it, then the admin deletes it: nothing of it is left for the
// files that run next (dashboard, chat, standings). The steps follow each other: one test per step,
// each with its own client address (5 sign-ins per minute, §6.1). The refusal in a proclaimed
// season is only looked at, on a resolved question of the seed's previous season. The series
// deletion (from the list) deletes two drafts of the test, and leaves that resolved question.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const TITLE = "Combien de visiteurs au salon de Deauville ?";
/** Resolved question of the seed's previous season, which is proclaimed. */
const PROCLAIMED_TITLE = "Combien de candidatures Grande École au 31 mars ?";
const PROCLAIMED_REASON = "Cette question appartient à une saison proclamée : son palmarès est figé, elle ne peut plus être supprimée.";

/** No serious or critical violation in the open dialog (§8.5, §9.4). */
async function dialogViolations(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).include("dialog[open]").analyze();
  return violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(" ")).join(", ")})`);
}

test.describe.serial("the admin deletes a question with a prediction", () => {
  let questionId: number;

  test("the admin publishes a question open at once, and Julien saves a prediction on it", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto("/admin/questions/nouvelle");
    await page.getByRole("radio", { name: "Nombre", exact: true }).check();
    await page.getByLabel("Catégorie").selectOption({ label: "JPO" });
    await page.getByLabel("Énoncé").fill(TITLE);
    await page.getByLabel("Unité").fill("visiteurs");
    await page.getByLabel("Source").fill("Compteur du stand, relevé par l'équipe salons");
    await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    await expect(page.getByText("Question créée en brouillon.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/questions\/\d+$/);
    questionId = Number(/\/admin\/questions\/(\d+)/.exec(page.url())![1]);

    // Open since an hour ago, closing in 3 days: a draft keeps nothing to remind of it.
    await page.getByLabel("Ouverture").fill(utcToParisLocalInput(new Date(Date.now() - HOUR_MS)));
    await page.getByLabel("Clôture").fill(`${utcToParisLocalInput(new Date(Date.now() + 3 * DAY_MS)).slice(0, 10)}T18:00`);
    await page.getByRole("button", { name: "Publier", exact: true }).click();
    await expect(page.getByText("Question enregistrée et publiée.")).toBeVisible();
    await expect(page.getByText("Ouverte", { exact: true })).toBeVisible();
    await signOut(page);

    await signIn(page, ACCOUNTS.julien);
    await page.goto(`/questions/${questionId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
    await page.getByLabel("Ton prono", { exact: true }).fill("180");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Prono enregistré.")).toBeVisible();
  });

  test("the dialog tells what goes with it and asks for SUPPRIMER; the question is gone, for the players too", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto(`/admin/questions/${questionId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
    await expect(page).toHaveTitle(/^Question · /);
    await page.getByRole("button", { name: "Supprimer", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Supprimer définitivement la question ?" });
    await expect(dialog).toContainText("Ce n'est pas réversible : la question disparaît pour tout le monde, comme si elle n'avait jamais existé.");
    await expect(dialog.getByText("Seront effacés : 1 prono.", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Les jokers posés dessus sont rendus à leurs joueurs.", { exact: true })).toBeVisible();
    await expect(dialog).toContainText(
      "Pour une vraie question dont la valeur ne sera pas connue, préfère « Annuler la question » : les joueurs la verront annulée.",
    );
    const word = dialog.getByLabel("Tape SUPPRIMER pour confirmer");
    const confirm = dialog.getByRole("button", { name: "Supprimer définitivement" });
    await expect(word).toHaveAttribute("autocomplete", "off");
    await expect(confirm).toBeDisabled();

    // The open dialog, on a computer and on a phone (§8.4, §9.4).
    await page.setViewportSize({ width: 1280, height: 800 });
    expect(await dialogViolations(page), "1 280 px").toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(confirm).toBeInViewport();
    expect(await dialogViolations(page), "390 px").toEqual([]);
    await page.setViewportSize({ width: 1280, height: 800 });

    await word.fill("SUPPRIME");
    await expect(confirm).toBeDisabled();
    await word.fill(" supprimer ");
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // Back to the list, with the message; `?supprimee=1` leaves the address once shown.
    await expect(page).toHaveURL(/\/admin\/questions$/);
    await expect(page.getByText("Question supprimée.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: TITLE })).toHaveCount(0);
    await signOut(page);

    await signIn(page, ACCOUNTS.julien);
    const response = await page.goto(`/questions/${questionId}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Cette page n'existe pas." })).toBeVisible();
  });
});

test("a resolved question of the proclaimed season cannot be deleted; the button says why", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  await page.goto("/admin/questions?statut=resolue");
  await page.getByRole("link", { name: PROCLAIMED_TITLE }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(PROCLAIMED_TITLE);
  await expect(page.getByText(`saison ${seedSeasons(new Date()).previous.label}`)).toBeVisible();

  const remove = page.getByRole("button", { name: "Supprimer", exact: true });
  await expect(remove).toBeDisabled();
  await expect(remove).toHaveAccessibleDescription(PROCLAIMED_REASON);
  await expect(page.getByText(PROCLAIMED_REASON, { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the admin deletes several questions at once from the list; a question of the proclaimed season stays", async ({ page }) => {
  const drafts = ["Combien de flyers distribués au salon de Lisieux ?", "Combien de flyers distribués au salon d'Évreux ?"];
  await signIn(page, ACCOUNTS.admin);
  for (const title of drafts) {
    await page.goto("/admin/questions/nouvelle");
    await page.getByRole("radio", { name: "Nombre", exact: true }).check();
    await page.getByLabel("Catégorie").selectOption({ label: "JPO" });
    await page.getByLabel("Énoncé").fill(title);
    await page.getByLabel("Source").fill("Comptage de l'équipe salons");
    await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    await expect(page.getByText("Question créée en brouillon.")).toBeVisible();
  }

  await page.goto("/admin/questions");
  for (const title of [...drafts, PROCLAIMED_TITLE]) await page.getByRole("checkbox", { name: `Sélectionner « ${title} »` }).check();
  const actions = page.getByRole("group", { name: "Actions sur la sélection" });
  await expect(actions).toContainText("3 questions sélectionnées");
  await actions.getByRole("button", { name: "Supprimer", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Supprimer définitivement 3 questions ?" });
  await expect(dialog).toContainText(
    "Ce n'est pas réversible : ces questions disparaissent pour tout le monde, comme si elles n'avaient jamais existé.",
  );
  // Only the drafts go: no prediction on them, so no word to type, and no advice to cancel.
  await expect(dialog.getByText("Aucun prono n'a été fait sur ces questions.", { exact: true })).toBeVisible();
  await expect(dialog.getByText("1 question ne sera pas supprimée : elle appartient à une saison proclamée.", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Tape SUPPRIMER pour confirmer")).toHaveCount(0);
  await expect(dialog).not.toContainText("Annuler la question");
  expect(await dialogViolations(page)).toEqual([]);
  await dialog.getByRole("button", { name: "Supprimer définitivement" }).click();

  // The report, question by question; the drafts leave the list and the selection.
  await expect(dialog).toBeHidden();
  await expect(page.getByText("2 questions supprimées.", { exact: true })).toBeVisible();
  await expect(page.getByText(`« ${PROCLAIMED_TITLE} » : cette question appartient à une saison proclamée`)).toBeVisible();
  for (const title of drafts) await expect(page.getByRole("link", { name: title })).toHaveCount(0);
  await expect(page.getByRole("link", { name: PROCLAIMED_TITLE })).toBeVisible();
  await expect(actions).toContainText("1 question sélectionnée");
});
