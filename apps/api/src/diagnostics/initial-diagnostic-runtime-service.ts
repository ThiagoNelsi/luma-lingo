import type { DiagnosticQuestionResponse } from "@luma-lingo/shared";

import type {
  DiagnosticAttempt,
  DiagnosticAttemptItem,
} from "./diagnostic-attempt.js";
import { DiagnosticAttemptService } from "./diagnostic-attempt-service.js";
import type {
  DiagnosticQuestionBank,
  DiagnosticQuestionBankItem,
} from "./diagnostic-question-bank.js";
import type { DiagnosticQuestionBankRepository } from "./diagnostic-question-bank-repository.js";
import {
  initialDiagnosticScoringPolicy,
  initialDiagnosticScoringPolicyVersion,
  initialDiagnosticSelectionPolicy,
  initialDiagnosticSelectionPolicyVersion,
  toInitialDiagnosticAttemptDetails,
} from "./initial-diagnostic-policy.js";
import {
  type InitialDiagnosticItemSelection,
  selectNextInitialDiagnosticItem,
} from "./initial-diagnostic-selector.js";
import { scoreInitialDiagnosticResponse } from "./initial-diagnostic-scorer.js";

const initialDiagnosticPurpose = "onboarding_initial";

export type InitialDiagnosticRuntimeItem = {
  attemptItemId: string;
  position: number;
  diagnosticItemId: string;
  key: string;
  responseFormat: DiagnosticQuestionBankItem["responseFormat"];
  prompt: DiagnosticQuestionBankItem["prompt"];
};

export type InitialDiagnosticRuntimeResult = {
  attempt: {
    id: string;
    status: DiagnosticAttempt["status"];
    summary?: Record<string, unknown>;
  };
  item: InitialDiagnosticRuntimeItem | null;
};

export class InitialDiagnosticRuntimeService {
  constructor(
    private readonly deps: {
      attempts: DiagnosticAttemptService;
      questionBanks: DiagnosticQuestionBankRepository;
    },
  ) {}

  async startInitialDiagnostic(input: {
    learningTrackId: string;
    targetLanguage: string;
    goals: string[];
  }): Promise<InitialDiagnosticRuntimeResult> {
    const inProgressAttempt = await this.deps.attempts.findInProgressAttempt(
      input.learningTrackId,
      initialDiagnosticPurpose,
    );
    if (!inProgressAttempt) {
      const completedAttempt = await this.deps.attempts.findCompletedAttempt(
        input.learningTrackId,
        initialDiagnosticPurpose,
      );
      if (completedAttempt) {
        return {
          attempt: toRuntimeAttempt(completedAttempt),
          item: null,
        };
      }
    }
    const questionBank = await this.findQuestionBank(input.targetLanguage);
    const attempt = await this.deps.attempts.resumeOrCreateAttempt({
      learningTrackId: input.learningTrackId,
      catalogId: questionBank.catalog.id,
      purpose: initialDiagnosticPurpose,
      selectionPolicyVersion: initialDiagnosticSelectionPolicyVersion,
      scoringPolicyVersion: initialDiagnosticScoringPolicyVersion,
      details: toInitialDiagnosticAttemptDetails({
        selectionPolicy: initialDiagnosticSelectionPolicy,
        scoringPolicy: initialDiagnosticScoringPolicy,
      }),
    });
    const attemptItems = await this.deps.attempts.findAttemptItems(attempt.id);
    const pendingItem = findPendingAttemptItem(attemptItems);
    if (pendingItem) {
      return {
        attempt: toRuntimeAttempt(attempt),
        item: toRuntimeItem({ questionBank, attemptItem: pendingItem }),
      };
    }

    const selection = selectNextInitialDiagnosticItem({
      questionBank,
      attemptItems,
      policy: initialDiagnosticSelectionPolicy,
      goals: input.goals,
    });
    if (!selection) {
      return {
        attempt: toRuntimeAttempt(attempt),
        item: null,
      };
    }

    const attemptItem = await this.recordSelectedItem({
      attempt,
      attemptItems,
      selection,
    });

    return {
      attempt: toRuntimeAttempt(attempt),
      item: toRuntimeItem({ questionBank, attemptItem }),
    };
  }

  async answerInitialDiagnosticItem(input: {
    learningTrackId: string;
    targetLanguage: string;
    goals: string[];
    response: DiagnosticQuestionResponse;
  }): Promise<InitialDiagnosticRuntimeResult> {
    const questionBank = await this.findQuestionBank(input.targetLanguage);
    const attempt = await this.deps.attempts.findInProgressAttempt(
      input.learningTrackId,
      initialDiagnosticPurpose,
    );
    if (!attempt) {
      throw new Error("initial_diagnostic_attempt_not_found");
    }

    const attemptItems = await this.deps.attempts.findAttemptItems(attempt.id);
    const pendingItem = findPendingAttemptItem(attemptItems);
    if (!pendingItem) {
      throw new Error("initial_diagnostic_pending_item_not_found");
    }

    const questionBankItem = findQuestionBankItem({
      questionBank,
      diagnosticItemId: pendingItem.diagnosticItemId,
    });
    const score = scoreInitialDiagnosticResponse({
      item: questionBankItem,
      response: input.response,
      policy: initialDiagnosticScoringPolicy,
    });
    const answeredItem = await this.deps.attempts.answerAttemptItem({
      attemptItemId: pendingItem.id,
      response: input.response as unknown as Record<string, unknown>,
      score: score.score,
      confidence: score.confidence,
      details: score.details,
    });
    const updatedAttemptItems = attemptItems.map((item) =>
      item.id === answeredItem.id ? answeredItem : item,
    );
    const selection = selectNextInitialDiagnosticItem({
      questionBank,
      attemptItems: updatedAttemptItems,
      policy: initialDiagnosticSelectionPolicy,
      goals: input.goals,
    });

    if (!selection) {
      const completedAttempt = await this.deps.attempts.completeAttempt({
        attemptId: attempt.id,
        summary: buildCompletionSummary({
          attemptItems: updatedAttemptItems,
          stopReason:
            updatedAttemptItems.filter((item) => item.answeredAt !== null)
              .length >= initialDiagnosticSelectionPolicy.config.maxItems
              ? "max_items_reached"
              : "question_bank_exhausted",
        }),
      });

      return {
        attempt: toRuntimeAttempt(completedAttempt),
        item: null,
      };
    }

    const nextAttemptItem = await this.recordSelectedItem({
      attempt,
      attemptItems: updatedAttemptItems,
      selection,
    });

    return {
      attempt: toRuntimeAttempt(attempt),
      item: toRuntimeItem({ questionBank, attemptItem: nextAttemptItem }),
    };
  }

  private async findQuestionBank(
    targetLanguage: string,
  ): Promise<DiagnosticQuestionBank> {
    const questionBank =
      await this.deps.questionBanks.findPublishedOnboardingQuestionBank(
        targetLanguage,
      );
    if (!questionBank) {
      throw new Error("initial_diagnostic_question_bank_not_found");
    }

    return questionBank;
  }

  private async recordSelectedItem(input: {
    attempt: DiagnosticAttempt;
    attemptItems: DiagnosticAttemptItem[];
    selection: InitialDiagnosticItemSelection;
  }): Promise<DiagnosticAttemptItem> {
    return this.deps.attempts.recordShownItem({
      attemptId: input.attempt.id,
      diagnosticItemId: input.selection.item.id,
      position: input.attemptItems.length + 1,
      selectedForRole: input.selection.selectedForRole,
      selectionRule: input.selection.selectionRule,
      selectionTrace: input.selection.selectionTrace,
    });
  }
}

function findPendingAttemptItem(
  attemptItems: DiagnosticAttemptItem[],
): DiagnosticAttemptItem | null {
  return attemptItems.find((item) => item.answeredAt === null) ?? null;
}

function toRuntimeAttempt(attempt: DiagnosticAttempt) {
  return {
    id: attempt.id,
    status: attempt.status,
    summary: attempt.summary,
  };
}

function toRuntimeItem(input: {
  questionBank: DiagnosticQuestionBank;
  attemptItem: DiagnosticAttemptItem;
}): InitialDiagnosticRuntimeItem {
  const item = input.questionBank.items.find(
    (candidate) => candidate.id === input.attemptItem.diagnosticItemId,
  );
  if (!item) throw new Error("diagnostic_item_not_found_in_question_bank");

  return {
    attemptItemId: input.attemptItem.id,
    position: input.attemptItem.position,
    diagnosticItemId: item.id,
    key: item.key,
    responseFormat: item.responseFormat,
    prompt: item.prompt,
  };
}

function findQuestionBankItem(input: {
  questionBank: DiagnosticQuestionBank;
  diagnosticItemId: string;
}): DiagnosticQuestionBankItem {
  const item = input.questionBank.items.find(
    (candidate) => candidate.id === input.diagnosticItemId,
  );
  if (!item) throw new Error("diagnostic_item_not_found_in_question_bank");
  return item;
}

function buildCompletionSummary(input: {
  attemptItems: DiagnosticAttemptItem[];
  stopReason: "max_items_reached" | "question_bank_exhausted";
}): Record<string, unknown> {
  const answeredItems = input.attemptItems.filter(
    (item) => item.answeredAt !== null,
  );

  return {
    schemaVersion: 1,
    answeredItemCount: answeredItems.length,
    stopReason: input.stopReason,
  };
}
