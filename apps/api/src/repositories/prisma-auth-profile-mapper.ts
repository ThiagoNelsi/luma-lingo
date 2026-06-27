import type { Prisma } from "@luma-lingo/database";
import {
  additionalGoalSchema,
  cefrGoalLevelSchema,
  goalSchema,
  languageCodeSchema,
  learnerAgeRangeSchema,
  lessonEmphasisSchema,
  onboardingStartingPointSchema,
  studyPaceSchema,
} from "@luma-lingo/shared";

import type { AuthProfile } from "../services/auth-profile.js";

export const userWithLearnerArgs = {
  include: { learner: { include: { currentLearningTrack: true } } },
} satisfies Prisma.UserDefaultArgs;

export type UserWithLearner = Prisma.UserGetPayload<typeof userWithLearnerArgs>;

export function toAuthProfile(user: UserWithLearner): AuthProfile {
  if (!user.learner) {
    throw new Error("learner_missing_for_user");
  }

  return {
    user: {
      id: user.id,
      primaryEmail: user.primaryEmail,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
    },
    learner: {
      id: user.learner.id,
      displayName: user.learner.displayName,
      instructionLanguage: user.learner.instructionLanguage
        ? languageCodeSchema.parse(user.learner.instructionLanguage)
        : null,
      ageRange: user.learner.ageRange
        ? learnerAgeRangeSchema.parse(user.learner.ageRange)
        : null,
      currentLearningTrackId: user.learner.currentLearningTrackId,
    },
    currentLearningTrack: user.learner.currentLearningTrack
      ? {
          id: user.learner.currentLearningTrack.id,
          targetLanguage: languageCodeSchema.parse(
            user.learner.currentLearningTrack.targetLanguage,
          ),
          level: user.learner.currentLearningTrack.level,
          learningGoal: user.learner.currentLearningTrack.learningGoal
            ? goalSchema.parse(user.learner.currentLearningTrack.learningGoal)
            : null,
          goalCefrLevel: user.learner.currentLearningTrack.goalCefrLevel
            ? cefrGoalLevelSchema.parse(
                user.learner.currentLearningTrack.goalCefrLevel,
              )
            : null,
          additionalGoals:
            user.learner.currentLearningTrack.additionalGoals.map((goal) =>
              additionalGoalSchema.parse(goal),
            ),
          lessonEmphases: user.learner.currentLearningTrack.lessonEmphases.map(
            (emphasis) => lessonEmphasisSchema.parse(emphasis),
          ),
          studyPace: user.learner.currentLearningTrack.studyPace
            ? studyPaceSchema.parse(user.learner.currentLearningTrack.studyPace)
            : null,
          onboardingStartingPoint: user.learner.currentLearningTrack
            .onboardingStartingPoint
            ? onboardingStartingPointSchema.parse(
                user.learner.currentLearningTrack.onboardingStartingPoint,
              )
            : null,
          onboardingStatus: user.learner.currentLearningTrack.onboardingStatus,
          onboardingStep: user.learner.currentLearningTrack.onboardingStep,
        }
      : null,
  };
}
