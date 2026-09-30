// Avatar keys (architecture §8.2): 16 jerseys, 8 colours × 2 patterns, drawn by
// src/components/avatars/Avatar.tsx; the keys are stored in `user.avatar`.

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

export function parseAvatarKey(key: AvatarKey): { color: AvatarColor; pattern: AvatarPattern } {
  const [, color, pattern] = key.split("-") as [string, AvatarColor, AvatarPattern];
  return { color, pattern };
}

const PATTERN_LABELS: Record<AvatarPattern, string> = { uni: "uni", raye: "rayé" };

/** "Maillot bleu rayé": accessible name of a jersey in the gallery. */
export function avatarLabel(key: AvatarKey): string {
  const { color, pattern } = parseAvatarKey(key);
  return `Maillot ${color} ${PATTERN_LABELS[pattern]}`;
}

/** Initials printed on the jersey: first letters of the first and last words ("Camille Martin" → "CM"), one letter for a single word. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return letters.map((word) => Array.from(word)[0].toLocaleUpperCase("fr")).join("");
}
