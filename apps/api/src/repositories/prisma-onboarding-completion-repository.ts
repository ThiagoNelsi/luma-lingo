import { createId, type Prisma, type PrismaClient } from "@luma-lingo/database";

import type { OnboardingCompletionRepository } from "../learners/onboarding-completion-repository.js";
import { toOnboardingCompletion } from "../learners/onboarding-completion.js";

const beginnerAssumptionDetails = {
  schemaVersion: 1,
  lastUpdateReason: "beginner_onboarding_assumption",
  onboardingStartingPoint: "beginner",
} satisfies Prisma.InputJsonObject;

export class PrismaOnboardingCompletionRepository implements OnboardingCompletionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async completeBeginnerOnboarding(input: {
    learningTrackId: string;
    targetLanguage: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const catalog = await tx.competencyCatalog.findFirst({
        where: {
          targetLanguage: input.targetLanguage,
          status: "published",
        },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
        },
      });

      if (!catalog) return null;

      const seedCompetencies = await tx.competency.findMany({
        where: {
          catalogId: catalog.id,
          difficultyBand: "Pre-A1",
          isCore: true,
          prerequisites: {
            none: {},
          },
        },
        orderBy: {
          key: "asc",
        },
        select: {
          id: true,
        },
      });

      await tx.learningTrack.update({
        where: {
          id: input.learningTrackId,
        },
        data: {
          competencyCatalogId: catalog.id,
          onboardingStatus: "completed",
          onboardingStep: null,
        },
      });

      for (const competency of seedCompetencies) {
        await tx.learnerCompetencyState.upsert({
          where: {
            learningTrackId_competencyId: {
              learningTrackId: input.learningTrackId,
              competencyId: competency.id,
            },
          },
          create: {
            id: createId(),
            learningTrackId: input.learningTrackId,
            competencyId: competency.id,
            abilityEstimate: 0,
            confidence: 0.2,
            evidenceCount: 0,
            lastEvidenceAt: null,
            details: beginnerAssumptionDetails,
          },
          update: {
            abilityEstimate: 0,
            confidence: 0.2,
            evidenceCount: 0,
            lastEvidenceAt: null,
            details: beginnerAssumptionDetails,
          },
        });
      }

      return toOnboardingCompletion();
    });
  }

  async completeDiagnosticOnboarding(input: {
    learningTrackId: string;
    competencyCatalogId: string;
  }) {
    await this.prisma.learningTrack.update({
      where: {
        id: input.learningTrackId,
      },
      data: {
        competencyCatalogId: input.competencyCatalogId,
        onboardingStatus: "completed",
        onboardingStep: null,
      },
    });

    return toOnboardingCompletion();
  }
}
