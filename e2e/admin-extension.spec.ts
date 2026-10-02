import type { Page } from "@playwright/test";
import { ACCOUNTS, expect, signIn, signOut, test } from "./fixtures";

// Extension of a question for an absent player (architecture §5.14, §6.6, §11 É8c), on the seeded
// closed webinar question: Camille has the witness value 876 543, Mehdi an extension (seed), Hugo
// neither a prediction nor an extension. The admin extends it for Hugo, who saves his own witness
// value. Afterwards, Hugo keeps a saved prediction and a running extension on it
// (e2e/results.spec.ts, which runs later, only expects "an" extension in progress). The steps follow
// each other: one test per step, each with its own client address (5 sign-ins per minute, §6.1).

const WEBINAR = "Combien d'inscrits au webinaire Grande École de septembre ?";
/** Camille's prediction: hidden from whoever did not predict the question, and from Mehdi. */
const CLOSED_WITNESS = /876\s?543/;
/** Hugo's prediction during his extension: hidden from the others until his deadline. */
const HUGO_WITNESS = "765432";
const HUGO_WITNESS_SHOWN = /765\s?432/;

/** Opens a page and checks that a value never reaches its HTML, nor the page once rendered (§9.3). */
async function expectHidden(page: Page, url: string, witness: RegExp): Promise<void> {
  const response = await page.goto(url);
  expect(await response!.text()).not.toMatch(witness);
  expect(await page.content()).not.toMatch(witness);
}

async function adminQuestionUrl(page: Page): Promise<string> {
  await page.goto("/admin/questions");
  return (await page.getByRole("link", { name: WEBINAR }).getAttribute("href"))!;
}

async function playerQuestionUrl(page: Page, tab: string): Promise<string> {
  await page.goto(`/questions${tab}`);
  return (await page.getByRole("link", { name: WEBINAR }).getAttribute("href"))!;
}

test.describe.serial("extension of the webinar question for Hugo", () => {
  test("players without a prediction see nothing before the result; Mehdi, extended, has the question open", async ({ page }) => {
    // Hugo did not predict: he sees neither the predictions nor the crowd before the result.
    await signIn(page, ACCOUNTS.hugo);
    const questionUrl = await playerQuestionUrl(page, "?onglet=en-attente");
    await expectHidden(page, questionUrl, CLOSED_WITNESS);
    await expect(page.getByText(/^Tu n'as pas pronostiqué cette question : les pronos s'afficheront au résultat\./)).toBeVisible();
    await expect(page.getByText(/^Prolongation en cours pour 1 joueur, jusqu'au .+ : son prono s'affichera ensuite\.$/)).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    await signOut(page);

    // Mehdi, extended in the seed: the question is open for him, with his own deadline.
    await signIn(page, ACCOUNTS.mehdi);
    const soon = page.getByRole("region", { name: "Clôture imminente" });
    await expect(soon.getByRole("article", { name: WEBINAR }).getByText("Prolongée pour toi")).toBeVisible();
    await expectHidden(page, questionUrl, CLOSED_WITNESS);
    await expect(page.getByLabel("Ton prono", { exact: true })).toBeEditable();
    await expect(page.getByText(/^Prolongée pour toi jusqu'au /)).toBeVisible();
  });

  test("the result is blocked while an extension runs; the admin extends the question for Hugo", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto("/admin");
    await expect(page.getByRole("button", { name: `Saisir le résultat de « ${WEBINAR} »` })).toBeDisabled();
    await expect(page.getByText(/^Prolongation de Mehdi jusqu'au /)).toBeVisible();
    await expect(page.getByRole("region", { name: "Prolongations en cours" })).toContainText(/Mehdi.*jusqu'au .*à faire/);

    const adminUrl = await adminQuestionUrl(page);
    await page.goto(adminUrl);
    const tracking = page.getByRole("table", { name: "Suivi des joueurs" });
    await expect(tracking.getByRole("row").filter({ hasText: "Mehdi" })).toContainText("jusqu'au");
    await tracking.getByRole("button", { name: "Prolonger pour Hugo" }).click();
    const dialog = page.getByRole("dialog", { name: "Prolonger pour Hugo" });
    await expect(dialog).toContainText("Le joueur ne verra pas les pronos des autres avant d'avoir répondu. Préviens-le toi-même.");
    await expect(dialog.getByLabel("Date limite (heure de Paris)")).toHaveValue(/^\d{4}-\d{2}-\d{2}T\d{2}:00$/);
    await dialog.getByRole("button", { name: "Prolonger" }).click();
    await expect(page.getByText("Question prolongée pour Hugo.")).toBeVisible();
    await expect(tracking.getByRole("row").filter({ hasText: "Hugo" })).toContainText("jusqu'au");
    await expect(tracking.getByRole("button", { name: "Annuler la prolongation de Hugo" })).toBeVisible();
    // The admin does not extend a question for himself.
    await expect(tracking.getByRole("button", { name: "Prolonger pour Admin" })).toHaveCount(0);
    // The result form says why it is disabled.
    const result = page.locator("section").filter({ has: page.getByRole("heading", { name: "Résultat", exact: true }) });
    await expect(result).toContainText(/Prolongation de .+ jusqu'au .+ Le résultat se saisit après sa fin/);
    await expect(page.getByRole("button", { name: "Enregistrer le résultat" })).toBeDisabled();
  });

  test("Hugo saves a value during his extension; it stays hidden from the others, back office included", async ({ page }) => {
    // Hugo: the question is open for him, « Prolongée pour toi »; he saves a value.
    await signIn(page, ACCOUNTS.hugo);
    await expect(page.getByRole("region", { name: "Clôture imminente" }).getByRole("article", { name: WEBINAR }).getByText("Prolongée pour toi")).toBeVisible();
    const questionUrl = await playerQuestionUrl(page, "");
    await expectHidden(page, questionUrl, CLOSED_WITNESS);
    await page.getByLabel("Ton prono", { exact: true }).fill(HUGO_WITNESS);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Prono enregistré.")).toBeVisible();
    await signOut(page);

    // Sarah predicted: she sees the others' predictions and the extensions in progress, not Hugo's value.
    await signIn(page, ACCOUNTS.sarah);
    await expectHidden(page, questionUrl, HUGO_WITNESS_SHOWN);
    await expect(page.getByText(/^Prolongation en cours pour 2 joueurs, jusqu'au .+ : leurs pronos s'afficheront ensuite\.$/)).toBeVisible();
    await expect(page.getByRole("table", { name: "Pronos de tous les joueurs" }).getByRole("rowheader")).toHaveText([
      /Admin/,
      /Camille/,
      /Inès/,
      /Julien/,
      /Léa/,
      /Sarah/,
      /Thomas/,
    ]);
    await signOut(page);

    // The back office: the admin predicted the question, yet Hugo's value stays hidden (state only).
    await signIn(page, ACCOUNTS.admin);
    await expectHidden(page, await adminQuestionUrl(page), HUGO_WITNESS_SHOWN);
    await expect(page.getByRole("table", { name: "Suivi des joueurs" }).getByRole("row").filter({ hasText: "Hugo" })).toContainText("Enregistré");
    await expect(page.getByRole("table", { name: "Suivi des joueurs" })).toContainText(/876\s543 inscrits/);
  });
});
