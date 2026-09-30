import { describe, expect, it } from "vitest";
import { parseNumberInput } from "@/lib/game/number-input";

const NBSP = " ";
const NARROW_NBSP = " ";

function value(raw: string): number {
  const result = parseNumberInput(raw);
  if (!result.ok) throw new Error(`expected a number for ${JSON.stringify(raw)}, got "${result.message}"`);
  return result.value;
}

function error(raw: string): string {
  const result = parseNumberInput(raw);
  if (result.ok) throw new Error(`expected an error for ${JSON.stringify(raw)}, got ${result.value}`);
  return result.message;
}

describe("parseNumberInput: vectors N1 to N11", () => {
  it("N1: '2 450' (normal space) gives 2450", () => {
    expect(value("2 450")).toBe(2450);
  });

  it("N2: '2 450' with a narrow no-break space gives 2450", () => {
    expect(value(`2${NARROW_NBSP}450`)).toBe(2450);
  });

  it("N3: '2450,5' gives 2450.5", () => {
    expect(value("2450,5")).toBe(2450.5);
  });

  it("N4: '12.5' gives 12.5", () => {
    expect(value("12.5")).toBe(12.5);
  });

  it("N5: '2.450' is refused (point used for thousands)", () => {
    expect(error("2.450")).toBe(`Écris 2450 ou 2${NARROW_NBSP}450 (pas de point pour les milliers).`);
  });

  it("N6: '12,345' is refused (3 decimals)", () => {
    expect(error("12,345")).toBe("2 décimales au maximum.");
  });

  it("N7: '-3' is refused", () => {
    expect(error("-3")).toBe("Saisis un nombre positif, sans lettres.");
  });

  it("N8: '1e5' is refused", () => {
    expect(error("1e5")).toBe("Saisis un nombre positif, sans lettres.");
  });

  it("N9: '' is refused", () => {
    expect(error("")).toBe("Saisis un nombre.");
  });

  it("N10: ' 0 ' gives 0", () => {
    expect(value(" 0 ")).toBe(0);
  });

  it("N11: '1.234,5' is refused (point and comma)", () => {
    expect(error("1.234,5")).toBe("Format non reconnu.");
  });
});

describe("parseNumberInput: other cases", () => {
  it("removes every kind of space, inside and around", () => {
    expect(value(`  1${NBSP}234${NARROW_NBSP}567 `)).toBe(1234567);
    expect(value("\t12,5\n")).toBe(12.5);
  });

  it("refuses blank input", () => {
    expect(error("   ")).toBe("Saisis un nombre.");
    expect(error(NBSP)).toBe("Saisis un nombre.");
  });

  it("accepts 1 or 2 decimals, with a point or a comma", () => {
    expect(value("12,50")).toBe(12.5);
    expect(value("0.05")).toBe(0.05);
    expect(value("99,99")).toBe(99.99);
  });

  it("gives the right advice for grouped thousands with points", () => {
    expect(error("1.234.567")).toBe(`Écris 1234567 ou 1${NARROW_NBSP}234${NARROW_NBSP}567 (pas de point pour les milliers).`);
    expect(error("12.500")).toBe(`Écris 12500 ou 12${NARROW_NBSP}500 (pas de point pour les milliers).`);
  });

  it("refuses more than 2 decimals when it cannot be thousands", () => {
    expect(error("12.3456")).toBe("2 décimales au maximum.");
    expect(error("1234.567")).toBe("2 décimales au maximum.");
  });

  it("refuses signs, letters and symbols", () => {
    for (const raw of ["+3", "12a", "abc", "12 %", "3€", "0x10", "Infinity", "NaN"]) {
      expect(error(raw)).toBe("Saisis un nombre positif, sans lettres.");
    }
  });

  it("refuses malformed separators", () => {
    for (const raw of ["1,2,3", ",5", "5,", ".5", "5.", "1..2"]) {
      expect(error(raw)).toBe("Format non reconnu.");
    }
  });

  it("accepts 999 999 999,99 and refuses anything bigger", () => {
    expect(value("999 999 999,99")).toBe(999_999_999.99);
    expect(error("1 000 000 000")).toBe("Nombre trop grand.");
    expect(error("99999999999999999999")).toBe("Nombre trop grand.");
  });

  it("ignores leading zeros", () => {
    expect(value("007")).toBe(7);
    expect(value("0000000001234,5")).toBe(1234.5);
  });
});
