import { describe, expect, it, vi } from "vitest";

import {
  diagnosticEvidenceDetailsSchemaVersion,
  learnerCompetencyStateDetailsSchemaVersion,
} from "../diagnostics/diagnostic-attempt.js";
import { PrismaDiagnosticAttemptRepository } from "./prisma-diagnostic-attempt-repository.js";

describe("PrismaDiagnosticAttemptRepository", () => {
  it("creates a diagnostic attempt with first-class purpose and policy versions", async () => {
    const startedAt = new Date("2026-06-27T12:00:00.000Z");
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
        details: {},
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
      }),
    ).resolves.toMatchObject({
      learningTrackId: "track-1",
      purpose: "onboarding_initial",
      status: "in_progress",
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
        details: {},
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
          score: 0.8,
          confidence: 0.75,
          answeredAt,
          diagnosticItem: {
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
        createMany: vi.fn(async () => ({ count: 2 })),
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
          score: 0.8,
          confidence: 0.75,
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
          score: 0.8,
          confidence: 0.375,
          details: {
            schemaVersion: diagnosticEvidenceDetailsSchemaVersion,
            attemptId: "attempt-1",
            diagnosticItemId: "item-1",
            targetRole: "supporting",
            targetWeight: 50,
            scoringPolicyVersion: "initial-diagnostic-scoring-v1",
          },
        },
      ],
    });
    expect(tx.learnerCompetencyState.upsert).toHaveBeenCalledTimes(2);
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
        abilityEstimate: 0.8,
        confidence: 0.75,
        evidenceCount: 1,
        lastEvidenceAt: answeredAt,
        details: {
          schemaVersion: learnerCompetencyStateDetailsSchemaVersion,
          lastUpdateReason: "initial_diagnostic",
          scoringPolicyVersion: "initial-diagnostic-scoring-v1",
        },
      },
      update: {
        abilityEstimate: 0.8,
        confidence: 0.75,
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
});
