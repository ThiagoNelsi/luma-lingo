import { describe, expect, it } from "vitest";

import {
  toggleLessonEmphasis,
  validateLessonPreferencesForm,
} from "./lesson-preferences-form.js";

describe("Lesson preferences form", () => {
  it("toggles independent Lesson emphasis choices", () => {
    expect(toggleLessonEmphasis(["listening"], "reading")).toEqual([
      "listening",
      "reading",
    ]);
    expect(toggleLessonEmphasis(["listening", "reading"], "listening")).toEqual(
      ["reading"],
    );
  });

  it("requires an emphasis while keeping Study pace optional", () => {
    expect(
      validateLessonPreferencesForm({ lessonEmphases: [], studyPace: "" }),
    ).toEqual({
      ok: false,
      error: "Escolha pelo menos uma forma de estudar.",
    });
    expect(
      validateLessonPreferencesForm({
        lessonEmphases: ["writing"],
        studyPace: "",
      }),
    ).toEqual({
      ok: true,
      selection: { lessonEmphases: ["writing"], studyPace: null },
    });
  });
});
