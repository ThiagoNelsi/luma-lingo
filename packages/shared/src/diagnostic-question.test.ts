import { describe, expect, it } from "vitest";

import {
  authoredDiagnosticQuestionSchema,
  diagnosticQuestionResponseSchema,
} from "./diagnostic-question.js";

const validFillBlankQuestion = {
  key: "en.diag.pre-a1.be-present.foundation.001",
  status: "draft",
  primaryCompetencyKey: "pre-a1-core-be-present-affirmative",
  difficultyBand: "Pre-A1",
  responseFormat: "fill_blank_choice",
  prompt: {
    schemaVersion: 1,
    kind: "fill_blank_choice",
    instructionLocalizations: {
      pt: "Escolha a palavra correta.",
      en: "Choose the correct word.",
    },
    contentLanguage: "en",
    text: "She ___ tired.",
    blankId: "blank_1",
    options: [
      { id: "option_is", text: "is" },
      { id: "option_are", text: "are" },
    ],
  },
  scoringRule: {
    schemaVersion: 1,
    kind: "fill_blank_choice",
    maxScore: 1,
    blankId: "blank_1",
    correctOptionIds: ["option_is"],
    distractors: {
      option_are: {
        mistakeCode: "grammar.be.wrong_form",
        rationale:
          "Uses a plural or second-person be form with a third-person singular subject.",
      },
    },
    passingScore: 1,
    evidenceConfidence: 0.8,
  },
  targets: [
    {
      competencyKey: "pre-a1-core-be-present-affirmative",
      role: "primary",
      weight: 100,
    },
  ],
  details: {
    schemaVersion: 1,
    diagnosticRoles: ["foundation"],
    rationale: "Checks whether the learner can choose the correct be form.",
    safetyNotes: [],
    localizationNotes: [
      "Instruction translations must not mention the verb to be.",
    ],
    distractorRationale: {
      option_are: "Common agreement error with third-person singular subjects.",
    },
    authoringSource: {
      plan: "onboarding-diagnostic-question-plan",
      variant: "foundation",
    },
  },
} as const;

const validWordBankQuestion = {
  key: "en.diag.pre-a1.be-present.repair.001",
  status: "draft",
  primaryCompetencyKey: "pre-a1-core-be-present-affirmative",
  difficultyBand: "Pre-A1",
  responseFormat: "word_bank_sequence",
  prompt: {
    schemaVersion: 1,
    kind: "word_bank_sequence",
    instructionLocalizations: {
      pt: "Organize as palavras.",
      en: "Arrange the words.",
    },
    contentLanguage: "en",
    tokens: [
      { id: "token_i", text: "I" },
      { id: "token_am", text: "am" },
      { id: "token_ready", text: "ready" },
    ],
  },
  scoringRule: {
    schemaVersion: 1,
    kind: "word_bank_sequence",
    maxScore: 1,
    correctTokenSequences: [["token_i", "token_am", "token_ready"]],
    tokenGroups: {
      complement: ["token_ready"],
    },
    criteria: [
      {
        id: "subject_before_be",
        type: "relative_order",
        left: ["token_i"],
        right: ["token_am"],
        score: 0.4,
        mistakeCodeOnFail: "grammar.be.wrong_position",
        rationale:
          "The subject should appear before the be form in this statement.",
      },
      {
        id: "be_before_complement",
        type: "token_before_group",
        token: "token_am",
        group: "complement",
        score: 0.4,
        mistakeCodeOnFail: "grammar.be.wrong_position",
        rationale: "The be form should appear before the complement.",
      },
      {
        id: "all_tokens_used",
        type: "all_required_tokens_used",
        score: 0.2,
        mistakeCodeOnFail: "response.incomplete_sequence",
        rationale: "All required tokens should be used.",
      },
    ],
    fallbackMistakeCode: "response.invalid_sequence",
    passingScore: 1,
    evidenceConfidence: 0.79,
  },
  targets: [
    {
      competencyKey: "pre-a1-core-be-present-affirmative",
      role: "primary",
      weight: 100,
    },
  ],
  details: {
    schemaVersion: 1,
    diagnosticRoles: ["repair"],
    rationale: "Checks whether the learner can order a simple be statement.",
    safetyNotes: [],
    localizationNotes: [],
    distractorRationale: {},
    authoringSource: {
      plan: "onboarding-diagnostic-question-plan",
      variant: "repair",
    },
  },
} as const;

describe("diagnostic question contracts", () => {
  it("keeps localized instructions separate from target-language content", () => {
    const parsed = authoredDiagnosticQuestionSchema.parse(
      validFillBlankQuestion,
    );

    expect(parsed.prompt.instructionLocalizations.pt).toBe(
      "Escolha a palavra correta.",
    );
    expect(parsed.prompt.contentLanguage).toBe("en");
    expect(parsed.prompt.kind).toBe("fill_blank_choice");
  });

  it("accepts don't-know as an answered diagnostic response", () => {
    expect(
      diagnosticQuestionResponseSchema.parse({
        schemaVersion: 1,
        kind: "dont_know",
      }),
    ).toEqual({
      schemaVersion: 1,
      kind: "dont_know",
    });
  });

  it("accepts word-bank sequence criteria without criterion-level features", () => {
    const parsed = authoredDiagnosticQuestionSchema.parse(
      validWordBankQuestion,
    );

    if (parsed.scoringRule.kind !== "word_bank_sequence") {
      throw new Error("Expected a word-bank sequence scoring rule.");
    }

    expect(parsed.scoringRule.criteria).toHaveLength(3);
    expect(parsed.scoringRule.criteria?.[0]).not.toHaveProperty("feature");
    expect(parsed.scoringRule.fallbackMistakeCode).toBe(
      "response.invalid_sequence",
    );
  });

  it("rejects word-bank criteria that reference missing token groups", () => {
    expect(
      authoredDiagnosticQuestionSchema.safeParse({
        ...validWordBankQuestion,
        scoringRule: {
          ...validWordBankQuestion.scoringRule,
          tokenGroups: {},
        },
      }).success,
    ).toBe(false);
  });

  it("rejects items whose declared response format does not match the prompt or scoring rule", () => {
    expect(
      authoredDiagnosticQuestionSchema.safeParse({
        ...validFillBlankQuestion,
        responseFormat: "multiple_choice",
      }).success,
    ).toBe(false);
  });

  it("requires exactly one primary target matching the primary competency", () => {
    expect(
      authoredDiagnosticQuestionSchema.safeParse({
        ...validFillBlankQuestion,
        targets: [
          {
            competencyKey: "pre-a1-core-subject-pronouns",
            role: "primary",
            weight: 100,
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      authoredDiagnosticQuestionSchema.safeParse({
        ...validFillBlankQuestion,
        targets: [
          {
            competencyKey: "pre-a1-core-be-present-affirmative",
            role: "supporting",
            weight: 60,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
