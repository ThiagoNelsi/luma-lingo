import {
  additionalGoalSchema,
  goalSchema,
  pedagogicalRankingConfigSchema,
} from "@luma-lingo/shared";
import type { PrismaClient } from "@luma-lingo/database";
import { z } from "zod";

import { rankInitialLearningPriorities } from "../learning/initial-learning-priority.js";
import type { InitialLearningPriorityRepository } from "../learning/initial-learning-priority-repository.js";
import { assumedConceptRequirementSchema } from "../learning/knowledge-inference.js";

const pedagogicalPolicyMetadataSchema = z.object({
  ranking: pedagogicalRankingConfigSchema.optional(),
});

export class PrismaInitialLearningPriorityRepository implements InitialLearningPriorityRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async findInitialLearningPriority(input: {
    learningTrackId: string;
    onboardingStartingPoint: "beginner" | "diagnostic";
  }) {
    const learningTrack = await this.prisma.learningTrack.findUnique({
      where: { id: input.learningTrackId },
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
    const primaryGoal = goalSchema.safeParse(learningTrack?.learningGoal);
    const additionalGoals = additionalGoalSchema
      .array()
      .safeParse(learningTrack?.additionalGoals);
    if (
      !learningTrack?.competencyCatalogId ||
      !primaryGoal.success ||
      !additionalGoals.success
    ) {
      return null;
    }

    const policy = await this.prisma.pedagogicalPolicy.findFirst({
      where: { catalogId: learningTrack.competencyCatalogId },
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
    if (!policy) return null;

    const competencies = await this.prisma.competency.findMany({
      where: {
        catalogId: learningTrack.competencyCatalogId,
        status: "published",
      },
      select: {
        id: true,
        key: true,
        difficultyBand: true,
        conceptRelationships: {
          where: { role: { in: ["component", "assumed"] } },
          select: {
            conceptId: true,
            role: true,
            requiredCapability: true,
          },
        },
      },
    });
    const metadata = pedagogicalPolicyMetadataSchema.parse(policy.metadata);
    const priorities = rankInitialLearningPriorities({
      onboardingStartingPoint: input.onboardingStartingPoint,
      primaryGoal: primaryGoal.data,
      additionalGoals: additionalGoals.data,
      policy: {
        version: policy.version,
        competencyWeights: policy.competencyWeights.map((weight) => ({
          competencyId: weight.competencyId,
          basePriority: weight.basePriority ?? undefined,
          foundationWeight: weight.foundationWeight ?? undefined,
        })),
        competencyGoalWeights: policy.competencyGoalWeights.map((weight) => ({
          ...weight,
          goal: goalSchema.parse(weight.goal),
        })),
        conceptGoalWeights: policy.conceptGoalWeights.map((weight) => ({
          ...weight,
          goal: goalSchema.parse(weight.goal),
        })),
        ranking: metadata.ranking,
      },
      competencies: competencies.map((competency) => ({
        id: competency.id,
        key: competency.key,
        difficultyBand: competency.difficultyBand,
        componentConceptIds: competency.conceptRelationships
          .filter((relationship) => relationship.role === "component")
          .map((relationship) => relationship.conceptId),
        assumedConcepts: competency.conceptRelationships
          .filter((relationship) => relationship.role === "assumed")
          .map((relationship) =>
            assumedConceptRequirementSchema.parse({
              conceptId: relationship.conceptId,
              requiredCapability: relationship.requiredCapability,
            }),
          ),
      })),
      conceptStates: learningTrack.conceptStates.map((state) => ({
        conceptId: state.conceptId,
        capability:
          assumedConceptRequirementSchema.shape.requiredCapability.parse(
            state.capability,
          ),
        mastery: state.mastery,
        confidence: state.confidence,
        lastEvidenceAt: state.lastEvidenceAt,
      })),
      competencyStates: learningTrack.competencyStates,
      now: this.now(),
    });

    return priorities[0] ?? null;
  }
}
