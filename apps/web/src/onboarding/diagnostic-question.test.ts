import { describe, expect, it } from "vitest";

import {
  createDontKnowDiagnosticResponse,
  getDiagnosticInstruction,
  getWordBankResetKey,
  shuffleWordBankTokens,
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

  it("shuffles word-bank tokens without changing the authored token order", () => {
    const tokens = [
      { id: "token_i", text: "I" },
      { id: "token_study", text: "study" },
      { id: "token_engineering", text: "engineering" },
    ];

    expect(shuffleWordBankTokens(tokens, () => 0)).toEqual([
      { id: "token_study", text: "study" },
      { id: "token_engineering", text: "engineering" },
      { id: "token_i", text: "I" },
    ]);
    expect(tokens).toEqual([
      { id: "token_i", text: "I" },
      { id: "token_study", text: "study" },
      { id: "token_engineering", text: "engineering" },
    ]);
  });

  it("does not leave a multi-token word bank in its authored order", () => {
    const tokens = ["first", "second"];

    expect(shuffleWordBankTokens(tokens, () => 0.99)).toEqual([
      "second",
      "first",
    ]);
  });

  it("changes the word-bank reset key when a token label changes", () => {
    const prompt = {
      schemaVersion: 1 as const,
      kind: "word_bank_sequence" as const,
      instructionLocalizations: { en: "Arrange the words." },
      contentLanguage: "en" as const,
      tokens: [
        { id: "token_i", text: "I" },
        { id: "token_am", text: "am" },
      ],
    };

    expect(getWordBankResetKey(prompt)).not.toBe(
      getWordBankResetKey({
        ...prompt,
        tokens: [
          { id: "token_i", text: "I" },
          { id: "token_am", text: "are" },
        ],
      }),
    );
  });
});
