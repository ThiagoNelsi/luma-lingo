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
import {
  createSilentLogger,
  errorMetadata,
  type AppLogger,
} from "../observability/logger.js";

const pedagogicalPolicyMetadataSchema = z.object({
  ranking: pedagogicalRankingConfigSchema.optional(),
});

export class PrismaInitialLearningPriorityRepository implements InitialLearningPriorityRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: AppLogger = createSilentLogger(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async findInitialLearningPriority(input: {
    learningTrackId: string;
    onboardingStartingPoint: "beginner" | "diagnostic";
  }) {
    const startedAt = performance.now();
    try {
      const priority = await this.resolveInitialLearningPriority(input);
      this.logger.debug(
        {
          durationMs: Math.round(performance.now() - startedAt),
          event: "prisma.operation.completed",
          learningTrackId: input.learningTrackId,
          operation: "learning_priority.resolve_initial",
          provider: "prisma",
          status: "completed",
        },
        "Prisma operation completed",
      );
      return priority;
    } catch (error) {
      this.logger.error(
        {
          durationMs: Math.round(performance.now() - startedAt),
          err: errorMetadata(error),
          event: "prisma.operation.failed",
          learningTrackId: input.learningTrackId,
          operation: "learning_priority.resolve_initial",
          prismaCode: prismaErrorCode(error),
          provider: "prisma",
          status: "failed",
          ...errorMetadata(error),
        },
        "Prisma operation failed",
      );
      throw error;
    }
  }

  private async resolveInitialLearningPriority(input: {
    learningTrackId: string;
    onboardingStartingPoint: "beginner" | "diagnostic";
  }) {
    const learningTrack = await this.prisma.learningTrack.findUnique({
      where: { id: input.learningTrackId },
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
    if (!learningTrack) return null;

    const competencyCatalogId =
      learningTrack.competencyCatalogId ??
      (await this.restorePublishedCatalog(
        input.learningTrackId,
        learningTrack.targetLanguage,
      ));
    const primaryGoal = goalSchema.safeParse(learningTrack.learningGoal);
    const additionalGoals = additionalGoalSchema
      .array()
      .safeParse(learningTrack.additionalGoals);
    if (
      !competencyCatalogId ||
      !primaryGoal.success ||
      !additionalGoals.success
    ) {
      return null;
    }

    const policy = await this.prisma.pedagogicalPolicy.findFirst({
      where: { catalogId: competencyCatalogId },
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
        catalogId: competencyCatalogId,
        status: "active",
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

  private async restorePublishedCatalog(
    learningTrackId: string,
    targetLanguage: string,
  ): Promise<string | null> {
    const catalog = await this.prisma.competencyCatalog.findFirst({
      where: { targetLanguage, status: "published" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });
    if (!catalog) return null;

    await this.prisma.learningTrack.updateMany({
      where: { id: learningTrackId, competencyCatalogId: null },
      data: { competencyCatalogId: catalog.id },
    });
    return catalog.id;
  }
}

function prismaErrorCode(error: unknown): string | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    typeof error.code !== "string"
  ) {
    return undefined;
  }
  return error.code;
}
