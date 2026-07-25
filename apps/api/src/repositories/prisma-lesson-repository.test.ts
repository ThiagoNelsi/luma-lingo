import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../observability/logger.js";
import { PrismaLessonRepository } from "./prisma-lesson-repository.js";

describe("PrismaLessonRepository", () => {
  it("logs a safe Prisma code, operation, latency, and technical correlation", async () => {
    const failure = Object.assign(new Error("database_unavailable"), {
      code: "P2024",
    });
    const error = vi.fn();
    const repository = new PrismaLessonRepository(
      {
        lesson: {
          findFirst: vi.fn(async () => {
            throw failure;
          }),
        },
      } as never,
      { error } as unknown as AppLogger,
    );

    await expect(repository.findHomeLesson("learner-1")).rejects.toThrow(
      "database_unavailable",
    );

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: expect.any(Number),
        errorMessage: "database_unavailable",
        event: "prisma.operation.failed",
        learnerId: "learner-1",
        operation: "lesson.find_home",
        prismaCode: "P2024",
        provider: "prisma",
        status: "failed",
      }),
      "Prisma operation failed",
    );
  });
});
