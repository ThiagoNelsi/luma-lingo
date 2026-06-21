import type { PrismaClient } from "@luma-lingo/database";
import { describe, expect, it } from "vitest";

import { PrismaLearnerRepository } from "./prisma-learner-repository.js";

describe("PrismaLearnerRepository", () => {
  it("upserts the target track and makes it current with the instruction language", async () => {
    let trackInput: unknown;
    let learnerInput: unknown;
    const tx = {
      learningTrack: {
        upsert: async (input: unknown) => {
          trackInput = input;
          return { id: "track-1" };
        },
      },
      learner: {
        update: async (input: unknown) => {
          learnerInput = input;
          return {};
        },
      },
    };
    const prisma = {
      $transaction: async <T>(callback: (client: typeof tx) => Promise<T>) =>
        callback(tx),
    };
    const repository = new PrismaLearnerRepository(
      prisma as unknown as PrismaClient,
    );

    await expect(
      repository.saveLanguageSelection("learner-1", {
        instructionLanguage: "pt",
        targetLanguage: "en",
      }),
    ).resolves.toMatchObject({
      instructionLanguage: "pt",
      targetLanguage: "en",
    });
    expect(trackInput).toMatchObject({
      where: {
        learnerId_targetLanguage: {
          learnerId: "learner-1",
          targetLanguage: "en",
        },
      },
      create: {
        learnerId: "learner-1",
        targetLanguage: "en",
        onboardingStatus: "in_progress",
        onboardingStep: "languages",
      },
      update: {
        onboardingStatus: "in_progress",
        onboardingStep: "languages",
      },
    });
    expect(learnerInput).toEqual({
      where: { id: "learner-1" },
      data: {
        instructionLanguage: "pt",
        currentLearningTrackId: "track-1",
      },
    });
  });

  it("saves age and goals on the learner and current learning track", async () => {
    const learnerInput: { data?: unknown } = {};
    const prisma = {
      learner: {
        update: async (input: { data: unknown }) => {
          learnerInput.data = input.data;
          return {};
        },
      },
    };
    const declaredAt = new Date("2026-06-20T18:00:00.000Z");
    const repository = new PrismaLearnerRepository(
      prisma as unknown as PrismaClient,
      () => declaredAt,
    );

    await expect(
      repository.saveAgeAndGoals("learner-1", {
        ageRange: "25_39",
        displayName: "Thiago",
        primaryGoal: "cefr_level",
        cefrGoalLevel: "B2",
        additionalGoals: ["travel"],
      }),
    ).resolves.toMatchObject({
      primaryGoal: "cefr_level",
      onboardingStep: "age_and_goals",
    });
    expect(learnerInput.data).toEqual({
      ageRange: "25_39",
      ageRangeDeclaredAt: declaredAt,
      displayName: "Thiago",
      currentLearningTrack: {
        update: {
          learningGoal: "cefr_level",
          goalCefrLevel: "B2",
          additionalGoals: ["travel"],
          onboardingStatus: "in_progress",
          onboardingStep: "age_and_goals",
        },
      },
    });
  });
});
