import { describe, expect, it, vi } from "vitest";

import { PrismaInitialLearningPriorityRepository } from "./prisma-initial-learning-priority-repository.js";

describe("PrismaInitialLearningPriorityRepository", () => {
  it("ranks the published policy against the learner state for a Beginner path", async () => {
    const learningTrack = {
      findUnique: vi.fn(async () => ({
        competencyCatalogId: "catalog-1",
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
  });
});
