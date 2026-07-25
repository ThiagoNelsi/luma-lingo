import { describe, expect, it, vi } from "vitest";

import type { InitialLearningPriorityRepository } from "../learning/initial-learning-priority-repository.js";
import type { AppLogger } from "../observability/logger.js";
import type { LessonProductionService } from "./lesson-production-service.js";
import type { LessonRepository } from "./lesson-repository.js";
import { HomeService } from "./home-service.js";

describe("HomeService", () => {
  it("reserves one first lesson and starts production only once under concurrent requests", async () => {
    let lesson: {
      id: string;
      status: "preparing" | "ready" | "failed";
      block: null;
    } | null = null;
    let productionCalls = 0;
    const repository: LessonRepository = {
      async findHomeLesson() {
        return lesson;
      },
      async findLessonProgress() {
        return null;
      },
      async reserveFirstLesson() {
        const production = {
          moduleId: "module-1",
          learningTrackId: "track-1",
          priorityCompetencyId: "competency-1",
        };
        if (lesson) return { lesson, created: false, production };
        lesson = { id: "lesson-1", status: "preparing", block: null };
        return { lesson, created: true, production };
      },
      async publishFirstBlock() {
        throw new Error("unused");
      },
      async persistPlanRun() {
        throw new Error("unused");
      },
      async persistBlockRun() {
        throw new Error("unused");
      },
      async claimQueuedBlockRun() {
        return true;
      },
      async publishBlockRun() {
        throw new Error("unused");
      },
      async findActiveBlockRuns() {
        return [];
      },
      async findActivePlanRuns() {
        return [];
      },
      async failLesson() {
        throw new Error("unused");
      },
    };
    const priorities: InitialLearningPriorityRepository = {
      async findInitialLearningPriority() {
        return {
          competencyId: "competency-1",
          competencyKey: "introduce-yourself",
          score: 1,
          readiness: 1,
          foundationWeight: 100,
          basePriority: 100,
          goalFit: 100,
          knowledgeGap: 1,
          uncertainty: 1,
          reviewNeed: 0,
          recentRepetition: 0,
          selectionReason: "beginner_a1_fallback",
        };
      },
    };
    const production = {
      async produceFirstBlock() {
        productionCalls += 1;
      },
      async retryFailedWork() {
        throw new Error("unused");
      },
    } as Pick<LessonProductionService, "produceFirstBlock" | "retryFailedWork">;
    const service = new HomeService({
      lessons: repository,
      priorities,
      production,
      foregroundBudgetMs: 0,
    });
    const input = {
      learnerId: "learner-1",
      instructionLanguage: "Portuguese",
      learningTrack: {
        id: "track-1",
        targetLanguage: "English",
        learningGoal: "travel",
        lessonEmphases: ["reading"],
        onboardingStartingPoint: "beginner" as const,
        onboardingStatus: "completed" as const,
      },
    };

    const [first, second] = await Promise.all([
      service.getHome(input),
      service.getHome(input),
    ]);

    expect(first).toEqual({ status: "preparing", lessonId: "lesson-1" });
    expect(second).toEqual({ status: "preparing", lessonId: "lesson-1" });
    expect(productionCalls).toBe(1);
  });

  it("keeps failed Home reads side-effect free and retries only after an explicit request", async () => {
    let productionCalls = 0;
    let status: "preparing" | "ready" | "failed" = "failed";
    const warn = vi.fn();
    const repository: LessonRepository = {
      async findHomeLesson() {
        return { id: "lesson-1", status, block: null };
      },
      async findLessonProgress() {
        return null;
      },
      async reserveFirstLesson() {
        throw new Error("unused");
      },
      async publishFirstBlock() {
        throw new Error("unused");
      },
      async persistPlanRun() {
        throw new Error("unused");
      },
      async persistBlockRun() {
        throw new Error("unused");
      },
      async claimQueuedBlockRun() {
        return true;
      },
      async publishBlockRun() {
        throw new Error("unused");
      },
      async findActiveBlockRuns() {
        return [];
      },
      async findActivePlanRuns() {
        return [];
      },
      async failLesson() {
        throw new Error("unused");
      },
    };
    const service = new HomeService({
      lessons: repository,
      priorities: {
        async findInitialLearningPriority() {
          throw new Error("unused");
        },
      },
      production: {
        async produceFirstBlock() {
          productionCalls += 1;
        },
        async retryFailedWork() {
          productionCalls += 1;
          return true;
        },
      },
      foregroundBudgetMs: 0,
      logger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn,
      } as unknown as AppLogger,
    });

    await expect(
      service.getHome({ ...homeInput(), correlationId: "request-1" }),
    ).resolves.toEqual({ status: "failed", lessonId: "lesson-1" });
    expect(productionCalls).toBe(0);

    await expect(
      service.retryLesson("learner-1", "lesson-1", "request-2"),
    ).resolves.toBe(true);
    expect(productionCalls).toBe(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "lesson_generation.manual_retry_requested",
        lessonId: "lesson-1",
        requestId: "request-2",
      }),
      "Lesson generation manual retry requested",
    );
  });
});

function homeInput() {
  return {
    learnerId: "learner-1",
    instructionLanguage: "Portuguese",
    learningTrack: {
      id: "track-1",
      targetLanguage: "English",
      learningGoal: "travel",
      lessonEmphases: ["reading"],
      onboardingStartingPoint: "beginner" as const,
      onboardingStatus: "completed" as const,
    },
  };
}
