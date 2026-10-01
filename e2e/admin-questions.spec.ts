import type { Page } from "@playwright/test";
import { formatDateTime } from "../src/lib/format";
import { parisLocalToUtc, utcToParisLocalInput } from "../src/lib/game/time";
import { ACCOUNTS, expect, signIn, signOut, test } from "./fixtures";

// Back office (architecture §11 É5). Each test creates its own questions; the result test uses
// the closed question of the seed.

const DAY_MS = 24 * 60 * 60 * 1000;

/** `datetime-local` value, Paris time, `days` from today at `time`. */
function parisLocal(days: number, time: string): string {
  return `${utcToParisLocalInput(new Date(Date.now() + days * DAY_MS)).slice(0, 10)}T${time}`;
}

async function createQuestion(
  page: Page,
  question: { title: string; kind?: "Nombre" | "Choix"; unit?: string; options?: string[] },
): Promise<number> {
  await page.goto("/admin/questions/nouvelle");
  await page.getByRole("radio", { name: question.kind ?? "Nombre", exact: true }).check();
  await page.getByLabel("Catégorie").selectOption({ label: "JPO" });
  await page.getByLabel("Énoncé").fill(question.title);
  if (question.unit) await page.getByLabel("Unité").fill(question.unit);
  if (question.options) {
    for (const [index, label] of question.options.entries()) {
      if (index >= 2) await page.getByRole("button", { name: "Ajouter une réponse" }).click();
      await page.getByLabel(`Réponse ${index + 1}`, { exact: true }).fill(label);
    }
  }
  await page.getByLabel("Source").fill("Tableau BI « JPO », feuilles d'émargement");
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  // The page of the new question, with its notice; `?creee=1` leaves the address once shown (R-04).
  await expect(page.getByText("Question créée en brouillon.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/questions\/\d+$/);
  return Number(/\/admin\/questions\/(\d+)/.exec(page.url())![1]);
}

test("the admin creates a number question and a choice question with 3 answers", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);

  const numberId = await createQuestion(page, { title: "Combien de participants au salon de Rouen ?", unit: "participants" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Combien de participants au salon de Rouen ?");
  await expect(page.getByText("Brouillon", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Unité")).toHaveValue("participants");

  const choiceId = await createQuestion(page, {
    title: "Quel campus aura le plus de visiteurs au salon ?",
    kind: "Choix",
    options: ["Caen", "Le Havre", "Paris"],
  });
  expect(choiceId).not.toBe(numberId);
  await expect(page.getByRole("radio", { name: "Choix", exact: true })).toBeChecked();
  for (const [index, label] of ["Caen", "Le Havre", "Paris"].entries()) {
    await expect(page.getByLabel(`Réponse ${index + 1}`, { exact: true })).toHaveValue(label);
  }

  // A choice question needs at least 2 answers.
  await page.getByRole("button", { name: "Retirer la réponse 3" }).click();
  await page.getByRole("button", { name: "Retirer la réponse 2" }).click();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Une question à choix a de 2 à 10 réponses.")).toBeVisible();
});

test("dates in series in Paris time, publication, and the scheduled question stays hidden from players", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  const titles = ["Combien d'inscrits au forum des métiers ?", "Combien de visiteurs au forum des métiers ?"];
  const ids = [];
  for (const title of titles) ids.push(await createQuestion(page, { title, unit: "visiteurs" }));

  await page.goto("/admin/questions?statut=brouillon");
  for (const title of titles) await page.getByRole("checkbox", { name: `Sélectionner « ${title} »` }).check();
  await expect(page.getByText("2 questions sélectionnées")).toBeVisible();

  const opensAt = parisLocal(10, "09:00");
  const closesAt = parisLocal(17, "18:30");
  await page.getByRole("button", { name: "Définir les dates" }).click();
  const dialog = page.getByRole("dialog", { name: "Définir les dates" });
  await dialog.getByLabel("Ouverture").fill(opensAt);
  await dialog.getByLabel("Clôture").fill(closesAt);
  await dialog.getByRole("button", { name: "Appliquer" }).click();
  await expect(page.getByText("Dates appliquées à 2 questions.")).toBeVisible();

  await page.getByRole("button", { name: "Publier", exact: true }).click();
  await expect(page.getByText("2 questions publiées.")).toBeVisible();

  // The dates shown are the Paris times that were typed, whatever the server's time zone (UTC).
  const opensLabel = formatDateTime(parisLocalToUtc(opensAt), new Date());
  const closesLabel = formatDateTime(parisLocalToUtc(closesAt), new Date());
  expect(opensLabel).toMatch(/ à 9 h$/);
  expect(closesLabel).toMatch(/ à 18 h 30$/);
  await page.goto("/admin/questions?statut=programmee");
  for (const title of titles) {
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toContainText("Programmée");
    await expect(row).toContainText(opensLabel);
    await expect(row).toContainText(closesLabel);
  }
  await page.goto(`/admin/questions/${ids[0]}`);
  await expect(page.getByLabel("Ouverture")).toHaveValue(opensAt);
  await expect(page.getByLabel("Clôture")).toHaveValue(closesAt);
  await page.goto("/admin");
  const upcoming = page.locator("section").filter({ has: page.getByRole("heading", { name: "Prochaines ouvertures" }) });
  await expect(upcoming).toContainText(titles[0]);

  // A player does not see a scheduled question.
  await signOut(page);
  await signIn(page, ACCOUNTS.julien);
  for (const id of ids) {
    const response = await page.goto(`/questions/${id}`);
    expect(response?.status()).toBe(404);
  }
});

// Test report of 01/10/2026: once published, the page still said « Question créée en brouillon.
// Complète ses dates, puis publie-la. » (R-04); a refusal had a capital after its colon (R-06).
test("on the page of a new question, « Publier » explains a refusal, then drops the creation message", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  await createQuestion(page, { title: "Combien de visiteurs au salon de Caen ?", unit: "visiteurs" });

  await page.getByRole("button", { name: "Publier", exact: true }).click();
  await expect(
    page.getByText("Question enregistrée, mais pas publiée : il manque la date d'ouverture. Il manque la date de clôture."),
  ).toBeVisible();

  await page.getByLabel("Ouverture").fill(parisLocal(10, "09:00"));
  await page.getByLabel("Clôture").fill(parisLocal(17, "18:30"));
  await page.getByRole("button", { name: "Publier", exact: true }).click();
  await expect(page.getByText("Question enregistrée et publiée.")).toBeVisible();
  await expect(page.getByText("Question créée en brouillon.")).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin\/questions\/\d+$/);
  await expect(page.getByText("Programmée", { exact: true })).toBeVisible();
});

test("the admin enters, then corrects, the result of the seeded closed question", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  const title = "Combien de visiteurs sur le stand du salon Studyrama ?";
  await page.goto("/admin");
  await page.getByRole("link", { name: `Saisir le résultat de « ${title} »` }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByText("Clôturée", { exact: true })).toBeVisible();

  // Before the result, the values of the closed question are visible to the admin.
  await expect(page.getByRole("table", { name: "Suivi des joueurs" })).toContainText("262 visiteurs");

  const value = page.getByLabel("Valeur réelle (visiteurs)");
  await value.fill("2.450");
  await page.getByRole("button", { name: "Enregistrer le résultat" }).click();
  await expect(value).toHaveAccessibleDescription(/pas de point pour les milliers/);

  await value.fill("245");
  await page.getByRole("button", { name: "Enregistrer le résultat" }).click();
  await expect(page.getByText("Résultat enregistré : la question est résolue.")).toBeVisible();
  await expect(page.getByText("Résolue", { exact: true })).toBeVisible();

  await value.fill("250");
  await page.getByRole("button", { name: "Corriger le résultat" }).click();
  await expect(page.getByText("Résultat corrigé.", { exact: true })).toBeVisible();
  await expect(page.getByText(/Résultat corrigé le /)).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("link", { name: `Saisir le résultat de « ${title} »` })).toHaveCount(0);
});

test("the dashboard follows the open questions without showing any value", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  await page.goto("/admin");
  const card = page.getByRole("listitem").filter({ hasText: "Combien de participants à la JPO du 15 novembre ?" });
  // Camille, Hugo and Mehdi validated; the total is the number of active accounts.
  await expect(card).toContainText(/3 \/ \d+/);
  await expect(card).toContainText("Julien");
  const html = await page.content();
  expect(html).not.toContain("987654");

  await card.getByRole("link", { name: "Combien de participants à la JPO du 15 novembre ?" }).click();
  await expect(page.getByRole("table", { name: "Suivi des joueurs" })).toContainText("Validé");
  expect(await page.content()).not.toContain("987654");
});
