import { describe, expect, it } from "vitest";

import {
  formatRecordingTime,
  preferredRecordingMimeType,
} from "./recording.js";

describe("recording helpers", () => {
  it("formats elapsed milliseconds with tabular minute and second values", () => {
    expect(formatRecordingTime(65_200)).toBe("01:05");
  });

  it("chooses the first browser-supported audio format", () => {
    expect(preferredRecordingMimeType((type) => type === "audio/ogg")).toBe(
      "audio/ogg",
    );
    expect(preferredRecordingMimeType(() => false)).toBe("");
  });
});
