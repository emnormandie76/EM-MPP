import { describe, expect, it } from "vitest";
import {
  displayNameSchema,
  normalizeEmail,
  parseAdminEmails,
  parseEmail,
  splitEmailList,
} from "@/lib/validation/account";

describe("addresses", () => {
  it("are compared in lower case, without surrounding spaces", () => {
    expect(normalizeEmail("  Camille.Martin@EM-Normandie.fr ")).toBe("camille.martin@em-normandie.fr");
    expect(parseEmail(" Camille@Example.test ")).toBe("camille@example.test");
    expect(parseEmail("pas-une-adresse")).toBeNull();
    expect(parseEmail("deux mots@example.test")).toBeNull();
  });

  it("ADMIN_EMAILS is a comma-separated list", () => {
    expect(parseAdminEmails(" A@example.test, b@example.test ,,")).toEqual(["a@example.test", "b@example.test"]);
    expect(parseAdminEmails(undefined)).toEqual([]);
  });

  it("a pasted list accepts lines, commas and semicolons", () => {
    expect(splitEmailList("a@x.fr\r\nb@x.fr, c@x.fr;d@x.fr\n\n ; ")).toEqual(["a@x.fr", "b@x.fr", "c@x.fr", "d@x.fr"]);
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
