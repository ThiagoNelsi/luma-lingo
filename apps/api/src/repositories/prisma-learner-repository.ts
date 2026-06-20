import type { LanguageSelection } from "@luma-lingo/shared";
import { createId, PrismaClient } from "@luma-lingo/database";

import {
  toLanguageSelectionProgress,
  type LanguageSelectionProgress,
} from "../learners/language-selection-progress.js";
import type { LearnerRepository } from "../learners/learner-repository.js";

export class PrismaLearnerRepository implements LearnerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async saveLanguageSelection(
    learnerId: string,
    selection: LanguageSelection,
  ): Promise<LanguageSelectionProgress> {
    await this.prisma.$transaction(async (tx) => {
      const track = await tx.learningTrack.upsert({
        where: {
          learnerId_targetLanguage: {
            learnerId,
            targetLanguage: selection.targetLanguage,
          },
        },
        create: {
          id: createId(),
          learnerId,
          targetLanguage: selection.targetLanguage,
          onboardingStatus: "in_progress",
          onboardingStep: "languages",
        },
        update: {
          onboardingStatus: "in_progress",
          onboardingStep: "languages",
        },
      });

      await tx.learner.update({
        where: { id: learnerId },
        data: {
          instructionLanguage: selection.instructionLanguage,
          currentLearningTrackId: track.id,
        },
      });
    });

    return toLanguageSelectionProgress(selection);
  }
}
