import { describe, expect, it } from "vitest";

import {
  createDontKnowDiagnosticResponse,
  getDiagnosticInstruction,
  splitFillBlankText,
} from "./diagnostic-question.js";

describe("diagnostic question helpers", () => {
  it("chooses localized instruction text when available", () => {
    expect(
      getDiagnosticInstruction(
        {
          schemaVersion: 1,
          kind: "multiple_choice",
          instructionLocalizations: {
            en: "Choose the best answer.",
            pt: "Escolha a melhor resposta.",
          },
          contentLanguage: "en",
          stem: "She ___ ready.",
          options: [
            { id: "option_is", text: "is" },
            { id: "option_are", text: "are" },
          ],
        },
        "pt",
      ),
    ).toBe("Escolha a melhor resposta.");
  });

  it("falls back to the first instruction localization", () => {
    expect(
      getDiagnosticInstruction(
        {
          schemaVersion: 1,
          kind: "word_bank_sequence",
          instructionLocalizations: {
            en: "Arrange the words.",
          },
          contentLanguage: "en",
          tokens: [
            { id: "token_i", text: "I" },
            { id: "token_am", text: "am" },
          ],
        },
        "pt",
      ),
    ).toBe("Arrange the words.");
  });

  it("splits fill-blank prompt text around the blank marker", () => {
    expect(splitFillBlankText("I ___ ready.")).toEqual({
      before: "I",
      after: "ready.",
      hasBlank: true,
    });
  });

  it("creates a Don't know diagnostic response", () => {
    expect(createDontKnowDiagnosticResponse()).toEqual({
      schemaVersion: 1,
      kind: "dont_know",
    });
  });
});
