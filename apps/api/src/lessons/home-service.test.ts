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
      async retryFailedFirstLesson() {
        return null;
      },
      async publishFirstBlock() {
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
    } as Pick<LessonProductionService, "produceFirstBlock">;
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

  it("restarts a failed first lesson only once under concurrent Home requests", async () => {
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
      async retryFailedFirstLesson() {
        if (status !== "failed") return null;
        status = "preparing";
        return {
          lesson: { id: "lesson-1", status: "preparing", block: null },
          created: true,
          production: {
            moduleId: "module-1",
            learningTrackId: "track-1",
            priorityCompetencyId: "competency-1",
          },
          priorityCompetencyKey: "introduce-yourself",
        };
      },
      async publishFirstBlock() {
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
      Promise.all([
        service.getHome({ ...homeInput(), correlationId: "request-1" }),
        service.getHome({ ...homeInput(), correlationId: "request-2" }),
      ]),
    ).resolves.toEqual([
      { status: "preparing", lessonId: "lesson-1" },
      { status: "preparing", lessonId: "lesson-1" },
    ]);
    expect(productionCalls).toBe(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 2,
        event: "first_lesson.generation_retrying",
        lessonId: "lesson-1",
        requestId: expect.stringMatching(/^request-/),
      }),
      "First Lesson generation retrying",
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
