import { describe, expect, it } from "vitest";

import { toOnboardingStartingPointProgress } from "./onboarding-starting-point-progress.js";

describe("toOnboardingStartingPointProgress", () => {
  it("marks Onboarding starting point as the current completed onboarding step", () => {
    expect(
      toOnboardingStartingPointProgress({
        onboardingStartingPoint: "diagnostic",
      }),
    ).toEqual({
      onboardingStartingPoint: "diagnostic",
      onboardingStatus: "in_progress",
      onboardingStep: "starting_point",
    });
  });
});
