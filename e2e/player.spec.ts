import type { Page } from "@playwright/test";
import { ACCOUNTS, expect, signIn, test } from "./fixtures";

// Player journey (architecture §11 É6). Seeded open questions, closing in 1 (urgent), 3, 5 and 6
// days. Each test that writes uses its own accounts: Julien (number saved, choice validated),
// Léa (validation), Sarah (jokers, 2 left this season), Camille (the "Nouveau" badge).

const OPEN = {
  jpo: "Combien de participants à la JPO du 15 novembre ?",
  candidatures: "Combien de candidatures Grande École au 31 mai ?",
  programme: "Quel programme recevra le plus de candidatures en décembre ?",
  integration: "Le taux d'intégration du Bachelor dépassera-t-il 60 % ?",
};
const SCHEDULED = "Combien de participants à la JPO de janvier ?";
const CANCELLED = "Combien de dossiers complets au 15 octobre ?";
/** Hugo's prediction on the JPO question: it must never reach another player's page (§9.3). */
const WITNESS = /987\s?654/;

/** Opens the page of a question from /pronos. */
async function openQuestion(page: Page, title: string): Promise<string> {
  await page.goto("/pronos");
  await page.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  return page.url();
}

test("the home page lists the open questions by closing, with a live countdown, urgent on the first", async ({ page }) => {
  await signIn(page, ACCOUNTS.julien);
  const soon = page.getByRole("region", { name: "Clôture imminente" });
  await expect(soon.getByRole("article").getByRole("heading")).toHaveText([OPEN.jpo, OPEN.candidatures, OPEN.programme, OPEN.integration]);
  await expect(soon.getByRole("link", { name: "Les 4 questions ouvertes" })).toHaveAttribute("href", "/pronos");

  const first = soon.getByRole("article", { name: OPEN.jpo }).getByRole("timer");
  await expect(first).toHaveAttribute("aria-label", /^Clôture dans (\d+ j )?\d{2}:\d{2}:\d{2}$/);
  await expect(first).toHaveAttribute("data-urgent", "true");
  await expect(soon.getByRole("article", { name: OPEN.candidatures }).getByRole("timer")).not.toHaveAttribute("data-urgent", "true");
  // The countdown runs in the browser.
  const label = await first.getAttribute("aria-label");
  await expect(first).not.toHaveAttribute("aria-label", label!);

  await expect(page.getByRole("progressbar", { name: "Pronos validés" })).toHaveAttribute("aria-valuemax", "4");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Salut Julien");
});

test("saving 2 450 shows the state « Enregistré »", async ({ page }) => {
  await signIn(page, ACCOUNTS.julien);
  await page.goto("/pronos");
  const row = page.getByRole("article", { name: OPEN.candidatures });
  await expect(row.getByText("À faire", { exact: true })).toBeVisible();
  await expect(row.getByRole("checkbox", { name: /joker/i })).toBeDisabled();

  await row.getByLabel("Ton prono", { exact: true }).fill("2.450");
  await row.getByRole("button", { name: "Enregistrer" }).click();
  await expect(row.getByText(/pas de point pour les milliers/)).toBeVisible();

  await row.getByLabel("Ton prono", { exact: true }).fill("2 450");
  await row.getByRole("button", { name: "Enregistrer" }).click();
  await expect(row.getByText("Prono enregistré.")).toBeVisible();
  await expect(row.getByText("Enregistré", { exact: true })).toBeVisible();
  await expect(row).toContainText(/Enregistré le .+\. Une fois validé, ton prono est définitif\./);

  await page.reload();
  await expect(row.getByLabel("Ton prono", { exact: true })).toHaveValue(/^2\s450$/);
  await expect(row.getByText("Enregistré", { exact: true })).toBeVisible();
  await page.goto("/pronos?onglet=enregistres");
  await expect(page.getByRole("article", { name: OPEN.candidatures })).toBeVisible();
});

test("validating asks for a confirmation, then shows « Validé » and the field turns read-only", async ({ page }) => {
  await signIn(page, ACCOUNTS.lea);
  await openQuestion(page, OPEN.candidatures);
  // The Juste Prix is gone (v1.2).
  await expect(page.getByText("Juste Prix")).toHaveCount(0);
  const value = page.getByLabel("Ton prono", { exact: true });
  await expect(value).toHaveValue(/^2\s300$/);
  await value.fill("2450");

  // Cancelling changes nothing.
  await page.getByRole("button", { name: "Valider", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Valider ton prono ?" });
  await expect(dialog).toContainText(/2\s450 candidatures/);
  await expect(dialog).toContainText("Une fois validé, tu ne pourras plus le modifier.");
  await expect(dialog.getByRole("button", { name: "Annuler" })).toBeFocused();
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Valider", exact: true }).click();
  await dialog.getByRole("button", { name: "Valider définitivement" }).click();
  await expect(page.getByText("Prono validé.")).toBeVisible();
  await expect(page.getByText("Validé", { exact: true })).toBeVisible();
  await expect(value).not.toBeEditable();
  await expect(value).toHaveValue(/^2\s?450$/);
  await expect(page.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Valider", exact: true })).toHaveCount(0);

  await page.reload();
  await expect(value).not.toBeEditable();
  await expect(value).toHaveValue(/^2\s450$/);
});

test("jokers: the counter goes down, and no third joker can be posed", async ({ page }) => {
  await signIn(page, ACCOUNTS.sarah);
  await expect(page.getByRole("definition").filter({ hasText: /^2\/2$/ })).toBeVisible();
  await page.goto("/pronos");

  const programme = page.getByRole("article", { name: OPEN.programme });
  await programme.getByRole("radio", { name: "MSc" }).check();
  await programme.getByRole("button", { name: "Enregistrer" }).click();
  await expect(programme.getByText("Prono enregistré.")).toBeVisible();
  const firstJoker = programme.getByRole("checkbox", { name: /joker/i });
  // v1.2: a joker divides the malus by 2.
  await expect(firstJoker).toHaveAccessibleName(/^JOKER ÷2 Divise ton malus par deux · 2 restants cette saison$/);
  await firstJoker.check();
  await expect(programme.getByText("Joker posé.")).toBeVisible();
  await expect(firstJoker).toHaveAccessibleName(/1 restant cette saison/);

  const integration = page.getByRole("article", { name: OPEN.integration });
  await integration.getByRole("radio", { name: "Oui" }).check();
  await integration.getByRole("button", { name: "Enregistrer" }).click();
  await expect(integration.getByText("Prono enregistré.")).toBeVisible();
  await integration.getByRole("checkbox", { name: /joker/i }).check();
  await expect(integration.getByText("Joker posé.")).toBeVisible();
  await expect(integration.getByRole("checkbox", { name: /joker/i })).toHaveAccessibleName(/0 restant cette saison/);

  // No joker left: the third one cannot be posed.
  const candidatures = page.getByRole("article", { name: OPEN.candidatures });
  await candidatures.getByLabel("Ton prono", { exact: true }).fill("2000");
  await candidatures.getByRole("button", { name: "Enregistrer" }).click();
  await expect(candidatures.getByText("Prono enregistré.")).toBeVisible();
  const third = candidatures.getByRole("checkbox", { name: /joker/i });
  await expect(third).toBeDisabled();
  await expect(third).toHaveAccessibleName(/0 restant cette saison/);

  // The joker goes into the confirmation, and the home page counts down.
  await integration.getByRole("button", { name: "Valider", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Valider ton prono ?" });
  await expect(dialog).toContainText("Oui");
  await expect(dialog).toContainText("Joker posé");
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await page.goto("/");
  await expect(page.getByRole("definition").filter({ hasText: /^0\/2$/ })).toBeVisible();
});

test("a choice question is validated", async ({ page }) => {
  await signIn(page, ACCOUNTS.julien);
  await openQuestion(page, OPEN.programme);
  // The malus of a wrong answer, shown with the question and its form (v1.2).
  await expect(page.getByText("Mauvaise réponse : 100 de malus", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Valider", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Valider", exact: true }).click();
  await expect(page.getByText("Choisis une réponse.")).toBeVisible();

  await page.getByRole("radio", { name: "BBA" }).check();
  await page.getByRole("button", { name: "Valider", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Valider ton prono ?" });
  await expect(dialog).toContainText("BBA");
  await dialog.getByRole("button", { name: "Valider définitivement" }).click();
  await expect(page.getByText("Validé", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: "BBA" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "MSc" })).toBeDisabled();
});

test("the « Nouveau » badge shows for joueur4 on the question opened since her last visit", async ({ page }) => {
  await signIn(page, ACCOUNTS.camille);
  const soon = page.getByRole("region", { name: "Clôture imminente" });
  await expect(soon.getByRole("article", { name: OPEN.integration }).getByText("Nouveau", { exact: true })).toBeVisible();
  await expect(soon.getByRole("article", { name: OPEN.jpo }).getByText("Nouveau", { exact: true })).toHaveCount(0);
  // Same visit: the badge stays on the other pages.
  await page.goto("/pronos");
  await expect(page.getByRole("article", { name: OPEN.integration }).getByText("Nouveau", { exact: true })).toBeVisible();
});

test("the scheduled question is absent; a question cancelled while open shows in « Annulées »", async ({ page }) => {
  await signIn(page, ACCOUNTS.julien);
  for (const url of ["/", "/pronos", "/questions", "/questions?onglet=en-attente", "/questions?onglet=annulees"]) {
    await page.goto(url);
    await expect(page.getByRole("main")).not.toContainText(SCHEDULED);
  }
  await page.goto("/questions?onglet=annulees");
  await page.getByRole("link", { name: CANCELLED }).click();
  await expect(page.getByText("Question annulée : aucun malus n'est attribué et les jokers sont rendus.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
});

test("confidentiality: another player's value never reaches the HTML of an open question (§9.3)", async ({ page }) => {
  for (const account of [ACCOUNTS.sarah, ACCOUNTS.admin]) {
    await signIn(page, account);
    const questionUrl = await openQuestion(page, OPEN.jpo);
    for (const url of [questionUrl, "/", "/pronos", "/questions"]) {
      const response = await page.goto(url);
      expect(await response!.text()).not.toMatch(WITNESS);
      expect(await page.content()).not.toMatch(WITNESS);
    }
    await page.context().clearCookies();
  }
});
