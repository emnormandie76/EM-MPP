import type { Browser, Page } from "@playwright/test";
import { ACCOUNTS, expect, signIn, test } from "./fixtures";

// General chat (architecture §5.15, §8.3 /chat, §11 É8d). Several players in their own browser
// contexts (same client address: at most 5 sign-ins per test, §6.1). The result message of the
// Studyrama question comes from e2e/admin-questions.spec.ts, which runs before this file (the files
// run in alphabetical order).

async function playerPage(browser: Browser, extraHTTPHeaders: Record<string, string> | undefined, email: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, extraHTTPHeaders, locale: "fr-FR", timezoneId: "Europe/Paris" });
  const page = await context.newPage();
  await signIn(page, email);
  return page;
}

/** Opens /chat and waits until it has marked the thread as read (a Server Action, after the display). */
async function openChat(page: Page): Promise<void> {
  const marked = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/chat");
  await page.goto("/chat");
  await expect(page.getByRole("heading", { level: 1, name: "Chat" })).toBeVisible();
  await marked;
}

const thread = (page: Page) => page.getByRole("log", { name: "Messages du chat" });
const messageItem = (page: Page, text: string | RegExp) => thread(page).getByRole("listitem").filter({ hasText: text });

test("a message with an emoji of the grid reaches another player without reloading; a third sees the unread badge", async ({ browser, extraHTTPHeaders }) => {
  // Sarah reads the whole chat, then goes elsewhere: no badge.
  const sarah = await playerPage(browser, extraHTTPHeaders, ACCOUNTS.sarah);
  await openChat(sarah);
  await sarah.getByRole("link", { name: "Classement", exact: true }).click();
  await expect(sarah.getByRole("heading", { level: 1 })).toHaveText("Classement");
  await expect(sarah.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Chat", exact: true })).toBeVisible();

  // Hugo keeps the chat open.
  const hugo = await playerPage(browser, extraHTTPHeaders, ACCOUNTS.hugo);
  await openChat(hugo);

  // Léa writes, with a trophy from the grid.
  const lea = await playerPage(browser, extraHTTPHeaders, ACCOUNTS.lea);
  await openChat(lea);
  const field = lea.getByLabel("Ton message");
  await field.fill("Rendez-vous au salon de Caen ");
  await lea.getByRole("button", { name: "Ajouter un emoji" }).click();
  await expect(lea.getByRole("button", { name: "Ajouter un emoji" })).toHaveAttribute("aria-expanded", "true");
  const grid = lea.getByRole("group", { name: "Emojis" });
  await expect(grid.getByRole("button")).toHaveCount(48);
  await grid.getByRole("button", { name: "trophée" }).click();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("Rendez-vous au salon de Caen 🏆");
  await expect(lea.getByText("30 / 500")).toBeVisible();
  await field.press("Enter");
  await expect(field).toHaveValue("");
  await expect(messageItem(lea, "Rendez-vous au salon de Caen 🏆")).toBeVisible();
  // Her own message can be deleted by her; Hugo's seeded message cannot.
  await expect(messageItem(lea, "Rendez-vous au salon de Caen 🏆").getByRole("button", { name: "Supprimer le message" })).toBeVisible();
  await expect(messageItem(lea, "Bravo à ceux qui avaient trouvé Le Havre").getByRole("button", { name: "Supprimer le message" })).toHaveCount(0);

  // Hugo sees it arrive by the polling, within one turn of 10 s.
  await expect(messageItem(hugo, "Rendez-vous au salon de Caen 🏆")).toBeVisible({ timeout: 15_000 });
  await expect(messageItem(hugo, "Rendez-vous au salon de Caen 🏆")).toContainText("Léa");

  // Sarah moves to another page: the badge shows the new message.
  await sarah.getByRole("link", { name: "Accueil", exact: true }).click();
  await expect(sarah.getByRole("heading", { level: 1 })).toContainText("Salut");
  await expect(sarah.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Chat, 1 message non lu" })).toBeVisible();

  for (const page of [sarah, hugo, lea]) await page.context().close();
});

test("a player deletes their own message, the admin anyone's; a deleted text never leaves the server", async ({ page, browser, extraHTTPHeaders }) => {
  await signIn(page, ACCOUNTS.thomas);
  await openChat(page);
  await page.getByLabel("Ton message").fill("Message à supprimer très vite");
  await page.getByRole("button", { name: "Envoyer" }).click();
  const own = messageItem(page, "Message à supprimer très vite");
  await expect(own).toBeVisible();
  await own.getByRole("button", { name: "Supprimer le message" }).click();
  const dialog = page.getByRole("dialog", { name: "Supprimer ce message ?" });
  await expect(dialog).toContainText("Il sera remplacé par « Message supprimé. » pour tout le monde.");
  await dialog.getByRole("button", { name: "Supprimer" }).click();
  await expect(dialog).toBeHidden();
  await expect(thread(page)).not.toContainText("Message à supprimer très vite");

  // The polling sends no deleted text, even when asked for everything.
  const response = await page.request.get(`/api/chat?after=0&since=${encodeURIComponent(new Date(0).toISOString())}`);
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).not.toContain("Message à supprimer très vite");
  expect(JSON.parse(body).deletedIds.length).toBeGreaterThanOrEqual(2);

  // The admin deletes a player's message.
  const admin = await playerPage(browser, extraHTTPHeaders, ACCOUNTS.admin);
  await openChat(admin);
  const hugos = messageItem(admin, "Bravo à ceux qui avaient trouvé Le Havre");
  await hugos.getByRole("button", { name: "Supprimer le message" }).click();
  await admin.getByRole("dialog", { name: "Supprimer ce message ?" }).getByRole("button", { name: "Supprimer" }).click();
  await expect(thread(admin)).not.toContainText("Bravo à ceux qui avaient trouvé Le Havre");
  await expect(thread(admin).getByRole("listitem").filter({ hasText: "Hugo" }).first()).toContainText("Message supprimé.");
  await admin.context().close();

  // Thomas sees both deletions after a reload.
  await page.reload();
  await expect(thread(page)).not.toContainText("Bravo à ceux qui avaient trouvé Le Havre");
  await expect(thread(page)).not.toContainText("Message à supprimer très vite");
});

test("the result of the Studyrama question is announced in the chat, corrected, with a link to the question", async ({ page }) => {
  await signIn(page, ACCOUNTS.julien);
  await page.goto("/chat");
  // Entered at 245, then corrected to 250 by e2e/admin-questions.spec.ts: Inès predicted 250.
  const result = messageItem(page, "Studyrama");
  await expect(result).toContainText(
    "Résultat (corrigé) : Combien de visiteurs sur le stand du salon Studyrama ? → 250 visiteurs. Le plus proche : Inès.",
  );
  await result.getByRole("link", { name: "Voir la question" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Combien de visiteurs sur le stand du salon Studyrama ?");
});

test("/api/chat answers 401 without a session, and checks its parameters", async ({ page, request }) => {
  const anonymous = await request.get(`/api/chat?after=0&since=${encodeURIComponent(new Date().toISOString())}`, { maxRedirects: 0 });
  expect(anonymous.status()).toBe(401);
  expect(anonymous.headers()["cache-control"]).toBe("no-store");
  expect(await anonymous.json()).toEqual({ error: "NOT_AUTHENTICATED" });

  await signIn(page, ACCOUNTS.julien);
  for (const query of ["", "?after=abc&since=2026-10-01T00:00:00Z", "?after=0&since=hier"]) {
    const response = await page.request.get(`/api/chat${query}`);
    expect(response.status(), query).toBe(400);
  }
  const fresh = await page.request.get(`/api/chat?after=0&since=${encodeURIComponent(new Date().toISOString())}`);
  expect(fresh.status()).toBe(200);
  expect(Object.keys(await fresh.json()).sort()).toEqual(["deletedIds", "messages", "serverTime"]);
});

// Task 8 of step 8d: the page stops asking the server while the tab is hidden or the person idle,
// then asks at once when the tab shows again or the person acts. The page's clock is simulated.
test("polls every 10 s, stops while the tab is hidden or the person is idle, and resumes at once", async ({ page }) => {
  const polls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/chat") polls.push(request.url());
  });
  await page.clock.install();
  await signIn(page, ACCOUNTS.julien);
  await page.goto("/chat");
  await expect(page.getByRole("heading", { level: 1, name: "Chat" })).toBeVisible();
  await page.clock.pauseAt(Date.now() + 2_000);
  polls.length = 0;

  /** Moves the page's clock on, and waits for the poll it triggers to be handled. */
  async function runAndPoll(ms: number): Promise<void> {
    const answered = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/chat");
    await page.clock.runFor(ms);
    await answered;
    // The next turn is planned once the answer is read.
    await page.waitForTimeout(150);
  }
  /** Moves the page's clock on, and checks that no poll comes. */
  async function runWithoutPoll(ms: number): Promise<void> {
    const before = polls.length;
    await page.clock.runFor(ms);
    await page.waitForTimeout(500);
    expect(polls.length).toBe(before);
  }
  async function setVisibility(state: "visible" | "hidden"): Promise<void> {
    await page.evaluate((value) => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
      document.dispatchEvent(new Event("visibilitychange"));
    }, state);
  }

  // Visible and active: one poll every 10 seconds.
  await runAndPoll(10_000);
  expect(polls).toHaveLength(1);
  expect(polls[0]).toMatch(/\/api\/chat\?after=\d+&since=/);

  // Hidden tab: no poll, however long it stays hidden.
  await setVisibility("hidden");
  await runWithoutPoll(10_000);
  await runWithoutPoll(120_000);

  // Visible again: a poll at once, then every 10 s.
  const resumed = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/chat");
  await setVisibility("visible");
  await resumed;
  await page.waitForTimeout(150);
  expect(polls).toHaveLength(2);

  // Idle: the polls go on for 5 minutes after the last action, then stop.
  for (let turn = 1; turn <= 29; turn += 1) await runAndPoll(10_000);
  expect(polls).toHaveLength(31);
  await runWithoutPoll(10_000);
  await runWithoutPoll(180_000);

  // An action of the person: a poll at once.
  const woken = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/chat");
  await page.mouse.move(200, 200);
  await woken;
  expect(polls).toHaveLength(32);
});
