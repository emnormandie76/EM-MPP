import { utcToParisLocalInput } from "../src/lib/game/time";
import { ACCOUNTS, expect, signIn, signOut, test } from "./fixtures";

// Editing a published question that has a prediction (v1.6, architecture §5.11, §11 É8g). The admin
// publishes a choice question of their own, open at once, and Julien saves a prediction on it. The
// admin then corrects its title and renames an answer in place: Julien's prediction keeps its
// answer, under its new label. The type, the number and order of the answers, the malus of a wrong
// answer and the coefficient stay locked. The question is deleted at the end: nothing of it is left
// for the files that run next. One test per step, each with its own client address (5 sign-ins per
// minute, §6.1).

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const TITLE = "Quel campus aura le plus de visiteurs au salon de Granville ?";
const NEW_TITLE = "Quel campus aura le plus de visiteurs au salon de Granville, le samedi ?";
const NEW_LABEL = "Le Havre (campus Porte Océane)";

test.describe.serial("the admin corrects a published question that has a prediction", () => {
  let questionId: number;

  test("the admin publishes a choice question open at once, and Julien saves a prediction on it", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto("/admin/questions/nouvelle");
    await page.getByRole("radio", { name: "Choix", exact: true }).check();
    await page.getByLabel("Catégorie").selectOption({ label: "JPO" });
    await page.getByLabel("Énoncé").fill(TITLE);
    await page.getByLabel("Réponse 1", { exact: true }).fill("Caen");
    await page.getByLabel("Réponse 2", { exact: true }).fill("Le Havre");
    await page.getByLabel("Malus d'une mauvaise réponse").fill("100");
    await page.getByLabel("Source").fill("Compteur du stand, relevé par l'équipe salons");
    await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    await expect(page.getByText("Question créée en brouillon.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/questions\/\d+$/);
    questionId = Number(/\/admin\/questions\/(\d+)/.exec(page.url())![1]);

    await page.getByLabel("Ouverture").fill(utcToParisLocalInput(new Date(Date.now() - HOUR_MS)));
    await page.getByLabel("Clôture").fill(`${utcToParisLocalInput(new Date(Date.now() + 3 * DAY_MS)).slice(0, 10)}T18:00`);
    await page.getByRole("button", { name: "Publier", exact: true }).click();
    await expect(page.getByText("Question enregistrée et publiée.")).toBeVisible();
    await signOut(page);

    await signIn(page, ACCOUNTS.julien);
    await page.goto(`/questions/${questionId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
    await page.getByRole("radio", { name: "Le Havre" }).check();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Prono enregistré.")).toBeVisible();
  });

  test("the admin corrects the title and an answer; Julien's prediction keeps its answer; then the question goes", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto(`/admin/questions/${questionId}`);
    await expect(page.getByText(/^Des pronos existent : tu peux encore corriger l'énoncé/)).toBeVisible();

    // Locked: the type, the number and order of the answers, the malus and the coefficient.
    await expect(page.getByRole("radio", { name: "Nombre", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Monter la réponse 2" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Retirer la réponse 1" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Ajouter une réponse" })).toBeDisabled();
    await expect(page.getByLabel("Malus d'une mauvaise réponse")).toBeDisabled();
    await expect(page.getByRole("radio", { name: "×2" })).toBeDisabled();

    // Editable: the wording, the labels of the answers included.
    await page.getByLabel("Énoncé").fill(NEW_TITLE);
    await page.getByLabel("Réponse 2", { exact: true }).fill(NEW_LABEL);
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Question enregistrée.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(NEW_TITLE);
    await expect(page.getByLabel("Réponse 2", { exact: true })).toHaveValue(NEW_LABEL);
    await signOut(page);

    await signIn(page, ACCOUNTS.julien);
    await page.goto(`/questions/${questionId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(NEW_TITLE);
    await expect(page.getByRole("radio", { name: NEW_LABEL })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Caen" })).not.toBeChecked();
    await signOut(page);

    await signIn(page, ACCOUNTS.admin);
    await page.goto(`/admin/questions/${questionId}`);
    await page.getByRole("button", { name: "Supprimer", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Supprimer définitivement la question ?" });
    await dialog.getByLabel("Tape SUPPRIMER pour confirmer").fill("SUPPRIMER");
    await dialog.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page.getByText("Question supprimée.", { exact: true })).toBeVisible();
  });
});
