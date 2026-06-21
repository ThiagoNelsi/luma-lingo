import { describe, expect, it, vi } from "vitest";

import {
  PrismaProfileIntroductionRepository,
  toProfileIntroductionProgress,
} from "./prisma-profile-introduction-repository.js";

const row = {
  status: "completed" as const,
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

  it("persists processing, completion, and failure transitions", async () => {
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
    expect(profileIntroduction.update).toHaveBeenCalledTimes(3);
  });

  it("fails pending work after process restart", async () => {
    const { repository } = createRepository();
    expect(await repository.failInterrupted()).toBe(2);
  });
});
