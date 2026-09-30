// Reading the numbers typed by players and by the admin (architecture §5.3).

export type NumberInputResult = { ok: true; value: number } | { ok: false; message: string };

const NARROW_NBSP = " ";

/** Largest accepted value, 999 999 999,99: at most 9 digits before the decimal separator. */
const MAX_INTEGER_DIGITS = 9;
const MAX_DECIMALS = 2;

/** "2.450", "1.234.567": points used as thousands separators. */
const DOTTED_THOUSANDS = /^[1-9]\d{0,2}(\.\d{3})+$/;

function fail(message: string): NumberInputResult {
  return { ok: false, message };
}

/** "1234567" → "1 234 567", grouped like `formatNumber` does. */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+$)/g, NARROW_NBSP);
}

export function parseNumberInput(raw: string): NumberInputResult {
  // `\s` covers the normal, no-break and narrow no-break spaces, inside and around.
  let text = raw.replace(/\s/g, "");
  if (text === "") return fail("Saisis un nombre.");

  if (text.includes(",")) {
    // With a comma, the comma is the decimal separator: a point can only be a mistake.
    if (text.includes(".")) return fail("Format non reconnu.");
    text = text.replaceAll(",", ".");
  } else if (DOTTED_THOUSANDS.test(text)) {
    const digits = text.replaceAll(".", "");
    return fail(`Écris ${digits} ou ${groupThousands(digits)} (pas de point pour les milliers).`);
  }

  // No sign, no exponent, no letter.
  if (!/^[\d.]+$/.test(text)) return fail("Saisis un nombre positif, sans lettres.");
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return fail("Format non reconnu.");

  const [, integerPart, decimals = ""] = match;
  if (decimals.length > MAX_DECIMALS) return fail(`${MAX_DECIMALS} décimales au maximum.`);
  if (integerPart.replace(/^0+/, "").length > MAX_INTEGER_DIGITS) return fail("Nombre trop grand.");

  return { ok: true, value: Number(text) };
}
