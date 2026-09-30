import { describe, expect, it } from "vitest";
import { predictionState } from "@/lib/game/prediction-state";
import type { QuestionStatus } from "@/lib/game/question-status";

const saved = { validatedAt: null };
const validated = { validatedAt: new Date("2026-10-15T08:00:00Z") };

describe("predictionState", () => {
  it("is 'todo' without a prediction, whatever the question status", () => {
    for (const status of ["open", "closed", "resolved", "cancelled"] as const) {
      expect(predictionState(null, status)).toBe("todo");
    }
  });

  it("is 'saved' for a prediction not validated on an open question", () => {
    expect(predictionState(saved, "open")).toBe("saved");
  });

  it("is 'validated' for a validated prediction", () => {
    expect(predictionState(validated, "open")).toBe("validated");
    expect(predictionState(validated, "resolved")).toBe("validated");
  });

  it.each<QuestionStatus>(["closed", "resolved", "cancelled"])(
    "counts a saved prediction as validated once the question is %s, without any write",
    (status) => {
      expect(predictionState(saved, status)).toBe("validated");
    },
  );
});
