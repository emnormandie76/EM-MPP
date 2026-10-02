import { describe, expect, it } from "vitest";
import { resultMessageText } from "@/lib/chat/result-message";

// Text of the automatic result message (architecture §5.15), computed on reading: a correction
// changes it, without a second message.

const NBSP = " ";

describe("resultMessageText, number question", () => {
  const base = {
    type: "number" as const,
    title: "Combien de participants à la JPO de septembre ?",
    corrected: false,
    resultNumber: 250,
    unit: "participants",
    predictions: 5,
  };

  it("gives the real value and the closest prediction", () => {
    expect(resultMessageText({ ...base, closest: ["Sarah"] })).toBe(
      "Résultat : Combien de participants à la JPO de septembre ? → 250 participants. Le plus proche : Sarah.",
    );
  });

  it("names every player tied at rank 1, in French order", () => {
    expect(resultMessageText({ ...base, closest: ["Léa", "Hugo"] })).toBe(
      "Résultat : Combien de participants à la JPO de septembre ? → 250 participants. Les plus proches : Hugo et Léa.",
    );
    expect(resultMessageText({ ...base, closest: ["Léa", "Hugo", "Élodie"] })).toMatch(/Les plus proches : Élodie, Hugo et Léa\.$/);
  });

  it("writes the value in French, without a unit when there is none", () => {
    expect(resultMessageText({ ...base, resultNumber: 2450.5, unit: null, closest: ["Inès"] })).toBe(
      `Résultat : Combien de participants à la JPO de septembre ? → 2${NBSP}450,5. Le plus proche : Inès.`,
    );
  });

  it("leaves out the second sentence without any prediction", () => {
    expect(resultMessageText({ ...base, predictions: 0, closest: [] })).toBe(
      "Résultat : Combien de participants à la JPO de septembre ? → 250 participants.",
    );
  });

  it("adds « (corrigé) » once the result has been corrected", () => {
    expect(resultMessageText({ ...base, corrected: true, closest: ["Sarah"] })).toBe(
      "Résultat (corrigé) : Combien de participants à la JPO de septembre ? → 250 participants. Le plus proche : Sarah.",
    );
  });
});

describe("resultMessageText, choice question", () => {
  const base = {
    type: "choice" as const,
    title: "Quel campus comptera le plus d'intégrés en Bachelor ?",
    corrected: false,
    rightAnswer: "Le Havre",
  };

  it("gives the right answer and how many found it", () => {
    expect(resultMessageText({ ...base, rightAnswers: 5, predictions: 8 })).toBe(
      "Résultat : Quel campus comptera le plus d'intégrés en Bachelor ? → Le Havre. 5 bonnes réponses sur 8 pronos.",
    );
  });

  it("uses the singular up to 1", () => {
    expect(resultMessageText({ ...base, rightAnswers: 1, predictions: 1 })).toMatch(/→ Le Havre\. 1 bonne réponse sur 1 prono\.$/);
    expect(resultMessageText({ ...base, rightAnswers: 0, predictions: 3 })).toMatch(/→ Le Havre\. 0 bonne réponse sur 3 pronos\.$/);
  });

  it("leaves out the second sentence without any prediction", () => {
    expect(resultMessageText({ ...base, rightAnswers: 0, predictions: 0 })).toBe(
      "Résultat : Quel campus comptera le plus d'intégrés en Bachelor ? → Le Havre.",
    );
  });

  it("adds « (corrigé) » once the result has been corrected", () => {
    expect(resultMessageText({ ...base, corrected: true, rightAnswers: 2, predictions: 3 })).toMatch(/^Résultat \(corrigé\) : Quel campus/);
  });
});
