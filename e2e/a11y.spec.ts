import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Architecture §9.4: no "serious" or "critical" violation. Pages are added step by step.
const PAGES = ["/", "/cette-page-n-existe-pas"];

for (const url of PAGES) {
  test(`${url} has no serious or critical accessibility violation`, async ({ page }) => {
    await page.goto(url);
    const { violations } = await new AxeBuilder({ page }).analyze();
    const blocking = violations
      .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
      .map((violation) => `${violation.id}: ${violation.help}`);
    expect(blocking).toEqual([]);
  });
}
