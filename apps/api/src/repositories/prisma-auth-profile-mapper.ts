import type { Prisma } from "@luma-lingo/database";
import { languageCodeSchema } from "@luma-lingo/shared";

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
      ageRange: user.learner.ageRange,
      currentLearningTrackId: user.learner.currentLearningTrackId,
    },
    currentLearningTrack: user.learner.currentLearningTrack
      ? {
          id: user.learner.currentLearningTrack.id,
          targetLanguage: languageCodeSchema.parse(
            user.learner.currentLearningTrack.targetLanguage,
          ),
          level: user.learner.currentLearningTrack.level,
          learningGoal: user.learner.currentLearningTrack.learningGoal,
          onboardingStatus: user.learner.currentLearningTrack.onboardingStatus,
          onboardingStep: user.learner.currentLearningTrack.onboardingStep,
        }
      : null,
  };
}
