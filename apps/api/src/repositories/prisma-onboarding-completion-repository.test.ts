import { describe, expect, it, vi } from "vitest";

import { PrismaOnboardingCompletionRepository } from "./prisma-onboarding-completion-repository.js";

describe("PrismaOnboardingCompletionRepository", () => {
  it("completes beginner onboarding without inventing legacy core competency states", async () => {
    const tx = {
      competencyCatalog: {
        findFirst: vi.fn(async () => ({ id: "catalog-1" })),
      },
      competency: {
        findMany: vi.fn(async () => [
          { id: "competency-root-1" },
          { id: "competency-root-2" },
        ]),
      },
      learningTrack: {
        update: vi.fn(async () => ({})),
      },
      learnerCompetencyState: {
        upsert: vi.fn(async () => ({})),
      },
    };
    const repository = new PrismaOnboardingCompletionRepository({
      $transaction: vi.fn(async (callback) => callback(tx)),
    } as never);

    await expect(
      repository.completeBeginnerOnboarding({
        learningTrackId: "track-1",
        targetLanguage: "en",
      }),
    ).resolves.toEqual({
      onboardingStatus: "completed",
      onboardingStep: null,
    });
    expect(tx.competencyCatalog.findFirst).toHaveBeenCalledWith({
      where: {
        targetLanguage: "en",
        status: "published",
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
      },
    });
    expect(tx.competency.findMany).not.toHaveBeenCalled();
    expect(tx.learningTrack.update).toHaveBeenCalledWith({
      where: {
        id: "track-1",
      },
      data: {
        competencyCatalogId: "catalog-1",
        onboardingStatus: "completed",
        onboardingStep: null,
      },
    });
    expect(tx.learnerCompetencyState.upsert).not.toHaveBeenCalled();
  });

  it("does not complete beginner onboarding when no published catalog exists", async () => {
    const tx = {
      competencyCatalog: {
        findFirst: vi.fn(async () => null),
      },
      competency: {
        findMany: vi.fn(),
      },
      learningTrack: {
        update: vi.fn(),
      },
      learnerCompetencyState: {
        upsert: vi.fn(),
      },
    };
    const repository = new PrismaOnboardingCompletionRepository({
      $transaction: vi.fn(async (callback) => callback(tx)),
    } as never);

    await expect(
      repository.completeBeginnerOnboarding({
        learningTrackId: "track-1",
        targetLanguage: "en",
      }),
    ).resolves.toBeNull();
    expect(tx.competency.findMany).not.toHaveBeenCalled();
    expect(tx.learningTrack.update).not.toHaveBeenCalled();
    expect(tx.learnerCompetencyState.upsert).not.toHaveBeenCalled();
  });

  it("completes diagnostic onboarding without republishing diagnostic evidence", async () => {
    const learningTrack = {
      update: vi.fn(async () => ({})),
    };
    const repository = new PrismaOnboardingCompletionRepository({
      learningTrack,
    } as never);

    await expect(
      repository.completeDiagnosticOnboarding({
        learningTrackId: "track-1",
        competencyCatalogId: "catalog-from-attempt",
      }),
    ).resolves.toEqual({
      onboardingStatus: "completed",
      onboardingStep: null,
    });
    expect(learningTrack.update).toHaveBeenCalledWith({
      where: {
        id: "track-1",
      },
      data: {
        competencyCatalogId: "catalog-from-attempt",
        onboardingStatus: "completed",
        onboardingStep: null,
      },
    });
  });
});
