// Betting vocabulary, never used in the interface (architecture §8.6, §9.3): "pari", "mise"…
// "Paris", the city, is allowed.
const FORBIDDEN = [/\b(pari|parier|parieur|mise|miser)\b/g, /\bparis sportifs?\b/gi];

/** The forbidden words found in a text, in order. */
export function findForbiddenWords(text: string): string[] {
  return FORBIDDEN.flatMap((pattern) => text.match(pattern) ?? []);
}
