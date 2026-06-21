import { describe, expect, it } from "vitest";

import {
  ageAndGoalsSelectionSchema,
  additionalGoalValues,
  goalValues,
  learnerAgeRangeValues,
} from "./age-and-goals.js";

describe("age and goals selection", () => {
  it("exposes the approved constrained choices", () => {
    expect(learnerAgeRangeValues).toEqual([
      "under_13",
      "13_17",
      "18_24",
      "25_39",
      "40_59",
      "60_plus",
    ]);
    expect(goalValues).toEqual([
      "everyday_conversation",
      "work",
      "travel",
      "exam_prep",
      "cefr_level",
    ]);
    expect(additionalGoalValues).toEqual([
      "everyday_conversation",
      "work",
      "travel",
    ]);
  });

  it("accepts an optional display name and up to two distinct additional goals", () => {
    expect(
      ageAndGoalsSelectionSchema.parse({
        ageRange: "25_39",
        displayName: "  Thiago  ",
        primaryGoal: "exam_prep",
        cefrGoalLevel: null,
        additionalGoals: ["everyday_conversation", "travel"],
      }),
    ).toEqual({
      ageRange: "25_39",
      displayName: "Thiago",
      primaryGoal: "exam_prep",
      cefrGoalLevel: null,
      additionalGoals: ["everyday_conversation", "travel"],
    });
  });

  it("requires A1 through B2 when CEFR level is the primary goal", () => {
    expect(() =>
      ageAndGoalsSelectionSchema.parse({
        ageRange: "18_24",
        displayName: null,
        primaryGoal: "cefr_level",
        cefrGoalLevel: null,
        additionalGoals: [],
      }),
    ).toThrow();
    expect(
      ageAndGoalsSelectionSchema.parse({
        ageRange: "18_24",
        displayName: null,
        primaryGoal: "cefr_level",
        cefrGoalLevel: "B2",
        additionalGoals: [],
      }).cefrGoalLevel,
    ).toBe("B2");
  });

  it("rejects unsupported, duplicate, excessive, or primary-matching additional goals", () => {
    const base = {
      ageRange: "40_59",
      displayName: null,
      primaryGoal: "work",
      cefrGoalLevel: null,
    } as const;

    for (const additionalGoals of [
      ["exam_prep"],
      ["travel", "travel"],
      ["everyday_conversation", "work"],
      ["everyday_conversation", "travel", "work"],
    ]) {
      expect(
        ageAndGoalsSelectionSchema.safeParse({
          ...base,
          additionalGoals,
        }).success,
      ).toBe(false);
    }
  });
});
