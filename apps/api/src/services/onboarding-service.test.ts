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
    const service = new OnboardingService(
      learners,
      {
        completeBeginnerOnboarding,
        completeDiagnosticOnboarding: vi.fn(),
      },
      {
        findCompletedAttempt: vi.fn(),
      } as unknown as DiagnosticAttemptRepository,
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
    });
    expect(completeBeginnerOnboarding).toHaveBeenCalledWith({
      learningTrackId: "track-1",
      targetLanguage: "en",
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
