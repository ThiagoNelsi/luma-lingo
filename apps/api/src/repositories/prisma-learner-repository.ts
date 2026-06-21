import type {
  AgeAndGoalsSelection,
  LanguageSelection,
  LessonPreferencesSelection,
} from "@luma-lingo/shared";
import { createId, PrismaClient } from "@luma-lingo/database";

import {
  toAgeAndGoalsProgress,
  type AgeAndGoalsProgress,
} from "../learners/age-and-goals-progress.js";
import {
  toLanguageSelectionProgress,
  type LanguageSelectionProgress,
} from "../learners/language-selection-progress.js";
import type { LearnerRepository } from "../learners/learner-repository.js";
import {
  toLessonPreferencesProgress,
  type LessonPreferencesProgress,
} from "../learners/lesson-preferences-progress.js";

export class PrismaLearnerRepository implements LearnerRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

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

  async saveAgeAndGoals(
    learnerId: string,
    selection: AgeAndGoalsSelection,
  ): Promise<AgeAndGoalsProgress> {
    await this.prisma.learner.update({
      where: { id: learnerId },
      data: {
        ageRange: selection.ageRange,
        ageRangeDeclaredAt: this.now(),
        displayName: selection.displayName,
        currentLearningTrack: {
          update: {
            learningGoal: selection.primaryGoal,
            goalCefrLevel: selection.cefrGoalLevel,
            additionalGoals: selection.additionalGoals,
            onboardingStatus: "in_progress",
            onboardingStep: "age_and_goals",
          },
        },
      },
    });

    return toAgeAndGoalsProgress(selection);
  }

  async saveLessonPreferences(
    learnerId: string,
    selection: LessonPreferencesSelection,
  ): Promise<LessonPreferencesProgress> {
    await this.prisma.learner.update({
      where: { id: learnerId },
      data: {
        currentLearningTrack: {
          update: {
            lessonEmphases: selection.lessonEmphases,
            studyPace: selection.studyPace,
            onboardingStatus: "in_progress",
            onboardingStep: "lesson_preferences",
          },
        },
      },
    });

    return toLessonPreferencesProgress(selection);
  }
}
