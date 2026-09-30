import { describe, expect, it } from "vitest";
import { AVATAR_KEYS, avatarLabel, defaultAvatarFor, initialsOf, isAvatarKey } from "@/lib/avatars";

describe("avatar keys", () => {
  it("has 16 distinct keys, maillot-<colour>-<uni|raye>", () => {
    expect(AVATAR_KEYS).toHaveLength(16);
    expect(new Set(AVATAR_KEYS).size).toBe(16);
    for (const key of AVATAR_KEYS) expect(key).toMatch(/^maillot-(marine|bleu|cyan|vert|jaune|orange|rouge|violet)-(uni|raye)$/);
  });

  it("recognises a valid key", () => {
    expect(isAvatarKey("maillot-jaune-raye")).toBe(true);
    expect(isAvatarKey("maillot-noir-uni")).toBe(false);
    expect(isAvatarKey("")).toBe(false);
  });
});

describe("defaultAvatarFor", () => {
  it("always gives the same valid key for the same id", () => {
    const id = "Xk3Pq9vT2mWb8LzR";
    expect(defaultAvatarFor(id)).toBe(defaultAvatarFor(id));
    expect(isAvatarKey(defaultAvatarFor(id))).toBe(true);
  });

  it("spreads ids over the 16 jerseys", () => {
    const used = new Set(Array.from({ length: 200 }, (_, i) => defaultAvatarFor(`user-${i}`)));
    expect(used.size).toBe(16);
  });
});

describe("initialsOf", () => {
  it("takes the first letters of the first and last words, one letter for a single word", () => {
    expect(initialsOf("Camille Martin")).toBe("CM");
    expect(initialsOf("Jean-Baptiste")).toBe("JB");
    expect(initialsOf("  élodie  ")).toBe("É");
    expect(initialsOf("Marie de la Tour")).toBe("MT");
    expect(initialsOf("Ancien joueur 3")).toBe("A3");
    expect(initialsOf("   ")).toBe("?");
  });
});

describe("avatarLabel", () => {
  it("names each jersey for the gallery", () => {
    expect(avatarLabel("maillot-bleu-raye")).toBe("Maillot bleu rayé");
    expect(avatarLabel("maillot-jaune-uni")).toBe("Maillot jaune uni");
    expect(new Set(AVATAR_KEYS.map(avatarLabel)).size).toBe(16);
  });
});
