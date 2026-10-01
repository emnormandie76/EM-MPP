import { ACCOUNTS, expect, signIn, test } from "./fixtures";

// Architecture §3.3 and §10: security headers on every route, nothing indexed (private site).

const SECURITY_HEADERS = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-robots-tag": "noindex, nofollow",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

function expectSecurityHeaders(headers: Record<string, string>, url: string): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(headers[name], `${name} on ${url}`).toBe(value);
  expect(headers["x-powered-by"], `x-powered-by on ${url}`).toBeUndefined();
}

test("public routes, the API and static files carry the security headers", async ({ request }) => {
  // Without a session, a game page redirects to /connexion: the redirect carries them too.
  for (const url of ["/connexion", "/inscription", "/api/health", "/robots.txt", "/"]) {
    const response = await request.get(url, { maxRedirects: 0 });
    expectSecurityHeaders(response.headers(), url);
  }
});

test("signed-in pages carry the security headers and a noindex robots tag", async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  for (const url of ["/", "/classement", "/admin"]) {
    const response = await page.goto(url);
    expectSecurityHeaders(response!.headers(), url);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex, nofollow/);
  }
});

test("robots.txt forbids everything", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();
  expect(body).toMatch(/User-Agent: \*/i);
  expect(body).toMatch(/Disallow: \/\s*$/m);
});

test("/api/health only answers whether the database responds", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(await response.json()).toEqual({ ok: true });
});
