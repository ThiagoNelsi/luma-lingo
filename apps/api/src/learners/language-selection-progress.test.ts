import { describe, expect, it } from "vitest";

import { toLanguageSelectionProgress } from "./language-selection-progress.js";

describe("toLanguageSelectionProgress", () => {
  it("marks language onboarding as completed through its current step", () => {
    expect(
      toLanguageSelectionProgress({
        instructionLanguage: "pt",
        targetLanguage: "en",
      }),
    ).toEqual({
      instructionLanguage: "pt",
      targetLanguage: "en",
      onboardingStatus: "in_progress",
      onboardingStep: "languages",
    });
  });
});
