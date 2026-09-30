// Avatar keys (architecture §8.2): 16 jerseys, 8 colours × 2 patterns. The drawings arrive in
// step 4 (src/components/avatars/); the keys are stored in `user.avatar`.

export const AVATAR_COLORS = ["marine", "bleu", "cyan", "vert", "jaune", "orange", "rouge", "violet"] as const;
export const AVATAR_PATTERNS = ["uni", "raye"] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];
export type AvatarPattern = (typeof AVATAR_PATTERNS)[number];
export type AvatarKey = `maillot-${AvatarColor}-${AvatarPattern}`;

export const AVATAR_KEYS: readonly AvatarKey[] = AVATAR_COLORS.flatMap((color) =>
  AVATAR_PATTERNS.map((pattern): AvatarKey => `maillot-${color}-${pattern}`),
);

export function isAvatarKey(value: string): value is AvatarKey {
  return (AVATAR_KEYS as readonly string[]).includes(value);
}

/** 32-bit FNV-1a fingerprint of a string. */
function fingerprint(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** Avatar given at sign-up: fingerprint of the user id, modulo 16. */
export function defaultAvatarFor(userId: string): AvatarKey {
  return AVATAR_KEYS[fingerprint(userId) % AVATAR_KEYS.length];
}
