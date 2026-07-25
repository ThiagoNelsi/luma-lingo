import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../observability/logger.js";
import { PrismaInitialLearningPriorityRepository } from "./prisma-initial-learning-priority-repository.js";

describe("PrismaInitialLearningPriorityRepository", () => {
  it("ranks the published policy against the learner state for a Beginner path", async () => {
    const learningTrack = {
      findUnique: vi.fn(async () => ({
        competencyCatalogId: "catalog-1",
        targetLanguage: "English",
        learningGoal: "travel",
        additionalGoals: [],
        conceptStates: [],
        competencyStates: [],
      })),
    };
    const pedagogicalPolicy = {
      findFirst: vi.fn(async () => ({
        version: "1.0.0",
        metadata: {},
        competencyWeights: [
          {
            competencyId: "competency-1",
            basePriority: 40,
            foundationWeight: 100,
          },
        ],
        competencyGoalWeights: [],
        conceptGoalWeights: [],
      })),
    };
    const competency = {
      findMany: vi.fn(async () => [
        {
          id: "competency-1",
          key: "en.synthetic.foundation.pre_a1",
          difficultyBand: "pre_a1",
          conceptRelationships: [],
        },
      ]),
    };
    const repository = new PrismaInitialLearningPriorityRepository({
      learningTrack,
      pedagogicalPolicy,
      competency,
    } as never);

    await expect(
      repository.findInitialLearningPriority({
        learningTrackId: "track-1",
        onboardingStartingPoint: "beginner",
      }),
    ).resolves.toMatchObject({
      competencyId: "competency-1",
      selectionReason: "beginner_pre_a1_foundation",
    });
    expect(learningTrack.findUnique).toHaveBeenCalledWith({
      where: { id: "track-1" },
      select: {
        competencyCatalogId: true,
        targetLanguage: true,
        learningGoal: true,
        additionalGoals: true,
        conceptStates: {
          select: {
            conceptId: true,
            capability: true,
            mastery: true,
            confidence: true,
            lastEvidenceAt: true,
          },
        },
        competencyStates: {
          select: {
            competencyId: true,
            abilityEstimate: true,
            confidence: true,
            lastEvidenceAt: true,
          },
        },
      },
    });
    expect(pedagogicalPolicy.findFirst).toHaveBeenCalledWith({
      where: { catalogId: "catalog-1" },
      orderBy: [{ createdAt: "desc" }, { version: "desc" }],
      select: {
        version: true,
        metadata: true,
        competencyWeights: {
          select: {
            competencyId: true,
            basePriority: true,
            foundationWeight: true,
          },
        },
        competencyGoalWeights: {
          select: { competencyId: true, goal: true, weight: true },
        },
        conceptGoalWeights: {
          select: { conceptId: true, goal: true, weight: true },
        },
      },
    });
    expect(competency.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { catalogId: "catalog-1", status: "active" },
      }),
    );
  });

  it("restores a completed track to the current published catalog before ranking", async () => {
    const learningTrack = {
      findUnique: vi.fn(async () => ({
        competencyCatalogId: null,
        targetLanguage: "English",
        learningGoal: "travel",
        additionalGoals: [],
        conceptStates: [],
        competencyStates: [],
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    };
    const competencyCatalog = {
      findFirst: vi.fn(async () => ({ id: "catalog-recovered" })),
    };
    const pedagogicalPolicy = {
      findFirst: vi.fn(async () => ({
        version: "1.0.0",
        metadata: {},
        competencyWeights: [
          {
            competencyId: "competency-1",
            basePriority: 40,
            foundationWeight: 100,
          },
        ],
        competencyGoalWeights: [],
        conceptGoalWeights: [],
      })),
    };
    const competency = {
      findMany: vi.fn(async () => [
        {
          id: "competency-1",
          key: "en.synthetic.foundation.pre_a1",
          difficultyBand: "pre_a1",
          conceptRelationships: [],
        },
      ]),
    };
    const repository = new PrismaInitialLearningPriorityRepository({
      learningTrack,
      competencyCatalog,
      pedagogicalPolicy,
      competency,
    } as never);

    await expect(
      repository.findInitialLearningPriority({
        learningTrackId: "track-1",
        onboardingStartingPoint: "beginner",
      }),
    ).resolves.toMatchObject({ competencyId: "competency-1" });

    expect(competencyCatalog.findFirst).toHaveBeenCalledWith({
      where: { targetLanguage: "English", status: "published" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });
    expect(learningTrack.updateMany).toHaveBeenCalledWith({
      where: { id: "track-1", competencyCatalogId: null },
      data: { competencyCatalogId: "catalog-recovered" },
    });
    expect(pedagogicalPolicy.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { catalogId: "catalog-recovered" } }),
    );
  });

  it("logs Prisma failures with operation and track correlation", async () => {
    const failure = Object.assign(new Error("database_unavailable"), {
      code: "P2024",
    });
    const error = vi.fn();
    const repository = new PrismaInitialLearningPriorityRepository(
      {
        learningTrack: {
          findUnique: vi.fn(async () => {
            throw failure;
          }),
        },
      } as never,
      { error } as unknown as AppLogger,
    );

    await expect(
      repository.findInitialLearningPriority({
        learningTrackId: "track-1",
        onboardingStartingPoint: "diagnostic",
      }),
    ).rejects.toThrow("database_unavailable");

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: "database_unavailable",
        event: "prisma.operation.failed",
        learningTrackId: "track-1",
        operation: "learning_priority.resolve_initial",
        prismaCode: "P2024",
        provider: "prisma",
        status: "failed",
      }),
      "Prisma operation failed",
    );
  });
});
