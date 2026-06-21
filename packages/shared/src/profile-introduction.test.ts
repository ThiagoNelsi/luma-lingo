import { describe, expect, it } from "vitest";

import {
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
});
