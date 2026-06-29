import { diagnosticQuestionResponseSchema } from "@luma-lingo/shared";
import type {
  DiagnosticQuestionResponse,
  WordBankSequenceCriterion,
} from "@luma-lingo/shared";

import type { DiagnosticQuestionBankItem } from "./diagnostic-question-bank.js";
import type { InitialDiagnosticScoringPolicy } from "./initial-diagnostic-policy.js";

export type InitialDiagnosticScoreDetails = Record<string, unknown> & {
  schemaVersion: 1;
  responseKind: DiagnosticQuestionResponse["kind"];
  mistakeCodes: string[];
};

export interface InitialDiagnosticScoreResult {
  score: number;
  confidence: number;
  isStrongCorrect: boolean;
  matchedAcceptedTokenSequence: boolean;
  details: InitialDiagnosticScoreDetails;
}

export function scoreInitialDiagnosticResponse(input: {
  item: DiagnosticQuestionBankItem;
  response: DiagnosticQuestionResponse;
  policy: InitialDiagnosticScoringPolicy;
}): InitialDiagnosticScoreResult {
  const response = diagnosticQuestionResponseSchema.parse(input.response);

  if (
    response.kind !== "dont_know" &&
    response.kind !== input.item.responseFormat
  ) {
    throw new Error("diagnostic_response_format_mismatch");
  }

  if (response.kind === "dont_know") {
    return buildResult({
      responseKind: response.kind,
      score: 0,
      confidence: 0.6,
      mistakeCodes: ["response.dont_know"],
      matchedAcceptedTokenSequence: false,
      policy: input.policy,
    });
  }

  if (
    response.kind === "multiple_choice" &&
    input.item.scoringRule.kind === "multiple_choice"
  ) {
    const scoringRule = input.item.scoringRule;
    const isCorrect = sameStringSet(
      response.selectedOptionIds,
      scoringRule.correctOptionIds,
    );
    const mistakeCodes = isCorrect
      ? []
      : response.selectedOptionIds.flatMap((optionId) => {
          const distractor = scoringRule.distractors[optionId];
          return distractor ? [distractor.mistakeCode] : [];
        });

    return buildResult({
      responseKind: response.kind,
      score: isCorrect ? 1 : 0,
      confidence: scoringRule.evidenceConfidence,
      mistakeCodes,
      matchedAcceptedTokenSequence: false,
      policy: input.policy,
    });
  }

  if (
    response.kind === "fill_blank_choice" &&
    input.item.scoringRule.kind === "fill_blank_choice"
  ) {
    const scoringRule = input.item.scoringRule;
    if (response.blankId !== scoringRule.blankId) {
      throw new Error("diagnostic_response_blank_mismatch");
    }

    const isCorrect = scoringRule.correctOptionIds.includes(
      response.selectedOptionId,
    );
    const distractor = scoringRule.distractors[response.selectedOptionId];

    return buildResult({
      responseKind: response.kind,
      score: isCorrect ? 1 : 0,
      confidence: scoringRule.evidenceConfidence,
      mistakeCodes: isCorrect || !distractor ? [] : [distractor.mistakeCode],
      matchedAcceptedTokenSequence: false,
      policy: input.policy,
    });
  }

  if (
    response.kind === "word_bank_sequence" &&
    input.item.scoringRule.kind === "word_bank_sequence"
  ) {
    const matchedAcceptedTokenSequence =
      input.item.scoringRule.correctTokenSequences.some((acceptedSequence) =>
        sameStringArray(response.selectedTokenIds, acceptedSequence),
      );
    const wordBankScore = matchedAcceptedTokenSequence
      ? {
          score: 1,
          mistakeCodes: [] as string[],
          matchedCriteria: [] as string[],
          failedCriteria: [] as FailedCriterionDetails[],
        }
      : scoreWordBankCriteria({
          item: input.item,
          selectedTokenIds: response.selectedTokenIds,
        });

    return buildResult({
      responseKind: response.kind,
      score: wordBankScore.score,
      confidence: input.item.scoringRule.evidenceConfidence,
      mistakeCodes: wordBankScore.mistakeCodes,
      matchedAcceptedTokenSequence,
      policy: input.policy,
      extraDetails: {
        matchedCriteria: wordBankScore.matchedCriteria,
        failedCriteria: wordBankScore.failedCriteria,
      },
    });
  }

  throw new Error("unsupported_diagnostic_response_format");
}

function buildResult(input: {
  responseKind: DiagnosticQuestionResponse["kind"];
  score: number;
  confidence: number;
  mistakeCodes: string[];
  matchedAcceptedTokenSequence: boolean;
  policy: InitialDiagnosticScoringPolicy;
  extraDetails?: Record<string, unknown>;
}): InitialDiagnosticScoreResult {
  const score = clamp01(input.score);
  const confidence = clamp01(input.confidence);
  const isWordBankSequence = input.responseKind === "word_bank_sequence";
  const canSpreadWordBankSequence =
    !isWordBankSequence ||
    !input.policy.config.requireExactWordBankSequenceForSpread ||
    input.matchedAcceptedTokenSequence;
  const isStrongCorrect =
    score >= input.policy.config.strongCorrectMinScore &&
    confidence >= input.policy.config.strongCorrectMinConfidence &&
    input.responseKind !== "dont_know" &&
    canSpreadWordBankSequence;

  return {
    score,
    confidence,
    isStrongCorrect,
    matchedAcceptedTokenSequence: input.matchedAcceptedTokenSequence,
    details: {
      schemaVersion: 1,
      responseKind: input.responseKind,
      mistakeCodes: unique(input.mistakeCodes),
      matchedAcceptedTokenSequence: input.matchedAcceptedTokenSequence,
      scoringPolicyVersion: input.policy.version,
      ...input.extraDetails,
    },
  };
}

type FailedCriterionDetails = {
  criterionId: string;
  mistakeCode: string;
  rationale?: string;
};

function scoreWordBankCriteria(input: {
  item: DiagnosticQuestionBankItem;
  selectedTokenIds: string[];
}) {
  if (
    input.item.prompt.kind !== "word_bank_sequence" ||
    input.item.scoringRule.kind !== "word_bank_sequence"
  ) {
    throw new Error("diagnostic_word_bank_item_mismatch");
  }

  const promptTokenIds = input.item.prompt.tokens.map((token) => token.id);
  const matchedCriteria: string[] = [];
  const failedCriteria: FailedCriterionDetails[] = [];
  let score = 0;

  for (const criterion of input.item.scoringRule.criteria ?? []) {
    if (
      evaluateWordBankCriterion({
        criterion,
        selectedTokenIds: input.selectedTokenIds,
        promptTokenIds,
        tokenGroups: input.item.scoringRule.tokenGroups,
      })
    ) {
      matchedCriteria.push(criterion.id);
      score += criterion.score;
    } else {
      failedCriteria.push({
        criterionId: criterion.id,
        mistakeCode: criterion.mistakeCodeOnFail,
        rationale: criterion.rationale,
      });
    }
  }

  const mistakeCodes = failedCriteria.map((criterion) => criterion.mistakeCode);
  if (
    mistakeCodes.length === 0 &&
    matchedCriteria.length === 0 &&
    input.item.scoringRule.fallbackMistakeCode
  ) {
    mistakeCodes.push(input.item.scoringRule.fallbackMistakeCode);
  }

  return {
    score: clamp01(score),
    mistakeCodes,
    matchedCriteria,
    failedCriteria,
  };
}

function evaluateWordBankCriterion(input: {
  criterion: WordBankSequenceCriterion;
  selectedTokenIds: string[];
  promptTokenIds: string[];
  tokenGroups: Record<string, string[]>;
}): boolean {
  switch (input.criterion.type) {
    case "all_required_tokens_used": {
      const requiredTokens =
        input.criterion.requiredTokens ?? input.promptTokenIds;
      return requiredTokens.every((tokenId) =>
        input.selectedTokenIds.includes(tokenId),
      );
    }
    case "no_extra_tokens": {
      const allowedTokens =
        input.criterion.allowedTokens ?? input.promptTokenIds;
      return input.selectedTokenIds.every((tokenId) =>
        allowedTokens.includes(tokenId),
      );
    }
    case "relative_order": {
      const leftPositions = positionsOf(
        input.selectedTokenIds,
        input.criterion.left,
      );
      const rightPositions = positionsOf(
        input.selectedTokenIds,
        input.criterion.right,
      );
      if (
        leftPositions.length !== input.criterion.left.length ||
        rightPositions.length !== input.criterion.right.length
      ) {
        return false;
      }

      return Math.max(...leftPositions) < Math.min(...rightPositions);
    }
    case "adjacency":
      return containsContiguousSequence(
        input.selectedTokenIds,
        input.criterion.tokens,
      );
    case "token_at_position":
      return (
        input.selectedTokenIds[input.criterion.position - 1] ===
        input.criterion.token
      );
    case "token_before_group":
      return tokenIsBeforeGroup({
        selectedTokenIds: input.selectedTokenIds,
        token: input.criterion.token,
        groupTokens: input.tokenGroups[input.criterion.group] ?? [],
      });
    case "token_after_group":
      return tokenIsAfterGroup({
        selectedTokenIds: input.selectedTokenIds,
        token: input.criterion.token,
        groupTokens: input.tokenGroups[input.criterion.group] ?? [],
      });
  }
}

function positionsOf(selectedTokenIds: string[], tokenIds: string[]): number[] {
  return tokenIds
    .map((tokenId) => selectedTokenIds.indexOf(tokenId))
    .filter((position) => position >= 0);
}

function containsContiguousSequence(
  selectedTokenIds: string[],
  expectedTokenIds: string[],
): boolean {
  return selectedTokenIds.some((_, startIndex) =>
    expectedTokenIds.every(
      (tokenId, offset) => selectedTokenIds[startIndex + offset] === tokenId,
    ),
  );
}

function tokenIsBeforeGroup(input: {
  selectedTokenIds: string[];
  token: string;
  groupTokens: string[];
}): boolean {
  const tokenPosition = input.selectedTokenIds.indexOf(input.token);
  const groupPositions = positionsOf(input.selectedTokenIds, input.groupTokens);

  return tokenPosition >= 0 && groupPositions.length > 0
    ? tokenPosition < Math.min(...groupPositions)
    : false;
}

function tokenIsAfterGroup(input: {
  selectedTokenIds: string[];
  token: string;
  groupTokens: string[];
}): boolean {
  const tokenPosition = input.selectedTokenIds.indexOf(input.token);
  const groupPositions = positionsOf(input.selectedTokenIds, input.groupTokens);

  return tokenPosition >= 0 && groupPositions.length > 0
    ? tokenPosition > Math.max(...groupPositions)
    : false;
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;

  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function sameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;

  return left.every((value, index) => value === right[index]);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function clamp01(value: number): number {
  const clampedValue = Math.min(1, Math.max(0, value));
  return Math.round(clampedValue * 1_000_000) / 1_000_000;
}
