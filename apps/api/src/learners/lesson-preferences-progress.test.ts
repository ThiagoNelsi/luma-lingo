import { describe, expect, it } from "vitest";

import { toLessonPreferencesProgress } from "./lesson-preferences-progress.js";

describe("toLessonPreferencesProgress", () => {
  it("marks Lesson preferences as the current completed onboarding step", () => {
    expect(
      toLessonPreferencesProgress({
        lessonEmphases: ["listening", "writing"],
        studyPace: null,
      }),
    ).toEqual({
      lessonEmphases: ["listening", "writing"],
      studyPace: null,
      onboardingStatus: "in_progress",
      onboardingStep: "lesson_preferences",
    });
  });
});
