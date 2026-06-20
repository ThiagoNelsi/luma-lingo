import { describe, expect, it } from "vitest";

import {
  languageOptions,
  languageSelectionSchema,
  languageCodes,
} from "./languages.js";

describe("language selection", () => {
  it("offers the approved language catalog with stable codes and flags", () => {
    expect(languageOptions).toEqual([
      { code: "pt", label: "Português", flag: "🇧🇷" },
      { code: "en", label: "Inglês", flag: "🇺🇸" },
      { code: "es", label: "Espanhol", flag: "🇪🇸" },
      { code: "it", label: "Italiano", flag: "🇮🇹" },
      { code: "fr", label: "Francês", flag: "🇫🇷" },
      { code: "de", label: "Alemão", flag: "🇩🇪" },
      { code: "zh", label: "Chinês", flag: "🇨🇳" },
    ]);
    expect(languageCodes).toEqual(["pt", "en", "es", "it", "fr", "de", "zh"]);
  });

  it("accepts two different supported languages", () => {
    expect(
      languageSelectionSchema.parse({
        instructionLanguage: "pt",
        targetLanguage: "en",
      }),
    ).toEqual({ instructionLanguage: "pt", targetLanguage: "en" });
  });

  it("rejects unsupported or matching languages", () => {
    expect(() =>
      languageSelectionSchema.parse({
        instructionLanguage: "xx",
        targetLanguage: "en",
      }),
    ).toThrow();
    expect(() =>
      languageSelectionSchema.parse({
        instructionLanguage: "pt",
        targetLanguage: "pt",
      }),
    ).toThrow();
  });
});
