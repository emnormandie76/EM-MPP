import { seedSeasons } from "../scripts/lib/seed-seasons";
import { ACCOUNTS, expect, signIn, test } from "./fixtures";

// Results, standings and palmarès (architecture §11 É7). The seed's questions are only read here,
// except the proclamation of the older season (2024-2025), resolved but not proclaimed. The closed
// Studyrama question is resolved (250) by e2e/admin-questions.spec.ts, which runs before; the webinar
// question stays closed, with Mehdi's extension and Hugo's (e2e/admin-extension.spec.ts).
// v1.2 (step 8c): malus, the fewest first, absent players with the malus of the worst prediction;
// these expectations replace those of the points scale (decision of the user, 02/10/2026).

const SEASONS = seedSeasons(new Date());
const RESOLVED = "Combien de participants à la JPO de septembre ?";
const CLOSED = "Combien d'inscrits au webinaire Grande École de septembre ?";

test("a resolved question shows the real value, everyone's malus, the absent players and « Ton prono »", async ({ page }) => {
  await signIn(page, ACCOUNTS.sarah);
  await page.goto("/questions?onglet=resolues");
  await page.getByRole("link", { name: RESOLVED }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(RESOLVED);

  const result = page.getByRole("region", { name: "Résultat" });
  await expect(result.locator("dl > div").filter({ hasText: "Réel" })).toContainText("250");
  await expect(result.locator("dl > div").filter({ hasText: "Médiane" })).toContainText("240");
  await expect(result.locator("dl > div").filter({ hasText: "Moyenne" })).toContainText(/254\s*écart 1,8\s%/);
  await expect(result.getByTestId("strip-chart")).toBeVisible();
  await expect(result.getByText(/Ton prono : 240 · écart 10 \(4\s%\)/)).toBeVisible();
  await expect(result.getByText("Écart 10 participants", { exact: true })).toBeVisible();
  await expect(result).toContainText("Malus : 10");
  await expect(result.getByRole("list", { name: "Badges gagnés sur cette question" })).toContainText("Tireur d'élite");

  // Vector P1, in malus: 262 with a joker (12 ÷ 2 = 6), 240 (10), both 235 (15), 300 (50, the worst);
  // the players without a prediction take 50. They include Nina and Noé, who signed up during
  // e2e/auth.spec.ts: the current season has no end, so they are part of its standings (§5.6, C8).
  const table = page.getByRole("table", { name: "Pronos de tous les joueurs, avec leur malus" });
  const row = (name: string) => table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: new RegExp(name) }) });
  await expect(row("Julien")).toContainText(/262 participants.*Joker ÷2.*12 \(4,8\s%\).*6$/);
  await expect(row("Sarah")).toContainText(/240 participants.*10 \(4\s%\).*10$/);
  await expect(row("Camille")).toContainText(/235 participants.*15 \(6\s%\).*15$/);
  await expect(row("Inès")).toContainText(/235 participants.*15 \(6\s%\).*15$/);
  await expect(row("Thomas")).toContainText(/300 participants.*50 \(20\s%\).*50$/);
  await expect(row("Hugo")).toContainText(/Pas de prono.*50$/);
  // From the smallest malus to the largest, then the absent players, by name.
  await expect(table.getByRole("rowheader")).toHaveText([/Julien/, /Sarah/, /Camille/, /Inès/, /Thomas/, /Admin/, /Hugo/, /Léa/, /Mehdi/, /Nina/, /Noé/, /Nora/]);
});

test("without a prediction on a resolved question, « Ton prono » shows the malus of the worst prediction", async ({ page }) => {
  await signIn(page, ACCOUNTS.lea);
  await page.goto("/questions?onglet=resolues");
  await page.getByRole("link", { name: RESOLVED }).click();
  const result = page.getByRole("region", { name: "Résultat" });
  await expect(result.getByText("Pas de prono : malus du pire prono")).toBeVisible();
  await expect(result).toContainText("Malus : 50");
});

test("a closed question shows everyone's predictions and the crowd, without the real value", async ({ page }) => {
  await signIn(page, ACCOUNTS.julien);
  await page.goto("/questions?onglet=en-attente");
  await page.getByRole("link", { name: CLOSED }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(CLOSED);

  await expect(page.getByText(/La question est clôturée\. Résultat attendu le /)).toBeVisible();
  // Mehdi's extension (and Hugo's, granted by e2e/admin-extension.spec.ts), without their names.
  await expect(page.getByText(/^Prolongation en cours pour \d joueurs?, jusqu'au .+ s'afficher/)).toBeVisible();
  const crowd = page.getByRole("region", { name: "Sagesse de la foule" });
  // 95, 110, 120, 130, 140, 150 and Camille's witness value, 876 543: median 130, mean 125 327.
  await expect(crowd.locator("dl > div").filter({ hasText: "Médiane" })).toContainText("130");
  await expect(crowd.locator("dl > div").filter({ hasText: "Moyenne" })).toContainText(/125\s327/);
  await expect(crowd.getByTestId("strip-chart")).toBeVisible();
  await expect(page.getByText("Réel", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Trait plein/)).toHaveCount(0);

  const table = page.getByRole("table", { name: "Pronos de tous les joueurs" });
  await expect(table.getByRole("rowheader")).toHaveText([/Admin/, /Camille/, /Inès/, /Julien/, /Léa/, /Sarah/, /Thomas/]);
  await expect(table.getByRole("row").filter({ hasText: "Inès" })).toContainText(/150 inscrits.*Joker ÷2/);
  await expect(table.getByRole("columnheader", { name: "Malus" })).toHaveCount(0);
});

test("the home page shows the latest result", async ({ page }) => {
  await signIn(page, ACCOUNTS.julien);
  const latest = page.getByRole("region", { name: "Dernier résultat" });
  await expect(latest.getByRole("article")).toHaveCount(1);
  await expect(latest.getByText("Résultat", { exact: true })).toBeVisible();
  await expect(latest.getByRole("link", { name: "Voir les pronos de tous" })).toHaveAttribute("href", /^\/questions\/\d+$/);
});

test("/classement shows the standings in the expected order, with the arrows, season by season", async ({ page }) => {
  await signIn(page, ACCOUNTS.hugo);
  await page.goto("/classement");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Classement");
  await expect(page.getByText(`Saison ${SEASONS.current.label}`, { exact: true })).toBeVisible();
  const table = page.getByRole("table", { name: `Classement de la saison ${SEASONS.current.label}` });
  // The fewest malus first: Sarah (380 once Studyrama is resolved).
  await expect(table.getByRole("rowheader").first()).toContainText("Sarah");
  await expect(table.getByRole("row").nth(1).getByRole("cell").first()).toHaveText("1");
  await expect(table.getByRole("columnheader", { name: "Malus" })).toBeVisible();
  await expect(table.getByRole("row").filter({ hasText: "Hugo" })).toContainText("(toi)");
  await expect(table.getByRole("row").filter({ hasText: "Nora" })).toContainText("(inactif)");
  await expect(page.getByText("Le moins de malus est en tête. Départage : nombre de Dans le mille, puis écart moyen le plus faible.")).toBeVisible();

  // The previous season, recomputed: before its last question (the choice), Sarah led with 10.
  const seasons = page.getByRole("navigation", { name: "Choisir la saison" });
  await expect(seasons.getByRole("link")).toHaveText([SEASONS.current.label, SEASONS.previous.label, SEASONS.older.label]);
  await seasons.getByRole("link", { name: SEASONS.previous.label }).click();
  await expect(seasons.getByRole("link", { name: SEASONS.previous.label })).toHaveAttribute("aria-current", "page");
  const previous = page.getByRole("table", { name: `Classement de la saison ${SEASONS.previous.label}` });
  await expect(previous.getByRole("rowheader")).toHaveText([/Inès/, /Sarah/, /Julien/, /Camille/, /Mehdi/, /Thomas/, /Admin/, /Hugo/, /Léa/]);
  const row = (name: string) => previous.getByRole("row").filter({ has: page.getByRole("rowheader", { name: new RegExp(name) }) });
  await expect(row("Inès")).toContainText(/^1.*monte de 1 place.*20$/);
  await expect(row("Sarah")).toContainText(/^2.*descend de 1 place.*60$/);
  await expect(row("Julien")).toContainText(/^3.*même place.*100$/);
  await expect(row("Thomas")).toContainText(/^6.*descend de 2 places.*350$/);
  await expect(page.getByText(/Le classement final de cette saison est proclamé/)).toBeVisible();

  // A player's profile, from the standings: same season.
  await row("Sarah").getByRole("link", { name: "Sarah" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sarah");
  await expect(page.getByText(`Saison ${SEASONS.previous.label}`, { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Badges" }).getByRole("listitem").filter({ hasText: "Tireur d'élite" })).toContainText("×3");
  await expect(page.getByRole("table", { name: /Historique des questions résolues/ }).getByRole("row")).toHaveCount(3);
});

test("/reglement explains the malus, without any scale nor podium bonus (v1.2)", async ({ page }) => {
  await signIn(page, ACCOUNTS.lea);
  await page.goto("/reglement");
  await expect(page.getByRole("region", { name: "Principe" })).toContainText("le moins de malus gagne");
  const number = page.getByRole("region", { name: "Malus d'une question à nombre" });
  await expect(number).toContainText("Un prono de 500 donne 500 de malus, et un prono de 1 500 aussi : 500.");
  await expect(number).toContainText(/en donne 24\s000/);
  await expect(page.getByRole("region", { name: "Pas de prono" })).toContainText("pire prono");
  await expect(page.getByRole("region", { name: "Jokers" })).toContainText("Cette saison : jokers autorisés (2 par joueur).");
  await expect(page.getByRole("region", { name: "Jokers" })).toContainText("divise par 2 le malus");
  await expect(page.getByRole("region", { name: "Prolongation pour un absent" })).toBeVisible();
  // The scale and the bonuses of v1.1 are gone.
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Bonus podium" })).toHaveCount(0);
  await expect(page.getByText("Juste Prix")).toHaveCount(0);
});

test("/palmares shows the previous season, and /lots the prizes of the current one", async ({ page }) => {
  await signIn(page, ACCOUNTS.mehdi);
  await page.goto("/palmares");
  const previous = page.getByRole("region", { name: `Saison ${SEASONS.previous.label}` });
  await expect(previous.getByRole("list", { name: `Podium de la saison ${SEASONS.previous.label}` }).getByRole("listitem")).toHaveText([
    /1er.*Inès.*20 de malus/,
    /2e.*Sarah.*60 de malus/,
    /3e.*Julien.*100 de malus/,
  ]);
  await previous.getByText(/Classement complet \(9 joueurs\)/).click();
  await expect(previous.getByRole("table")).toContainText(/Mehdi.*\(toi\)/);

  await page.goto("/lots");
  await expect(page.getByRole("list", { name: `Lots de la saison ${SEASONS.current.label}` }).getByRole("listitem")).toHaveText([
    /1er.*Un déjeuner d'équipe offert/,
    /2e.*Un sweat de l'école/,
    /3e.*Un mug de l'école/,
  ]);
});

test("the admin proclaims a season ready for it, which then appears in the palmarès", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  await page.goto("/admin/saisons");
  const seasonCard = (label: string) => page.locator("section").filter({ has: page.getByRole("heading", { name: `Saison ${label}`, exact: true }) });

  // The current season has questions waiting for their result.
  const current = seasonCard(SEASONS.current.label);
  await expect(current.getByRole("button", { name: "Proclamer le classement final" })).toBeDisabled();
  await expect(current).toContainText(/questions publiées n'ont pas encore de résultat/);

  const older = seasonCard(SEASONS.older.label);
  await older.getByRole("button", { name: "Proclamer le classement final" }).click();
  const dialog = page.getByRole("dialog", { name: "Proclamer le classement final ?" });
  await expect(dialog).toContainText("C'est irréversible");
  await expect(dialog.getByRole("button", { name: "Retour" })).toBeFocused();
  await dialog.getByRole("button", { name: "Proclamer" }).click();
  await expect(older.getByText("Classement final proclamé : il est maintenant au palmarès.")).toBeVisible();
  await expect(older).toContainText(/Proclamé le /);
  await expect(older.getByRole("button", { name: "Proclamer le classement final" })).toHaveCount(0);

  await page.goto("/palmares");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([`Saison ${SEASONS.previous.label}`, `Saison ${SEASONS.older.label}`]);
  const podium = page.getByRole("list", { name: `Podium de la saison ${SEASONS.older.label}` });
  await expect(podium.getByRole("listitem")).toHaveText([/1er.*Camille.*5 de malus/, /2e.*Sarah.*10 de malus/, /3e.*Julien.*20 de malus/]);
});
