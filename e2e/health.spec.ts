import { expect, test } from "@playwright/test";

test("/api/health reaches the database and is never cached", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(response.headers()["cache-control"]).toContain("no-store");
});
