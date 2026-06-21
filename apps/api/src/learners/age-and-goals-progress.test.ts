import { describe, expect, it } from "vitest";

import { toAgeAndGoalsProgress } from "./age-and-goals-progress.js";

describe("toAgeAndGoalsProgress", () => {
  it("marks age and goals as the current completed onboarding step", () => {
    expect(
      toAgeAndGoalsProgress({
        ageRange: "25_39",
        displayName: "Thiago",
        primaryGoal: "cefr_level",
        cefrGoalLevel: "B2",
        additionalGoals: ["travel"],
      }),
    ).toEqual({
      ageRange: "25_39",
      displayName: "Thiago",
      primaryGoal: "cefr_level",
      cefrGoalLevel: "B2",
      additionalGoals: ["travel"],
      onboardingStatus: "in_progress",
      onboardingStep: "age_and_goals",
    });
  });
});
