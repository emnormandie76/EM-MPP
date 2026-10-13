import { utcToParisLocalInput } from "../src/lib/game/time";
import { ACCOUNTS, expect, signIn, test } from "./fixtures";

// A fun question (v1.7, architecture §5.5, §5.11, §11 É8h): a number question scored by its order
// of closeness. The admin creates one with a malus per place, its coefficient staying ×1, and
// publishes it, open at once; Julien sees its rule and saves a prediction on it. With a prediction,
// the kind and the malus per place are locked. The question is deleted at the end: nothing of it is
// left for the files that run next. One test per step, each with its own client address (5 sign-ins
// per minute, §6.1).

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const TITLE = "Combien de cafés servis au distributeur du campus de Caen en novembre ?";

test.describe.serial("the admin publishes a fun question, scored by place", () => {
  let questionId: number;

  test("the admin creates a fun question with a malus per place, at ×1, and publishes it", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto("/admin/questions/nouvelle");
    await page.getByRole("radio", { name: "Fun", exact: true }).check();
    // A fun question keeps the coefficient ×1: no coefficient to choose.
    await expect(page.getByRole("radio", { name: "×2" })).toHaveCount(0);
    await expect(page.getByText("×1 : une question fun garde ce coefficient, le malus par place fait son poids.")).toBeVisible();
    await expect(page.getByLabel("Malus d'une mauvaise réponse")).toHaveCount(0);

    await page.getByLabel("Catégorie").selectOption({ label: "JPO" });
    await page.getByLabel("Énoncé").fill(TITLE);
    await page.getByLabel("Unité").fill("cafés");
    await page.getByLabel("Source").fill("Relevé du distributeur par les services généraux");
    await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    await expect(page.getByText("Indique le malus par place.")).toBeVisible();

    // Numbers only (13/10/2026): the browser keeps the letters out.
    await expect(page.getByLabel("Malus par place")).toHaveAttribute("type", "number");
    await page.getByLabel("Malus par place").fill("5");
    await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    await expect(page.getByText("Question créée en brouillon.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/questions\/\d+$/);
    questionId = Number(/\/admin\/questions\/(\d+)/.exec(page.url())![1]);
    await expect(page.getByText("Fun : 5 de malus par place")).toBeVisible();
    await expect(page.getByText("Coef ×1", { exact: true })).toBeVisible();

    await page.getByLabel("Ouverture").fill(utcToParisLocalInput(new Date(Date.now() - HOUR_MS)));
    await page.getByLabel("Clôture").fill(`${utcToParisLocalInput(new Date(Date.now() + 3 * DAY_MS)).slice(0, 10)}T18:00`);
    await page.getByRole("button", { name: "Publier", exact: true }).click();
    await expect(page.getByText("Question enregistrée et publiée.")).toBeVisible();
  });

  test("Julien sees the rule of the fun question and saves a prediction", async ({ page }) => {
    await signIn(page, ACCOUNTS.julien);
    await page.goto("/pronos");
    await expect(page.getByText("Fun · 5 de malus par place")).toBeVisible();

    await page.goto(`/questions/${questionId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
    await expect(page.getByText("Fun : 5 de malus par place")).toBeVisible();
    await expect(page.getByText(/^Question fun : seul l'ordre compte\. Le prono le plus proche prend 0, puis chaque place derrière lui coûte 5 de malus\.$/)).toBeVisible();
    await page.getByLabel("Ton prono", { exact: true }).fill("1200");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Prono enregistré.")).toBeVisible();
  });

  test("with a prediction, the kind and the malus per place are locked; then the question goes", async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    await page.goto(`/admin/questions/${questionId}`);
    await expect(page.getByRole("radio", { name: "Fun", exact: true })).toBeDisabled();
    await expect(page.getByRole("radio", { name: "Fun", exact: true })).toBeChecked();
    await expect(page.getByLabel("Malus par place")).toBeDisabled();
    await expect(page.getByLabel("Malus par place")).toHaveValue("5");

    await page.getByRole("button", { name: "Supprimer", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Supprimer définitivement la question ?" });
    await dialog.getByLabel("Tape SUPPRIMER pour confirmer").fill("SUPPRIMER");
    await dialog.getByRole("button", { name: "Supprimer définitivement" }).click();
    await expect(page.getByText("Question supprimée.", { exact: true })).toBeVisible();
  });
});
