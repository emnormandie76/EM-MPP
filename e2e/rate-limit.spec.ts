import { expect, test } from "./fixtures";

// Attempt limit (architecture §6.1): the whole school goes out through one address, so several
// sign-ins at once must not block each other. The limit itself is in portail-sign-in.test.ts.

test("a team signing in together from one address is not blocked", async ({ request }) => {
  const origin = test.info().project.use.baseURL!;
  const statuses: number[] = [];
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await request.post("/api/auth/sign-in/social", {
      headers: { origin },
      data: { provider: "portail", callbackURL: "/" },
    });
    statuses.push(response.status());
  }
  expect(statuses).toEqual([200, 200, 200, 200, 200, 200]);
});
