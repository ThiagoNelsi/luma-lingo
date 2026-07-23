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
      other: [],
    });

    expect(result.interests).toEqual(["música"]);
    expect(Object.keys(result)).not.toContain("age");
    expect(Object.keys(result)).not.toContain("dailyRoutine");
    expect(Object.keys(result)).not.toContain("studyContext");
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
        other: [],
      }),
    ).toThrow();

    expect(
      confirmedProfileSchema.parse({
        jobOrField: "Engenharia de software",
        interests: ["música"],
        other: [],
      }),
    ).toMatchObject({ jobOrField: "Engenharia de software" });
  });
});
