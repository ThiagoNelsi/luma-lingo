import { describe, expect, it } from "vitest";

import {
  onboardingStartingPointOptions,
  onboardingStartingPointSelectionSchema,
} from "./onboarding-starting-point.js";

describe("Onboarding starting point contracts", () => {
  it("accepts Beginner path and Diagnostic path choices", () => {
    expect(
      onboardingStartingPointSelectionSchema.parse({
        onboardingStartingPoint: "beginner",
      }),
    ).toEqual({ onboardingStartingPoint: "beginner" });
    expect(
      onboardingStartingPointSelectionSchema.parse({
        onboardingStartingPoint: "diagnostic",
      }),
    ).toEqual({ onboardingStartingPoint: "diagnostic" });
  });

  it("exposes the learner-facing path labels", () => {
    expect(onboardingStartingPointOptions).toEqual([
      expect.objectContaining({
        value: "beginner",
        label: "Começar do zero",
      }),
      expect.objectContaining({
        value: "diagnostic",
        label: "Fazer um teste rápido",
      }),
    ]);
    expect(
      onboardingStartingPointSelectionSchema.safeParse({
        onboardingStartingPoint: "cefr_level",
      }).success,
    ).toBe(false);
  });
});
