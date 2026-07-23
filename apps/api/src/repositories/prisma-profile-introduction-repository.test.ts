import { describe, expect, it, vi } from "vitest";

import {
  PrismaProfileIntroductionRepository,
  toProfileIntroductionProgress,
} from "./prisma-profile-introduction-repository.js";

const row = {
  status: "completed" as const,
  confirmedAt: null,
  attempts: 1,
  errorCode: null,
  jobOrField: "Design",
  interests: ["cinema"],
  dailyRoutine: [],
  studyContext: null,
  other: [],
};

function createRepository() {
  const profileIntroduction = {
    findUnique: vi.fn(async () => row),
    upsert: vi.fn(async ({ create }: { create: object }) => ({
      ...row,
      ...create,
    })),
    update: vi.fn(async () => row),
    updateMany: vi.fn(async () => ({ count: 2 })),
  };
  return {
    repository: new PrismaProfileIntroductionRepository({
      profileIntroduction,
    } as never),
    profileIntroduction,
  };
}

describe("PrismaProfileIntroductionRepository", () => {
  it("maps absent and completed records", () => {
    expect(toProfileIntroductionProgress(null).status).toBe("not_started");
    expect(toProfileIntroductionProgress(row).profile?.jobOrField).toBe(
      "Design",
    );
  });

  it("reads progress", async () => {
    const { repository } = createRepository();
    expect((await repository.get("learner-1")).status).toBe("completed");
  });

  it("upserts pending and manual fallback states", async () => {
    const { repository, profileIntroduction } = createRepository();
    await repository.markPending("learner-1");
    await repository.markManualRequired("learner-1");
    expect(profileIntroduction.upsert).toHaveBeenCalledTimes(2);
  });

  it("does not let worker transitions replace a confirmed profile", async () => {
    const { repository, profileIntroduction } = createRepository();
    await repository.markProcessing("learner-1", 1);
    await repository.markCompleted("learner-1", {
      jobOrField: null,
      interests: [],
      dailyRoutine: [],
      studyContext: null,
      other: [],
    });
    await repository.markFailed("learner-1", "failed");
    expect(profileIntroduction.update).not.toHaveBeenCalled();
    expect(profileIntroduction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { learnerId: "learner-1", confirmedAt: null },
        data: expect.objectContaining({ status: "processing" }),
      }),
    );
    expect(profileIntroduction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { learnerId: "learner-1", confirmedAt: null },
        data: expect.objectContaining({ status: "completed" }),
      }),
    );
    expect(profileIntroduction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { learnerId: "learner-1", confirmedAt: null },
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
  });

  it("persists a final confirmed profile", async () => {
    const { repository, profileIntroduction } = createRepository();
    await repository.confirmProfile("learner-1", {
      jobOrField: "Professora",
      interests: ["cinema"],
      dailyRoutine: [],
      studyContext: null,
      other: [],
    });

    expect(profileIntroduction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          status: "completed",
          jobOrField: "Professora",
          confirmedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("fails pending work after process restart", async () => {
    const { repository, profileIntroduction } = createRepository();
    expect(await repository.failInterrupted()).toBe(2);
    expect(profileIntroduction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ confirmedAt: null }),
      }),
    );
  });
});
