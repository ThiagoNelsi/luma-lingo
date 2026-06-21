import { describe, expect, it } from "vitest";

import {
  lessonEmphasisOptions,
  lessonPreferencesSelectionSchema,
  studyPaceOptions,
} from "./lesson-preferences.js";

describe("lesson preferences contracts", () => {
  it("accepts one or more approved lesson emphases and optional Study pace", () => {
    expect(
      lessonPreferencesSelectionSchema.parse({
        lessonEmphases: ["listening", "reading"],
        studyPace: "relaxed",
      }),
    ).toEqual({
      lessonEmphases: ["listening", "reading"],
      studyPace: "relaxed",
    });
    expect(
      lessonPreferencesSelectionSchema.parse({
        lessonEmphases: ["writing"],
        studyPace: null,
      }),
    ).toEqual({ lessonEmphases: ["writing"], studyPace: null });
  });

  it("exposes intuitive labels without offering Speaking", () => {
    expect(lessonEmphasisOptions).toEqual([
      expect.objectContaining({ value: "listening", label: "Ouvir" }),
      expect.objectContaining({ value: "reading", label: "Ler" }),
      expect.objectContaining({ value: "writing", label: "Escrever" }),
    ]);
    expect(studyPaceOptions.map(({ label }) => label)).toEqual([
      "Com calma",
      "Mais rápido",
    ]);
    expect(
      lessonPreferencesSelectionSchema.safeParse({
        lessonEmphases: ["speaking"],
        studyPace: null,
      }).success,
    ).toBe(false);
  });

  it("rejects empty and duplicate emphasis selections", () => {
    expect(
      lessonPreferencesSelectionSchema.safeParse({
        lessonEmphases: [],
        studyPace: null,
      }).success,
    ).toBe(false);
    expect(
      lessonPreferencesSelectionSchema.safeParse({
        lessonEmphases: ["reading", "reading"],
        studyPace: "accelerated",
      }).success,
    ).toBe(false);
  });
});
