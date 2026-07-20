import type { PrismaClient } from "@luma-lingo/database";

import type { OnboardingCompletionRepository } from "../learners/onboarding-completion-repository.js";
import { toOnboardingCompletion } from "../learners/onboarding-completion.js";

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
