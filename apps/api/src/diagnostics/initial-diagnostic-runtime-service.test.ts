import { describe, expect, it } from "vitest";

import type {
  CreateDiagnosticAttemptInput,
  DiagnosticAttempt,
  DiagnosticAttemptAbandonReason,
  DiagnosticAttemptItem,
} from "./diagnostic-attempt.js";
import type { DiagnosticAttemptRepository } from "./diagnostic-attempt-repository.js";
import { DiagnosticAttemptService } from "./diagnostic-attempt-service.js";
import type {
  DiagnosticQuestionBank,
  DiagnosticQuestionBankItem,
} from "./diagnostic-question-bank.js";
import type { DiagnosticQuestionBankRepository } from "./diagnostic-question-bank-repository.js";
import { defaultInitialDiagnosticPolicyConfig } from "./initial-diagnostic-policy.js";
import { InitialDiagnosticRuntimeService } from "./initial-diagnostic-runtime-service.js";

describe("InitialDiagnosticRuntimeService", () => {
  it("starts an initial diagnostic attempt and records the first shown item", async () => {
    const now = new Date("2026-06-28T12:00:00.000Z");
    const attempts = new MemoryDiagnosticAttemptRepository();
    const questionBanks = new MemoryQuestionBankRepository(
      buildQuestionBank([buildQuestionBankItem()]),
    );
    const runtime = new InitialDiagnosticRuntimeService({
      attempts: new DiagnosticAttemptService(attempts, () => now),
      questionBanks,
    });

    const result = await runtime.startInitialDiagnostic({
      learningTrackId: "track-1",
      targetLanguage: "en",
      goals: ["travel"],
    });

    expect(result).toMatchObject({
      attempt: {
        id: "attempt-1",
        status: "in_progress",
      },
      item: {
        attemptItemId: "attempt-item-1",
        position: 1,
        diagnosticItemId: "item-1",
        key: "en.diag.a1.subject-pronouns.001",
        responseFormat: "multiple_choice",
      },
    });
    expect(attempts.attempts[0]?.details).toEqual({
      schemaVersion: 1,
      selectionPolicy: {
        version: "initial-diagnostic-selection-v1",
        config: defaultInitialDiagnosticPolicyConfig,
      },
      scoringPolicy: {
        version: "initial-diagnostic-scoring-v1",
        config: defaultInitialDiagnosticPolicyConfig,
      },
    });
    expect(attempts.items[0]?.shownAt).toEqual(now);
  });

  it("returns an existing unanswered item without recording a duplicate", async () => {
    const now = new Date("2026-06-28T12:00:00.000Z");
    const attempts = new MemoryDiagnosticAttemptRepository();
    const questionBanks = new MemoryQuestionBankRepository(
      buildQuestionBank([buildQuestionBankItem()]),
    );
    const runtime = new InitialDiagnosticRuntimeService({
      attempts: new DiagnosticAttemptService(attempts, () => now),
      questionBanks,
    });
    const attempt = await attempts.createAttempt({
      learningTrackId: "track-1",
      catalogId: "catalog-1",
      purpose: "onboarding_initial",
      selectionPolicyVersion: "initial-diagnostic-selection-v1",
      scoringPolicyVersion: "initial-diagnostic-scoring-v1",
      startedAt: new Date("2026-06-28T11:59:00.000Z"),
      details: {},
    });
    const pendingItem = await attempts.createAttemptItem({
      attemptId: attempt.id,
      diagnosticItemId: "item-1",
      position: 1,
      selectedForRole: "foundation",
      selectionRule: "initial-diagnostic-selection-v1",
      selectionTrace: { schemaVersion: 1 },
      shownAt: new Date("2026-06-28T11:59:30.000Z"),
    });

    const result = await runtime.startInitialDiagnostic({
      learningTrackId: "track-1",
      targetLanguage: "en",
      goals: ["travel"],
    });

    expect(result).toMatchObject({
      attempt: {
        id: attempt.id,
        status: "in_progress",
      },
      item: {
        attemptItemId: pendingItem.id,
        diagnosticItemId: "item-1",
        position: 1,
      },
    });
    expect(attempts.items).toHaveLength(1);
  });

  it("presents, scores, and completes a concept-targeted Q-matrix tracer", async () => {
    const now = new Date("2026-06-28T12:00:00.000Z");
    const attempts = new MemoryDiagnosticAttemptRepository();
    const tracerItem: DiagnosticQuestionBankItem = {
      ...buildQuestionBankItem(),
      primaryCompetencyId: null,
      primaryCompetencyKey: null,
      primaryConceptId: "concept-1",
      primaryConceptKey: "form.synthetic.subject_pronoun",
      primaryCompetency: undefined,
      targets: [],
      evidenceMappings: [
        {
          conceptId: "concept-1",
          conceptKey: "form.synthetic.subject_pronoun",
          capability: "recognition",
          strength: 100,
        },
      ],
    };
    const questionBanks = new MemoryQuestionBankRepository(
      buildQuestionBank([tracerItem]),
    );
    const runtime = new InitialDiagnosticRuntimeService({
      attempts: new DiagnosticAttemptService(attempts, () => now),
      questionBanks,
    });

    await runtime.startInitialDiagnostic({
      learningTrackId: "track-1",
      targetLanguage: "en",
      goals: ["travel"],
    });
    const result = await runtime.answerInitialDiagnosticItem({
      learningTrackId: "track-1",
      targetLanguage: "en",
      goals: ["travel"],
      response: {
        schemaVersion: 1,
        kind: "multiple_choice",
        selectedOptionIds: ["option_she"],
      },
    });

    expect(result).toMatchObject({
      attempt: {
        id: "attempt-1",
        status: "completed",
        summary: {
          schemaVersion: 1,
          answeredItemCount: 1,
          stopReason: "question_bank_exhausted",
        },
      },
      item: null,
    });
    expect(attempts.items[0]).toMatchObject({
      response: {
        kind: "multiple_choice",
        selectedOptionIds: ["option_she"],
      },
      score: 1,
      confidence: 0.8,
      answeredAt: now,
    });
    expect(tracerItem.evidenceMappings).toEqual([
      expect.objectContaining({
        conceptId: "concept-1",
        capability: "recognition",
      }),
    ]);
  });

  it("returns the next item after an answer while keeping the attempt in progress", async () => {
    const now = new Date("2026-06-28T12:00:00.000Z");
    const attempts = new MemoryDiagnosticAttemptRepository();
    const questionBanks = new MemoryQuestionBankRepository(
      buildQuestionBank([
        buildQuestionBankItem({
          id: "item-1",
          key: "en.diag.a1.aaa-subject-pronouns.001",
          primaryCompetencyId: "competency-1",
          primaryCompetencyKey: "en.a1.subject-pronouns",
        }),
        buildQuestionBankItem({
          id: "item-2",
          key: "en.diag.a1.zzz-be-present.001",
          primaryCompetencyId: "competency-2",
          primaryCompetencyKey: "en.a1.be-present",
        }),
      ]),
    );
    const runtime = new InitialDiagnosticRuntimeService({
      attempts: new DiagnosticAttemptService(attempts, () => now),
      questionBanks,
    });

    await runtime.startInitialDiagnostic({
      learningTrackId: "track-1",
      targetLanguage: "en",
      goals: ["travel"],
    });
    const result = await runtime.answerInitialDiagnosticItem({
      learningTrackId: "track-1",
      targetLanguage: "en",
      goals: ["travel"],
      response: {
        schemaVersion: 1,
        kind: "multiple_choice",
        selectedOptionIds: ["option_she"],
      },
    });

    expect(result).toMatchObject({
      attempt: {
        id: "attempt-1",
        status: "in_progress",
        summary: {},
      },
      item: {
        attemptItemId: "attempt-item-2",
        position: 2,
        diagnosticItemId: "item-2",
      },
    });
    expect(attempts.attempts[0]?.summary).toEqual({});
    expect(attempts.items).toHaveLength(2);
  });

  it("completes with max_items_reached after the configured item limit", async () => {
    const now = new Date("2026-06-28T12:00:00.000Z");
    const attempts = new MemoryDiagnosticAttemptRepository();
    const questionBanks = new MemoryQuestionBankRepository(
      buildQuestionBank(
        Array.from({ length: 17 }, (_, index) =>
          buildQuestionBankItem({
            id: `item-${index + 1}`,
            key: `en.diag.a1.item-${String(index + 1).padStart(2, "0")}.001`,
            primaryCompetencyId: `competency-${index + 1}`,
            primaryCompetencyKey: `en.a1.competency-${index + 1}`,
          }),
        ),
      ),
    );
    const runtime = new InitialDiagnosticRuntimeService({
      attempts: new DiagnosticAttemptService(attempts, () => now),
      questionBanks,
    });
    const attempt = await attempts.createAttempt({
      learningTrackId: "track-1",
      catalogId: "catalog-1",
      purpose: "onboarding_initial",
      selectionPolicyVersion: "initial-diagnostic-selection-v1",
      scoringPolicyVersion: "initial-diagnostic-scoring-v1",
      startedAt: new Date("2026-06-28T11:00:00.000Z"),
      details: {},
    });
    for (let position = 1; position <= 15; position += 1) {
      const attemptItem = await attempts.createAttemptItem({
        attemptId: attempt.id,
        diagnosticItemId: `item-${position}`,
        position,
        selectedForRole: "foundation",
        selectionRule: "initial-diagnostic-selection-v1",
        selectionTrace: { schemaVersion: 1 },
        shownAt: new Date("2026-06-28T11:00:00.000Z"),
      });
      await attempts.answerAttemptItem({
        attemptItemId: attemptItem.id,
        response: {
          schemaVersion: 1,
          kind: "multiple_choice",
          selectedOptionIds: ["option_she"],
        },
        score: 1,
        confidence: 0.8,
        answeredAt: new Date("2026-06-28T11:01:00.000Z"),
        details: {
          schemaVersion: 1,
          responseKind: "multiple_choice",
          mistakeCodes: [],
        },
      });
    }
    await attempts.createAttemptItem({
      attemptId: attempt.id,
      diagnosticItemId: "item-16",
      position: 16,
      selectedForRole: "foundation",
      selectionRule: "initial-diagnostic-selection-v1",
      selectionTrace: { schemaVersion: 1 },
      shownAt: new Date("2026-06-28T11:16:00.000Z"),
    });

    const result = await runtime.answerInitialDiagnosticItem({
      learningTrackId: "track-1",
      targetLanguage: "en",
      goals: ["travel"],
      response: {
        schemaVersion: 1,
        kind: "multiple_choice",
        selectedOptionIds: ["option_she"],
      },
    });

    expect(result).toMatchObject({
      attempt: {
        id: "attempt-1",
        status: "completed",
        summary: {
          schemaVersion: 1,
          answeredItemCount: 16,
          stopReason: "max_items_reached",
        },
      },
      item: null,
    });
  });
});

class MemoryQuestionBankRepository implements DiagnosticQuestionBankRepository {
  constructor(private readonly questionBank: DiagnosticQuestionBank | null) {}

  async findPublishedOnboardingQuestionBank() {
    return this.questionBank;
  }
}

class MemoryDiagnosticAttemptRepository implements DiagnosticAttemptRepository {
  attempts: DiagnosticAttempt[] = [];
  items: DiagnosticAttemptItem[] = [];

  async findInProgressAttempt(
    learningTrackId: string,
    purpose: string,
  ): Promise<DiagnosticAttempt | null> {
    return (
      this.attempts.find(
        (attempt) =>
          attempt.learningTrackId === learningTrackId &&
          attempt.purpose === purpose &&
          attempt.status === "in_progress",
      ) ?? null
    );
  }

  async findCompletedAttempt(
    learningTrackId: string,
    purpose: string,
  ): Promise<DiagnosticAttempt | null> {
    return (
      this.attempts.find(
        (attempt) =>
          attempt.learningTrackId === learningTrackId &&
          attempt.purpose === purpose &&
          attempt.status === "completed",
      ) ?? null
    );
  }

  async createAttempt(
    input: CreateDiagnosticAttemptInput,
  ): Promise<DiagnosticAttempt> {
    const attempt: DiagnosticAttempt = {
      id: `attempt-${this.attempts.length + 1}`,
      learningTrackId: input.learningTrackId,
      catalogId: input.catalogId,
      purpose: input.purpose,
      status: "in_progress",
      selectionPolicyVersion: input.selectionPolicyVersion,
      scoringPolicyVersion: input.scoringPolicyVersion,
      startedAt: input.startedAt,
      completedAt: null,
      abandonedAt: null,
      summary: {},
      details: input.details ?? {},
    };
    this.attempts.push(attempt);
    return attempt;
  }

  async findAttemptItems(attemptId: string): Promise<DiagnosticAttemptItem[]> {
    return this.items
      .filter((item) => item.attemptId === attemptId)
      .sort((left, right) => left.position - right.position);
  }

  async abandonAttempt(input: {
    attemptId: string;
    abandonedAt: Date;
    abandonReason: DiagnosticAttemptAbandonReason;
  }): Promise<DiagnosticAttempt> {
    const attempt = this.findAttempt(input.attemptId);
    const updated: DiagnosticAttempt = {
      ...attempt,
      status: "abandoned",
      abandonedAt: input.abandonedAt,
      details: {
        ...attempt.details,
        abandonReason: input.abandonReason,
      },
    };
    this.replaceAttempt(updated);
    return updated;
  }

  async createAttemptItem(input: {
    attemptId: string;
    diagnosticItemId: string;
    position: number;
    selectedForRole: string;
    selectionRule: string;
    selectionTrace: Record<string, unknown>;
    shownAt: Date;
  }): Promise<DiagnosticAttemptItem> {
    const item: DiagnosticAttemptItem = {
      id: `attempt-item-${this.items.length + 1}`,
      attemptId: input.attemptId,
      diagnosticItemId: input.diagnosticItemId,
      position: input.position,
      selectedForRole: input.selectedForRole,
      selectionRule: input.selectionRule,
      selectionTrace: input.selectionTrace,
      response: null,
      score: null,
      confidence: null,
      shownAt: input.shownAt,
      answeredAt: null,
      details: {},
    };
    this.items.push(item);
    return item;
  }

  async answerAttemptItem(input: {
    attemptItemId: string;
    response: Record<string, unknown>;
    score: number;
    confidence: number;
    answeredAt: Date;
    details: Record<string, unknown>;
  }): Promise<DiagnosticAttemptItem> {
    const item = this.items.find(
      (attemptItem) => attemptItem.id === input.attemptItemId,
    );
    if (!item) throw new Error("attempt_item_not_found");

    const updated = {
      ...item,
      response: input.response,
      score: input.score,
      confidence: input.confidence,
      answeredAt: input.answeredAt,
      details: input.details,
    };
    this.items = this.items.map((attemptItem) =>
      attemptItem.id === updated.id ? updated : attemptItem,
    );
    return updated;
  }

  async completeAttempt(input: {
    attemptId: string;
    completedAt: Date;
    summary: Record<string, unknown>;
  }): Promise<DiagnosticAttempt> {
    const attempt = this.findAttempt(input.attemptId);
    const updated: DiagnosticAttempt = {
      ...attempt,
      status: "completed",
      completedAt: input.completedAt,
      summary: input.summary,
    };
    this.replaceAttempt(updated);
    return updated;
  }

  private findAttempt(attemptId: string): DiagnosticAttempt {
    const attempt = this.attempts.find(
      (candidate) => candidate.id === attemptId,
    );
    if (!attempt) throw new Error("attempt_not_found");
    return attempt;
  }

  private replaceAttempt(updated: DiagnosticAttempt): void {
    this.attempts = this.attempts.map((attempt) =>
      attempt.id === updated.id ? updated : attempt,
    );
  }
}

function buildQuestionBank(
  items: DiagnosticQuestionBankItem[],
): DiagnosticQuestionBank {
  return {
    catalog: {
      id: "catalog-1",
      targetLanguage: "en",
      version: "2026.06.en.mvp",
      status: "published",
      publishedAt: new Date("2026-06-28T11:00:00.000Z"),
    },
    items,
  };
}

function buildQuestionBankItem(
  input: {
    id?: string;
    key?: string;
    primaryCompetencyId?: string;
    primaryCompetencyKey?: string;
  } = {},
): DiagnosticQuestionBankItem {
  const id = input.id ?? "item-1";
  const primaryCompetencyId = input.primaryCompetencyId ?? "competency-1";
  const primaryCompetencyKey =
    input.primaryCompetencyKey ?? "en.a1.subject-pronouns";

  return {
    id,
    key: input.key ?? "en.diag.a1.subject-pronouns.001",
    primaryCompetencyId,
    primaryCompetencyKey,
    primaryConceptId: null,
    primaryConceptKey: null,
    mode: "reading",
    primaryCompetency: {
      id: primaryCompetencyId,
      key: primaryCompetencyKey,
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
      isCore: true,
      prerequisites: [],
      goalPriorities: [{ goal: "travel", priority: 60 }],
    },
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
      distractors: {},
    },
    details: {
      schemaVersion: 1,
      diagnosticRoles: ["foundation"],
      rationale: "Checks subject pronouns.",
      safetyNotes: [],
      localizationNotes: [],
      distractorRationale: {},
    },
    reviewedAt: new Date("2026-06-28T10:00:00.000Z"),
    publishedAt: new Date("2026-06-28T11:00:00.000Z"),
    targets: [
      {
        competencyId: primaryCompetencyId,
        competencyKey: primaryCompetencyKey,
        role: "primary",
        weight: 100,
        details: { schemaVersion: 1 },
      },
    ],
    evidenceMappings: [],
  };
}
