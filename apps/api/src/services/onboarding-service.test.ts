import { describe, expect, it, vi } from "vitest";

import type { DiagnosticAttemptRepository } from "../diagnostics/diagnostic-attempt-repository.js";
import type { LearnerRepository } from "../learners/learner-repository.js";
import type { OnboardingCompletionRepository } from "../learners/onboarding-completion-repository.js";
import { OnboardingService } from "./onboarding-service.js";

const learners = {} as LearnerRepository;

describe("OnboardingService", () => {
  it("completes beginner onboarding through the beginner profile path", async () => {
    const completeBeginnerOnboarding = vi.fn(async () => ({
      onboardingStatus: "completed" as const,
      onboardingStep: null,
    }));
    const findInitialLearningPriority = vi.fn(async () => ({
      competencyId: "competency-1",
      competencyKey: "en.synthetic.foundation.pre_a1",
      score: 205,
      readiness: 1,
      foundationWeight: 100,
      basePriority: 40,
      goalFit: 0,
      knowledgeGap: 1,
      uncertainty: 1,
      reviewNeed: 0,
      recentRepetition: 0,
      selectionReason: "beginner_pre_a1_foundation" as const,
    }));
    const service = new OnboardingService(
      learners,
      {
        completeBeginnerOnboarding,
        completeDiagnosticOnboarding: vi.fn(),
      },
      {
        findCompletedAttempt: vi.fn(),
      } as unknown as DiagnosticAttemptRepository,
      { findInitialLearningPriority },
    );

    await expect(
      service.completeOnboarding({
        learningTrackId: "track-1",
        targetLanguage: "en",
        onboardingStartingPoint: "beginner",
      }),
    ).resolves.toEqual({
      onboardingStatus: "completed",
      onboardingStep: null,
      initialLearningPriority: {
        competencyId: "competency-1",
        competencyKey: "en.synthetic.foundation.pre_a1",
        score: 205,
        readiness: 1,
        foundationWeight: 100,
        basePriority: 40,
        goalFit: 0,
        knowledgeGap: 1,
        uncertainty: 1,
        reviewNeed: 0,
        recentRepetition: 0,
        selectionReason: "beginner_pre_a1_foundation",
      },
    });
    expect(completeBeginnerOnboarding).toHaveBeenCalledWith({
      learningTrackId: "track-1",
      targetLanguage: "en",
    });
    expect(findInitialLearningPriority).toHaveBeenCalledWith({
      learningTrackId: "track-1",
      onboardingStartingPoint: "beginner",
    });
  });

  it("requires a completed onboarding initial diagnostic attempt for the diagnostic path", async () => {
    const service = new OnboardingService(
      learners,
      {
        completeBeginnerOnboarding: vi.fn(),
        completeDiagnosticOnboarding: vi.fn(),
      },
      {
        findCompletedAttempt: vi.fn(async () => null),
      } as unknown as DiagnosticAttemptRepository,
    );

    await expect(
      service.completeOnboarding({
        learningTrackId: "track-1",
        targetLanguage: "en",
        onboardingStartingPoint: "diagnostic",
      }),
    ).rejects.toThrow("completed_initial_diagnostic_required");
  });

  it("completes diagnostic onboarding with the completed attempt catalog", async () => {
    const completeDiagnosticOnboarding = vi.fn(async () => ({
      onboardingStatus: "completed" as const,
      onboardingStep: null,
    }));
    const service = new OnboardingService(
      learners,
      {
        completeBeginnerOnboarding: vi.fn(),
        completeDiagnosticOnboarding,
      },
      {
        findCompletedAttempt: vi.fn(async () => ({
          id: "attempt-1",
          learningTrackId: "track-1",
          catalogId: "catalog-1",
          purpose: "onboarding_initial",
          status: "completed",
          selectionPolicyVersion: "initial-diagnostic-selection-v1",
          scoringPolicyVersion: "initial-diagnostic-scoring-v1",
          startedAt: new Date("2026-06-28T12:00:00.000Z"),
          completedAt: new Date("2026-06-28T12:10:00.000Z"),
          abandonedAt: null,
          summary: {},
          details: {},
        })),
      } as unknown as DiagnosticAttemptRepository,
    );

    await expect(
      service.completeOnboarding({
        learningTrackId: "track-1",
        targetLanguage: "en",
        onboardingStartingPoint: "diagnostic",
      }),
    ).resolves.toEqual({
      onboardingStatus: "completed",
      onboardingStep: null,
      initialLearningPriority: null,
    });
    expect(completeDiagnosticOnboarding).toHaveBeenCalledWith({
      learningTrackId: "track-1",
      competencyCatalogId: "catalog-1",
    });
  });

  it("requires the onboarding starting point before completion", async () => {
    const service = new OnboardingService(
      learners,
      {} as OnboardingCompletionRepository,
      {} as DiagnosticAttemptRepository,
    );

    await expect(
      service.completeOnboarding({
        learningTrackId: "track-1",
        targetLanguage: "en",
        onboardingStartingPoint: null,
      }),
    ).rejects.toThrow("onboarding_starting_point_required");
  });
});
