import { describe, expect, it } from "vitest";

import {
  toAuthProfile,
  type UserWithLearner,
} from "./prisma-auth-profile-mapper.js";

describe("toAuthProfile", () => {
  it("maps constrained age and goals from Prisma into the auth profile", () => {
    const now = new Date("2026-06-20T18:00:00.000Z");
    const user = {
      id: "00000000-0000-4000-8000-000000000001",
      primaryEmail: "learner@example.com",
      emailVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      learner: {
        id: "00000000-0000-4000-8000-000000000002",
        userId: "00000000-0000-4000-8000-000000000001",
        displayName: "Thiago",
        instructionLanguage: "pt",
        ageRange: "25_39",
        ageRangeDeclaredAt: now,
        currentLearningTrackId: "00000000-0000-4000-8000-000000000003",
        createdAt: now,
        updatedAt: now,
        currentLearningTrack: {
          id: "00000000-0000-4000-8000-000000000003",
          learnerId: "00000000-0000-4000-8000-000000000002",
          targetLanguage: "en",
          level: null,
          learningGoal: "cefr_level",
          goalCefrLevel: "B2",
          additionalGoals: ["travel"],
          onboardingStatus: "in_progress",
          onboardingStep: "age_and_goals",
          createdAt: now,
          updatedAt: now,
        },
      },
    } as UserWithLearner;

    expect(toAuthProfile(user)).toMatchObject({
      learner: { ageRange: "25_39", displayName: "Thiago" },
      currentLearningTrack: {
        learningGoal: "cefr_level",
        goalCefrLevel: "B2",
        additionalGoals: ["travel"],
        onboardingStep: "age_and_goals",
      },
    });
  });
});
