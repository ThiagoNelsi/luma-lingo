import { beforeEach, describe, expect, it } from "vitest";

import {
  clearProfileIntroductionRecording,
  getProfileIntroductionRecording,
  saveProfileIntroductionRecording,
} from "./profile-introduction-recording.js";

describe("profile introduction recording memory", () => {
  beforeEach(() => clearProfileIntroductionRecording());

  it("keeps a recording available across onboarding routes without using browser storage", () => {
    const audio = new Blob(["recording"], { type: "audio/webm" });
    saveProfileIntroductionRecording({ audio, durationMs: 1_500 });

    expect(getProfileIntroductionRecording()).toEqual({
      audio,
      durationMs: 1_500,
    });

    clearProfileIntroductionRecording();
    expect(getProfileIntroductionRecording()).toBeNull();
  });
});
