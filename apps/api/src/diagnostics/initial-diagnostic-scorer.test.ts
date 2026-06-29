import { describe, expect, it } from "vitest";

import { scoreInitialDiagnosticResponse } from "./initial-diagnostic-scorer.js";
import { initialDiagnosticScoringPolicy } from "./initial-diagnostic-policy.js";
import type { DiagnosticQuestionBankItem } from "./diagnostic-question-bank.js";

describe("scoreInitialDiagnosticResponse", () => {
  it("scores a correct multiple-choice diagnostic response", () => {
    const result = scoreInitialDiagnosticResponse({
      item: buildMultipleChoiceItem(),
      response: {
        schemaVersion: 1,
        kind: "multiple_choice",
        selectedOptionIds: ["option_she"],
      },
      policy: initialDiagnosticScoringPolicy,
    });

    expect(result).toMatchObject({
      score: 1,
      confidence: 0.8,
      isStrongCorrect: true,
      details: {
        schemaVersion: 1,
        responseKind: "multiple_choice",
        mistakeCodes: [],
      },
    });
  });

  it("scores an incorrect multiple-choice diagnostic response with distractor mistake codes", () => {
    const result = scoreInitialDiagnosticResponse({
      item: buildMultipleChoiceItem(),
      response: {
        schemaVersion: 1,
        kind: "multiple_choice",
        selectedOptionIds: ["option_he"],
      },
      policy: initialDiagnosticScoringPolicy,
    });

    expect(result).toMatchObject({
      score: 0,
      confidence: 0.8,
      isStrongCorrect: false,
      details: {
        mistakeCodes: ["grammar.subject.wrong_pronoun"],
      },
    });
  });

  it("scores a correct fill-blank-choice diagnostic response", () => {
    const result = scoreInitialDiagnosticResponse({
      item: buildFillBlankChoiceItem(),
      response: {
        schemaVersion: 1,
        kind: "fill_blank_choice",
        blankId: "blank_1",
        selectedOptionId: "option_is",
      },
      policy: initialDiagnosticScoringPolicy,
    });

    expect(result).toMatchObject({
      score: 1,
      confidence: 0.75,
      isStrongCorrect: true,
      details: {
        responseKind: "fill_blank_choice",
        mistakeCodes: [],
      },
    });
  });

  it("scores an incorrect fill-blank-choice diagnostic response with a distractor mistake code", () => {
    const result = scoreInitialDiagnosticResponse({
      item: buildFillBlankChoiceItem(),
      response: {
        schemaVersion: 1,
        kind: "fill_blank_choice",
        blankId: "blank_1",
        selectedOptionId: "option_are",
      },
      policy: initialDiagnosticScoringPolicy,
    });

    expect(result).toMatchObject({
      score: 0,
      confidence: 0.75,
      isStrongCorrect: false,
      details: {
        responseKind: "fill_blank_choice",
        mistakeCodes: ["grammar.be.wrong_form"],
      },
    });
  });

  it("rejects a response kind that does not match the item response format", () => {
    expect(() =>
      scoreInitialDiagnosticResponse({
        item: buildMultipleChoiceItem(),
        response: {
          schemaVersion: 1,
          kind: "fill_blank_choice",
          blankId: "blank_1",
          selectedOptionId: "option_is",
        },
        policy: initialDiagnosticScoringPolicy,
      }),
    ).toThrow("diagnostic_response_format_mismatch");
  });

  it("scores don't-know as an answered diagnostic response", () => {
    const result = scoreInitialDiagnosticResponse({
      item: buildFillBlankChoiceItem(),
      response: {
        schemaVersion: 1,
        kind: "dont_know",
      },
      policy: initialDiagnosticScoringPolicy,
    });

    expect(result).toMatchObject({
      score: 0,
      confidence: 0.6,
      isStrongCorrect: false,
      details: {
        responseKind: "dont_know",
        mistakeCodes: ["response.dont_know"],
      },
    });
  });

  it("scores an exact word-bank sequence as strong correct", () => {
    const result = scoreInitialDiagnosticResponse({
      item: buildWordBankSequenceItem(),
      response: {
        schemaVersion: 1,
        kind: "word_bank_sequence",
        selectedTokenIds: ["token_she", "token_is", "token_tired"],
      },
      policy: initialDiagnosticScoringPolicy,
    });

    expect(result).toMatchObject({
      score: 1,
      confidence: 0.79,
      isStrongCorrect: true,
      matchedAcceptedTokenSequence: true,
      details: {
        responseKind: "word_bank_sequence",
        mistakeCodes: [],
        matchedAcceptedTokenSequence: true,
      },
    });
  });

  it("scores a partial word-bank sequence without prerequisite-spread eligibility when exact sequence is required", () => {
    const result = scoreInitialDiagnosticResponse({
      item: buildWordBankSequenceItem(),
      response: {
        schemaVersion: 1,
        kind: "word_bank_sequence",
        selectedTokenIds: ["token_is", "token_she", "token_tired"],
      },
      policy: {
        ...initialDiagnosticScoringPolicy,
        config: {
          ...initialDiagnosticScoringPolicy.config,
          strongCorrectMinScore: 0.5,
          strongCorrectMinConfidence: 0.5,
          requireExactWordBankSequenceForSpread: true,
        },
      },
    });

    expect(result).toMatchObject({
      score: 0.6,
      confidence: 0.79,
      isStrongCorrect: false,
      matchedAcceptedTokenSequence: false,
      details: {
        mistakeCodes: ["grammar.be.wrong_position"],
        matchedCriteria: ["is_before_tired", "all_tokens_used"],
        failedCriteria: [
          {
            criterionId: "she_before_is",
            mistakeCode: "grammar.be.wrong_position",
          },
        ],
      },
    });
  });

  it("emits the word-bank fallback mistake code when no criteria match", () => {
    const result = scoreInitialDiagnosticResponse({
      item: {
        ...buildWordBankSequenceItem(),
        scoringRule: {
          schemaVersion: 1,
          kind: "word_bank_sequence",
          maxScore: 1,
          passingScore: 1,
          evidenceConfidence: 0.79,
          correctTokenSequences: [["token_she", "token_is", "token_tired"]],
          tokenGroups: {},
          criteria: [],
          fallbackMistakeCode: "response.invalid_sequence",
        },
      },
      response: {
        schemaVersion: 1,
        kind: "word_bank_sequence",
        selectedTokenIds: ["token_is", "token_she"],
      },
      policy: initialDiagnosticScoringPolicy,
    });

    expect(result).toMatchObject({
      score: 0,
      isStrongCorrect: false,
      details: {
        mistakeCodes: ["response.invalid_sequence"],
        matchedCriteria: [],
        failedCriteria: [],
      },
    });
  });
});

function buildMultipleChoiceItem(): DiagnosticQuestionBankItem {
  return {
    id: "item-1",
    key: "en.diag.a1.subject-pronouns.001",
    primaryCompetencyId: "competency-1",
    primaryCompetencyKey: "en.a1.subject-pronouns",
    difficultyBand: "A1",
    responseFormat: "multiple_choice",
    status: "published",
    prompt: {
      schemaVersion: 1,
      kind: "multiple_choice",
      instructionLocalizations: {
        en: "Choose the best answer.",
      },
      contentLanguage: "en",
      stem: "Maria is a teacher. ___ is from Brazil.",
      options: [
        { id: "option_she", text: "She" },
        { id: "option_he", text: "He" },
      ],
    },
    scoringRule: {
      schemaVersion: 1,
      kind: "multiple_choice",
      maxScore: 1,
      passingScore: 1,
      evidenceConfidence: 0.8,
      correctOptionIds: ["option_she"],
      distractors: {
        option_he: {
          mistakeCode: "grammar.subject.wrong_pronoun",
          rationale: "Selects a masculine pronoun for Maria.",
        },
      },
    },
    details: {
      schemaVersion: 1,
      diagnosticRoles: ["foundation"],
      rationale: "Checks subject pronouns.",
      safetyNotes: [],
      localizationNotes: [],
      distractorRationale: {},
    },
    reviewedAt: new Date("2026-06-28T12:00:00.000Z"),
    publishedAt: new Date("2026-06-28T12:00:00.000Z"),
    targets: [
      {
        competencyId: "competency-1",
        competencyKey: "en.a1.subject-pronouns",
        role: "primary",
        weight: 100,
        details: { schemaVersion: 1 },
      },
    ],
  };
}

function buildFillBlankChoiceItem(): DiagnosticQuestionBankItem {
  return {
    id: "item-2",
    key: "en.diag.a1.be-present.001",
    primaryCompetencyId: "competency-2",
    primaryCompetencyKey: "en.a1.be-present",
    difficultyBand: "A1",
    responseFormat: "fill_blank_choice",
    status: "published",
    prompt: {
      schemaVersion: 1,
      kind: "fill_blank_choice",
      instructionLocalizations: {
        en: "Choose the best answer.",
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
      passingScore: 1,
      evidenceConfidence: 0.75,
      blankId: "blank_1",
      correctOptionIds: ["option_is"],
      distractors: {
        option_are: {
          mistakeCode: "grammar.be.wrong_form",
          rationale: "Uses a non-matching be form.",
        },
      },
    },
    details: {
      schemaVersion: 1,
      diagnosticRoles: ["foundation"],
      rationale: "Checks be present forms.",
      safetyNotes: [],
      localizationNotes: [],
      distractorRationale: {},
    },
    reviewedAt: new Date("2026-06-28T12:00:00.000Z"),
    publishedAt: new Date("2026-06-28T12:00:00.000Z"),
    targets: [
      {
        competencyId: "competency-2",
        competencyKey: "en.a1.be-present",
        role: "primary",
        weight: 100,
        details: { schemaVersion: 1 },
      },
    ],
  };
}

function buildWordBankSequenceItem(): DiagnosticQuestionBankItem {
  return {
    id: "item-3",
    key: "en.diag.a1.be-present.sequence.001",
    primaryCompetencyId: "competency-2",
    primaryCompetencyKey: "en.a1.be-present",
    difficultyBand: "A1",
    responseFormat: "word_bank_sequence",
    status: "published",
    prompt: {
      schemaVersion: 1,
      kind: "word_bank_sequence",
      instructionLocalizations: {
        en: "Arrange the words.",
      },
      contentLanguage: "en",
      tokens: [
        { id: "token_she", text: "She" },
        { id: "token_is", text: "is" },
        { id: "token_tired", text: "tired" },
      ],
    },
    scoringRule: {
      schemaVersion: 1,
      kind: "word_bank_sequence",
      maxScore: 1,
      passingScore: 1,
      evidenceConfidence: 0.79,
      correctTokenSequences: [["token_she", "token_is", "token_tired"]],
      tokenGroups: {},
      criteria: [
        {
          id: "she_before_is",
          type: "relative_order",
          left: ["token_she"],
          right: ["token_is"],
          score: 0.4,
          mistakeCodeOnFail: "grammar.be.wrong_position",
          rationale: "The subject appears before the be form.",
        },
        {
          id: "is_before_tired",
          type: "relative_order",
          left: ["token_is"],
          right: ["token_tired"],
          score: 0.4,
          mistakeCodeOnFail: "grammar.be.wrong_position",
          rationale: "The be form appears before the complement.",
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
    },
    details: {
      schemaVersion: 1,
      diagnosticRoles: ["foundation"],
      rationale: "Checks be statement ordering.",
      safetyNotes: [],
      localizationNotes: [],
      distractorRationale: {},
    },
    reviewedAt: new Date("2026-06-28T12:00:00.000Z"),
    publishedAt: new Date("2026-06-28T12:00:00.000Z"),
    targets: [
      {
        competencyId: "competency-2",
        competencyKey: "en.a1.be-present",
        role: "primary",
        weight: 100,
        details: { schemaVersion: 1 },
      },
    ],
  };
}
