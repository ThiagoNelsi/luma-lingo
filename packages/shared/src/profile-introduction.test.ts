import { describe, expect, it } from "vitest";

import {
  confirmedProfileSchema,
  extractedProfileSchema,
  profileIntroductionStatusSchema,
} from "./profile-introduction.js";

describe("profile introduction contracts", () => {
  it("accepts only the approved explicit profile fields", () => {
    const result = extractedProfileSchema.parse({
      jobOrField: "Engenharia de software",
      interests: ["música"],
      dailyRoutine: ["trabalha pela manhã"],
      studyContext: "estuda no ônibus",
      other: [],
    });

    expect(result.interests).toEqual(["música"]);
    expect(Object.keys(result)).not.toContain("age");
  });

  it("defines the persisted processing lifecycle", () => {
    expect(profileIntroductionStatusSchema.options).toEqual([
      "not_started",
      "pending",
      "processing",
      "completed",
      "failed",
      "manual_required",
    ]);
  });

  it("requires the details needed to confirm a learner profile", () => {
    expect(() =>
      confirmedProfileSchema.parse({
        jobOrField: "",
        interests: [],
        dailyRoutine: [],
        studyContext: null,
        other: [],
      }),
    ).toThrow();

    expect(
      confirmedProfileSchema.parse({
        jobOrField: "Engenharia de software",
        interests: ["música"],
        dailyRoutine: [],
        studyContext: null,
        other: [],
      }),
    ).toMatchObject({ jobOrField: "Engenharia de software" });
  });
});
