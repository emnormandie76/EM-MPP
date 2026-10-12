import { describe, expect, it } from "vitest";
import { canSeeRulesPage, RULES_PAGE_FOR_PLAYERS } from "@/lib/app";

// Architecture §6.4, point 6 (v1.4, step 8e): the rules page is for admins only until step 10.

describe("canSeeRulesPage", () => {
  it("keeps the rules page for the admins until step 10", () => {
    // Step 10 sets the constant to true, and this expectation with it.
    expect(RULES_PAGE_FOR_PLAYERS).toBe(false);
    expect(canSeeRulesPage(true)).toBe(true);
    expect(canSeeRulesPage(false)).toBe(false);
  });

  it("shows the page to an admin only while it is closed to the players", () => {
    expect(canSeeRulesPage(true, false)).toBe(true);
    expect(canSeeRulesPage(false, false)).toBe(false);
  });

  it("shows the page to everyone once it is open to the players", () => {
    expect(canSeeRulesPage(true, true)).toBe(true);
    expect(canSeeRulesPage(false, true)).toBe(true);
  });
});
