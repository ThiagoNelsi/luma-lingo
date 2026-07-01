import { describe, expect, it } from "vitest";

import { toOnboardingCompletion } from "./onboarding-completion.js";

describe("toOnboardingCompletion", () => {
  it("returns the persisted completed onboarding state", () => {
    expect(toOnboardingCompletion()).toEqual({
      onboardingStatus: "completed",
      onboardingStep: null,
    });
  });
});
