import { describe, expect, it } from "vitest";
import { displayNameSchema, normalizeEmail } from "@/lib/validation/account";

describe("addresses", () => {
  it("are compared in lower case, without surrounding spaces", () => {
    expect(normalizeEmail("  Camille.Martin@EM-Normandie.fr ")).toBe("camille.martin@em-normandie.fr");
  });
});

describe("display name (§6.2)", () => {
  it("has 2 to 30 characters once trimmed", () => {
    expect(displayNameSchema.parse("  Léa  ")).toBe("Léa");
    expect(displayNameSchema.safeParse("L").success).toBe(false);
    expect(displayNameSchema.safeParse("  L  ").success).toBe(false);
    expect(displayNameSchema.safeParse("L".repeat(30)).success).toBe(true);
    expect(displayNameSchema.safeParse("L".repeat(31)).success).toBe(false);
  });
});
