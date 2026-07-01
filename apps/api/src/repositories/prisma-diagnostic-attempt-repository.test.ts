import { describe, expect, it, vi } from "vitest";

import {
  diagnosticEvidenceDetailsSchemaVersion,
  learnerCompetencyStateDetailsSchemaVersion,
} from "../diagnostics/diagnostic-attempt.js";
import { PrismaDiagnosticAttemptRepository } from "./prisma-diagnostic-attempt-repository.js";

describe("PrismaDiagnosticAttemptRepository", () => {
  it("creates a diagnostic attempt with first-class purpose and policy versions", async () => {
    const startedAt = new Date("2026-06-27T12:00:00.000Z");
    const details = {
      schemaVersion: 1,
      selectionPolicy: {
        version: "initial-diagnostic-selection-v1",
      },
      scoringPolicy: {
        version: "initial-diagnostic-scoring-v1",
      },
    };
    const diagnosticAttempt = {
      create: vi.fn(async ({ data }: { data: { id: string } }) => ({
        id: data.id,
        learningTrackId: "track-1",
        catalogId: "catalog-1",
        purpose: "onboarding_initial",
        status: "in_progress",
        selectionPolicyVersion: "initial-diagnostic-selection-v1",
        scoringPolicyVersion: "initial-diagnostic-scoring-v1",
        startedAt,
        completedAt: null,
        abandonedAt: null,
        summary: {},
        details,
      })),
    };
    const repository = new PrismaDiagnosticAttemptRepository({
      diagnosticAttempt,
    } as never);

    await expect(
      repository.createAttempt({
        learningTrackId: "track-1",
        catalogId: "catalog-1",
        purpose: "onboarding_initial",
        selectionPolicyVersion: "initial-diagnostic-selection-v1",
        scoringPolicyVersion: "initial-diagnostic-scoring-v1",
        startedAt,
        details,
      }),
    ).resolves.toMatchObject({
      learningTrackId: "track-1",
      purpose: "onboarding_initial",
      status: "in_progress",
      details,
    });
    expect(diagnosticAttempt.create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        learningTrackId: "track-1",
        catalogId: "catalog-1",
        purpose: "onboarding_initial",
        status: "in_progress",
        selectionPolicyVersion: "initial-diagnostic-selection-v1",
        scoringPolicyVersion: "initial-diagnostic-scoring-v1",
        startedAt,
        summary: {},
        details,
      },
    });
  });

  it("finds and abandons an in-progress diagnostic attempt", async () => {
    const abandonedAt = new Date("2026-06-29T12:00:01.000Z");
    const row = {
      id: "attempt-1",
      learningTrackId: "track-1",
      catalogId: "catalog-1",
      purpose: "onboarding_initial",
      status: "in_progress",
      selectionPolicyVersion: "initial-diagnostic-selection-v1",
      scoringPolicyVersion: "initial-diagnostic-scoring-v1",
      startedAt: new Date("2026-06-27T12:00:00.000Z"),
      completedAt: null,
      abandonedAt: null,
      summary: {},
      details: {},
    };
    const diagnosticAttempt = {
      findFirst: vi.fn(async () => row),
      update: vi.fn(async () => ({
        ...row,
        status: "abandoned",
        abandonedAt,
        details: {
          abandonReason: "resume_window_expired",
        },
      })),
    };
    const repository = new PrismaDiagnosticAttemptRepository({
      diagnosticAttempt,
    } as never);

    await expect(
      repository.findInProgressAttempt("track-1", "onboarding_initial"),
    ).resolves.toMatchObject({
      id: "attempt-1",
      status: "in_progress",
    });
    await expect(
      repository.abandonAttempt({
        attemptId: "attempt-1",
        abandonedAt,
        abandonReason: "resume_window_expired",
      }),
    ).resolves.toMatchObject({
      id: "attempt-1",
      status: "abandoned",
      abandonedAt,
    });
    expect(diagnosticAttempt.findFirst).toHaveBeenCalledWith({
      where: {
        learningTrackId: "track-1",
        purpose: "onboarding_initial",
        status: "in_progress",
      },
      orderBy: {
        startedAt: "desc",
      },
    });
    expect(diagnosticAttempt.update).toHaveBeenCalledWith({
      where: {
        id: "attempt-1",
      },
      data: {
        status: "abandoned",
        abandonedAt,
        details: {
          abandonReason: "resume_window_expired",
        },
      },
    });
  });

  it("finds the latest completed diagnostic attempt for onboarding completion", async () => {
    const row = {
      id: "attempt-1",
      learningTrackId: "track-1",
      catalogId: "catalog-1",
      purpose: "onboarding_initial",
      status: "completed",
      selectionPolicyVersion: "initial-diagnostic-selection-v1",
      scoringPolicyVersion: "initial-diagnostic-scoring-v1",
      startedAt: new Date("2026-06-27T12:00:00.000Z"),
      completedAt: new Date("2026-06-27T12:08:00.000Z"),
      abandonedAt: null,
      summary: {
        schemaVersion: 1,
        answeredItemCount: 8,
      },
      details: {},
    };
    const diagnosticAttempt = {
      findFirst: vi.fn(async () => row),
    };
    const repository = new PrismaDiagnosticAttemptRepository({
      diagnosticAttempt,
    } as never);

    await expect(
      repository.findCompletedAttempt("track-1", "onboarding_initial"),
    ).resolves.toMatchObject({
      id: "attempt-1",
      status: "completed",
      catalogId: "catalog-1",
    });
    expect(diagnosticAttempt.findFirst).toHaveBeenCalledWith({
      where: {
        learningTrackId: "track-1",
        purpose: "onboarding_initial",
        status: "completed",
      },
      orderBy: {
        completedAt: "desc",
      },
    });
  });

  it("creates shown attempt items and updates them when answered", async () => {
    const shownAt = new Date("2026-06-27T12:10:00.000Z");
    const answeredAt = new Date("2026-06-27T12:10:12.000Z");
    const row = {
      id: "attempt-item-1",
      attemptId: "attempt-1",
      diagnosticItemId: "item-1",
      position: 1,
      selectedForRole: "foundation_probe",
      selectionRule: "first-foundation-probe",
      selectionTrace: {
        schemaVersion: 1,
      },
      response: null,
      score: null,
      confidence: null,
      shownAt,
      answeredAt: null,
      details: {},
    };
    const diagnosticAttemptItem = {
      create: vi.fn(async ({ data }: { data: { id: string } }) => ({
        ...row,
        id: data.id,
      })),
      update: vi.fn(async () => ({
        ...row,
        response: {
          kind: "dont_know",
        },
        score: 0,
        confidence: 0.65,
        answeredAt,
        details: {
          responseKind: "dont_know",
        },
      })),
    };
    const repository = new PrismaDiagnosticAttemptRepository({
      diagnosticAttemptItem,
    } as never);

    await expect(
      repository.createAttemptItem({
        attemptId: "attempt-1",
        diagnosticItemId: "item-1",
        position: 1,
        selectedForRole: "foundation_probe",
        selectionRule: "first-foundation-probe",
        selectionTrace: {
          schemaVersion: 1,
        },
        shownAt,
      }),
    ).resolves.toMatchObject({
      attemptId: "attempt-1",
      diagnosticItemId: "item-1",
      response: null,
      answeredAt: null,
    });
    await expect(
      repository.answerAttemptItem({
        attemptItemId: "attempt-item-1",
        response: {
          kind: "dont_know",
        },
        score: 0,
        confidence: 0.65,
        answeredAt,
        details: {
          responseKind: "dont_know",
        },
      }),
    ).resolves.toMatchObject({
      response: {
        kind: "dont_know",
      },
      score: 0,
      confidence: 0.65,
      answeredAt,
    });
    expect(diagnosticAttemptItem.create).toHaveBeenCalledWith({
      data: {
        id: expect.any(String),
        attemptId: "attempt-1",
        diagnosticItemId: "item-1",
        position: 1,
        selectedForRole: "foundation_probe",
        selectionRule: "first-foundation-probe",
        selectionTrace: {
          schemaVersion: 1,
        },
        shownAt,
        details: {},
      },
    });
    expect(diagnosticAttemptItem.update).toHaveBeenCalledWith({
      where: {
        id: "attempt-item-1",
      },
      data: {
        response: {
          kind: "dont_know",
        },
        score: 0,
        confidence: 0.65,
        answeredAt,
        details: {
          responseKind: "dont_know",
        },
      },
    });
  });

  it("lists attempt items in position order", async () => {
    const shownAt = new Date("2026-06-27T12:10:00.000Z");
    const diagnosticAttemptItem = {
      findMany: vi.fn(async () => [
        {
          id: "attempt-item-1",
          attemptId: "attempt-1",
          diagnosticItemId: "item-1",
          position: 1,
          selectedForRole: "foundation",
          selectionRule: "initial-diagnostic-selection-v1",
          selectionTrace: {
            schemaVersion: 1,
          },
          response: null,
          score: null,
          confidence: null,
          shownAt,
          answeredAt: null,
          details: {},
        },
      ]),
    };
    const repository = new PrismaDiagnosticAttemptRepository({
      diagnosticAttemptItem,
    } as never);

    await expect(repository.findAttemptItems("attempt-1")).resolves.toEqual([
      expect.objectContaining({
        id: "attempt-item-1",
        position: 1,
        answeredAt: null,
      }),
    ]);
    expect(diagnosticAttemptItem.findMany).toHaveBeenCalledWith({
      where: {
        attemptId: "attempt-1",
      },
      orderBy: {
        position: "asc",
      },
    });
  });

  it("completes an attempt and publishes evidence from answered attempt items", async () => {
    const completedAt = new Date("2026-06-27T12:12:00.000Z");
    const answeredAt = new Date("2026-06-27T12:10:12.000Z");
    const summary = {
      schemaVersion: 1,
      answeredItemCount: 1,
      stopReason: "max_items_reached",
    };
    const completedAttempt = {
      id: "attempt-1",
      learningTrackId: "track-1",
      catalogId: "catalog-1",
      purpose: "onboarding_initial",
      status: "completed",
      selectionPolicyVersion: "initial-diagnostic-selection-v1",
      scoringPolicyVersion: "initial-diagnostic-scoring-v1",
      startedAt: new Date("2026-06-27T12:00:00.000Z"),
      completedAt,
      abandonedAt: null,
      summary,
      details: {},
      items: [
        {
          id: "attempt-item-1",
          diagnosticItemId: "item-1",
          score: 0.95,
          confidence: 0.8,
          answeredAt,
          diagnosticItem: {
            primaryCompetencyId: "competency-1",
            primaryCompetency: {
              id: "competency-1",
              prerequisites: [
                {
                  strength: 90,
                  prerequisite: {
                    id: "competency-0",
                    prerequisites: [],
                  },
                },
              ],
            },
            competencyTargets: [
              {
                competencyId: "competency-1",
                role: "primary",
                weight: 100,
              },
              {
                competencyId: "competency-2",
                role: "supporting",
                weight: 50,
              },
            ],
          },
        },
      ],
    };
    const tx = {
      diagnosticAttempt: {
        update: vi.fn(async () => completedAttempt),
      },
      competencyEvidence: {
        createMany: vi.fn(async () => ({ count: 3 })),
      },
      learnerCompetencyState: {
        upsert: vi.fn(async () => ({})),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const repository = new PrismaDiagnosticAttemptRepository(prisma as never);

    await expect(
      repository.completeAttempt({
        attemptId: "attempt-1",
        completedAt,
        summary,
      }),
    ).resolves.toMatchObject({
      id: "attempt-1",
      status: "completed",
      completedAt,
      summary,
    });
    expect(tx.diagnosticAttempt.update).toHaveBeenCalledWith({
      where: {
        id: "attempt-1",
      },
      data: {
        status: "completed",
        completedAt,
        summary,
      },
      include: {
        items: {
          where: {
            answeredAt: {
              not: null,
            },
            score: {
              not: null,
            },
            confidence: {
              not: null,
            },
          },
          include: {
            diagnosticItem: {
              include: {
                competencyTargets: true,
                primaryCompetency: {
                  include: {
                    prerequisites: {
                      include: {
                        prerequisite: {
                          include: {
                            prerequisites: {
                              include: {
                                prerequisite: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    expect(tx.competencyEvidence.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: expect.any(String),
          learningTrackId: "track-1",
          competencyId: "competency-1",
          sourceType: "initial_diagnostic",
          sourceId: "attempt-item-1",
          observedAt: answeredAt,
          score: 0.95,
          confidence: 0.8,
          details: {
            schemaVersion: diagnosticEvidenceDetailsSchemaVersion,
            attemptId: "attempt-1",
            diagnosticItemId: "item-1",
            targetRole: "primary",
            targetWeight: 100,
            scoringPolicyVersion: "initial-diagnostic-scoring-v1",
          },
        },
        {
          id: expect.any(String),
          learningTrackId: "track-1",
          competencyId: "competency-2",
          sourceType: "initial_diagnostic",
          sourceId: "attempt-item-1",
          observedAt: answeredAt,
          score: 0.95,
          confidence: 0.4,
          details: {
            schemaVersion: diagnosticEvidenceDetailsSchemaVersion,
            attemptId: "attempt-1",
            diagnosticItemId: "item-1",
            targetRole: "supporting",
            targetWeight: 50,
            scoringPolicyVersion: "initial-diagnostic-scoring-v1",
          },
        },
        {
          id: expect.any(String),
          learningTrackId: "track-1",
          competencyId: "competency-0",
          sourceType: "initial_diagnostic_prerequisite_inference",
          sourceId: "attempt-item-1",
          observedAt: answeredAt,
          score: 0.85,
          confidence: 0.6,
          details: {
            schemaVersion: diagnosticEvidenceDetailsSchemaVersion,
            attemptId: "attempt-1",
            sourceAttemptItemId: "attempt-item-1",
            sourceDiagnosticItemId: "item-1",
            sourceCompetencyId: "competency-1",
            inferredCompetencyId: "competency-0",
            inferenceReason: "correct_higher_band_item",
            prerequisiteDepth: 1,
            prerequisiteStrength: 90,
            scoringPolicyVersion: "initial-diagnostic-scoring-v1",
          },
        },
      ],
    });
    expect(tx.learnerCompetencyState.upsert).toHaveBeenCalledTimes(3);
    expect(tx.learnerCompetencyState.upsert).toHaveBeenCalledWith({
      where: {
        learningTrackId_competencyId: {
          learningTrackId: "track-1",
          competencyId: "competency-1",
        },
      },
      create: {
        id: expect.any(String),
        learningTrackId: "track-1",
        competencyId: "competency-1",
        abilityEstimate: 0.95,
        confidence: 0.8,
        evidenceCount: 1,
        lastEvidenceAt: answeredAt,
        details: {
          schemaVersion: learnerCompetencyStateDetailsSchemaVersion,
          lastUpdateReason: "initial_diagnostic",
          scoringPolicyVersion: "initial-diagnostic-scoring-v1",
        },
      },
      update: {
        abilityEstimate: 0.95,
        confidence: 0.8,
        evidenceCount: {
          increment: 1,
        },
        lastEvidenceAt: answeredAt,
        details: {
          schemaVersion: learnerCompetencyStateDetailsSchemaVersion,
          lastUpdateReason: "initial_diagnostic",
          scoringPolicyVersion: "initial-diagnostic-scoring-v1",
        },
      },
    });
  });

  it.each([
    [
      "an incorrect higher-band answer",
      {
        score: 0,
        confidence: 0.8,
        itemDetails: {
          schemaVersion: 1,
          responseKind: "multiple_choice",
          mistakeCodes: ["grammar.be.wrong_form"],
        },
      },
    ],
    [
      "dont_know",
      {
        score: 0,
        confidence: 0.6,
        itemDetails: {
          schemaVersion: 1,
          responseKind: "dont_know",
          mistakeCodes: ["response.dont_know"],
        },
      },
    ],
    [
      "a correct answer below the strong confidence threshold",
      {
        score: 1,
        confidence: 0.6,
        itemDetails: {
          schemaVersion: 1,
          responseKind: "multiple_choice",
          mistakeCodes: [],
        },
      },
    ],
    [
      "a partial word-bank answer when exact sequence is required",
      {
        score: 0.95,
        confidence: 0.8,
        itemDetails: {
          schemaVersion: 1,
          responseKind: "word_bank_sequence",
          mistakeCodes: ["grammar.be.wrong_position"],
          matchedAcceptedTokenSequence: false,
        },
      },
    ],
  ])(
    "does not publish prerequisite inference for %s",
    async (_caseName, input) => {
      const completedAt = new Date("2026-06-27T12:12:00.000Z");
      const completedAttempt = buildCompletedAttemptWithPrerequisites(input);
      const { repository, tx } = buildCompletionHarness(completedAttempt);

      await repository.completeAttempt({
        attemptId: "attempt-1",
        completedAt,
        summary: {
          schemaVersion: 1,
          answeredItemCount: 1,
          stopReason: "question_bank_exhausted",
        },
      });

      const evidenceRows = createdEvidenceRows(tx);
      expect(evidenceRows).toEqual([
        expect.objectContaining({
          competencyId: "competency-primary",
          sourceType: "initial_diagnostic",
        }),
      ]);
    },
  );

  it("respects prerequisite spread depth and lowers inferred certainty by depth", async () => {
    const completedAt = new Date("2026-06-27T12:12:00.000Z");
    const completedAttempt = buildCompletedAttemptWithPrerequisites({
      includeDepth2Prerequisite: true,
      includeDepth3Prerequisite: true,
    });
    const { repository, tx } = buildCompletionHarness(completedAttempt);

    await repository.completeAttempt({
      attemptId: "attempt-1",
      completedAt,
      summary: {
        schemaVersion: 1,
        answeredItemCount: 1,
        stopReason: "question_bank_exhausted",
      },
    });

    const evidenceRows = createdEvidenceRows(tx);
    const inferenceRows = evidenceRows.filter(
      (row) => row.sourceType === "initial_diagnostic_prerequisite_inference",
    );
    const depth1 = inferenceRows.find(
      (row) => row.details.prerequisiteDepth === 1,
    );
    const depth2 = inferenceRows.find(
      (row) => row.details.prerequisiteDepth === 2,
    );

    expect(inferenceRows).toHaveLength(2);
    expect(depth1).toBeDefined();
    expect(depth2).toBeDefined();
    if (!depth1 || !depth2) {
      throw new Error("expected_depth_1_and_depth_2_inference_rows");
    }
    expect(depth1).toMatchObject({
      competencyId: "competency-depth-1",
      score: 0.85,
      confidence: 0.6,
      details: {
        prerequisiteDepth: 1,
        prerequisiteStrength: 90,
      },
    });
    expect(depth2).toMatchObject({
      competencyId: "competency-depth-2",
      score: 0.75,
      confidence: 0.5,
      details: {
        prerequisiteDepth: 2,
        prerequisiteStrength: 80,
      },
    });
    expect(depth2.score).toBeLessThan(depth1.score);
    expect(depth2.confidence).toBeLessThan(depth1.confidence);
    expect(evidenceRows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          competencyId: "competency-depth-3",
        }),
      ]),
    );
  });

  it("uses stored scoring policy config to decide prerequisite spread eligibility", async () => {
    const completedAt = new Date("2026-06-27T12:12:00.000Z");
    const completedAttempt = buildCompletedAttemptWithPrerequisites({
      score: 0.95,
      confidence: 0.8,
      attemptDetails: {
        schemaVersion: 1,
        scoringPolicy: {
          version: "initial-diagnostic-scoring-v1",
          config: {
            strongCorrectMinScore: 0.99,
            strongCorrectMinConfidence: 0.7,
            requireExactWordBankSequenceForSpread: true,
            prerequisiteSpreadMaxDepth: 2,
          },
        },
      },
    });
    const { repository, tx } = buildCompletionHarness(completedAttempt);

    await repository.completeAttempt({
      attemptId: "attempt-1",
      completedAt,
      summary: {
        schemaVersion: 1,
        answeredItemCount: 1,
        stopReason: "question_bank_exhausted",
      },
    });

    const evidenceRows = createdEvidenceRows(tx);
    expect(evidenceRows).toEqual([
      expect.objectContaining({
        competencyId: "competency-primary",
        sourceType: "initial_diagnostic",
      }),
    ]);
  });

  it("does not publish weaker inferred evidence for a directly targeted competency", async () => {
    const completedAt = new Date("2026-06-27T12:12:00.000Z");
    const completedAttempt = buildCompletedAttemptWithPrerequisites({
      competencyTargets: [
        {
          competencyId: "competency-primary",
          role: "primary",
          weight: 100,
        },
        {
          competencyId: "competency-depth-1",
          role: "supporting",
          weight: 50,
        },
      ],
    });
    const { repository, tx } = buildCompletionHarness(completedAttempt);

    await repository.completeAttempt({
      attemptId: "attempt-1",
      completedAt,
      summary: {
        schemaVersion: 1,
        answeredItemCount: 1,
        stopReason: "question_bank_exhausted",
      },
    });

    const evidenceRows = createdEvidenceRows(tx);
    expect(
      evidenceRows.filter((row) => row.competencyId === "competency-depth-1"),
    ).toEqual([
      expect.objectContaining({
        competencyId: "competency-depth-1",
        sourceType: "initial_diagnostic",
      }),
    ]);
  });
});

function buildCompletionHarness(completedAttempt: Record<string, unknown>) {
  const tx = {
    diagnosticAttempt: {
      update: vi.fn(async () => completedAttempt),
    },
    competencyEvidence: {
      createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({
        count: data.length,
      })),
    },
    learnerCompetencyState: {
      upsert: vi.fn(async () => ({})),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };

  return {
    repository: new PrismaDiagnosticAttemptRepository(prisma as never),
    tx,
  };
}

type CapturedEvidenceRow = {
  competencyId: string;
  sourceType: string;
  score: number;
  confidence: number;
  details: Record<string, unknown> & {
    prerequisiteDepth?: number;
    prerequisiteStrength?: number;
  };
};

function createdEvidenceRows(
  tx: ReturnType<typeof buildCompletionHarness>["tx"],
): CapturedEvidenceRow[] {
  return (tx.competencyEvidence.createMany.mock.calls[0]?.[0].data ??
    []) as CapturedEvidenceRow[];
}

function buildCompletedAttemptWithPrerequisites(
  input: {
    score?: number;
    confidence?: number;
    itemDetails?: Record<string, unknown>;
    attemptDetails?: Record<string, unknown>;
    includeDepth2Prerequisite?: boolean;
    includeDepth3Prerequisite?: boolean;
    competencyTargets?: Array<{
      competencyId: string;
      role: string;
      weight: number | null;
    }>;
  } = {},
) {
  const answeredAt = new Date("2026-06-27T12:10:12.000Z");
  const depth3Competency = {
    id: "competency-depth-3",
    prerequisites: [],
  };
  const depth2Competency = {
    id: "competency-depth-2",
    prerequisites: input.includeDepth3Prerequisite
      ? [
          {
            strength: 70,
            prerequisite: depth3Competency,
          },
        ]
      : [],
  };
  const depth1Competency = {
    id: "competency-depth-1",
    prerequisites: input.includeDepth2Prerequisite
      ? [
          {
            strength: 80,
            prerequisite: depth2Competency,
          },
        ]
      : [],
  };

  return {
    id: "attempt-1",
    learningTrackId: "track-1",
    catalogId: "catalog-1",
    purpose: "onboarding_initial",
    status: "completed",
    selectionPolicyVersion: "initial-diagnostic-selection-v1",
    scoringPolicyVersion: "initial-diagnostic-scoring-v1",
    startedAt: new Date("2026-06-27T12:00:00.000Z"),
    completedAt: new Date("2026-06-27T12:12:00.000Z"),
    abandonedAt: null,
    summary: {
      schemaVersion: 1,
      answeredItemCount: 1,
      stopReason: "question_bank_exhausted",
    },
    details: input.attemptDetails ?? {},
    items: [
      {
        id: "attempt-item-1",
        diagnosticItemId: "item-1",
        score: input.score ?? 0.95,
        confidence: input.confidence ?? 0.8,
        answeredAt,
        details: input.itemDetails ?? {
          schemaVersion: 1,
          responseKind: "multiple_choice",
          mistakeCodes: [],
        },
        diagnosticItem: {
          primaryCompetencyId: "competency-primary",
          primaryCompetency: {
            id: "competency-primary",
            prerequisites: [
              {
                strength: 90,
                prerequisite: depth1Competency,
              },
            ],
          },
          competencyTargets: input.competencyTargets ?? [
            {
              competencyId: "competency-primary",
              role: "primary",
              weight: 100,
            },
          ],
        },
      },
    ],
  };
}
