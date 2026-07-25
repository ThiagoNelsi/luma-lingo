import { describe, expect, it, vi } from "vitest";

import type { StructuredModel } from "../models/structured-model.js";
import type { AppLogger } from "../observability/logger.js";
import type { LessonRepository } from "./lesson-repository.js";
import { LessonProductionService } from "./lesson-production-service.js";

describe("LessonProductionService", () => {
  it("submits the remaining independent blocks with bounded concurrency", async () => {
    let activeBackgroundRuns = 0;
    let maximumBackgroundRuns = 0;
    const publishedPositions: number[] = [];
    const service = new LessonProductionService({
      concurrencyLimit: 2,
      repository: repositoryStub({
        async publishBlockRun(input) {
          publishedPositions.push(input.blockPosition);
        },
      }),
      model: {
        async start(input) {
          if (input.workload === "lesson_plan")
            return completedRun(lessonPlan());
          const objective = (JSON.parse(input.input) as { objective: string })
            .objective;
          if (objective === lessonPlan().blocks[0]?.objective) {
            return completedRun(blockFor(objective));
          }
          activeBackgroundRuns += 1;
          maximumBackgroundRuns = Math.max(
            maximumBackgroundRuns,
            activeBackgroundRuns,
          );
          await new Promise((resolve) => setTimeout(resolve, 5));
          activeBackgroundRuns -= 1;
          return completedRun(blockFor(objective));
        },
        async inspect() {
          throw new Error("unused");
        },
      },
    });

    await service.produceFirstBlock(firstLessonInput());
    await vi.waitFor(() => expect(publishedPositions).toEqual([1, 2]));

    expect(maximumBackgroundRuns).toBe(2);
  });

  it("reconciles an active provider run after an API restart", async () => {
    const publishBlockRun = vi.fn(async () => undefined);
    const service = new LessonProductionService({
      repository: repositoryStub({
        async findActiveBlockRuns() {
          return [
            {
              attempt: 1,
              blockPosition: 1,
              lessonId: "lesson-1",
              plan: lessonPlan(),
              context: firstLessonInput().context,
              run: {
                adapter: "test",
                model: "test-model",
                reference: "pending-run-1",
                status: "pending",
              },
            },
          ];
        },
        publishBlockRun,
      }),
      model: {
        async start() {
          throw new Error("unused");
        },
        async inspect() {
          return completedRun(
            blockFor(lessonPlan().blocks[1]?.objective ?? ""),
          );
        },
      },
    });

    await service.recoverInterrupted();

    expect(publishBlockRun).toHaveBeenCalledWith(
      expect.objectContaining({ blockPosition: 1, lessonId: "lesson-1" }),
    );
  });

  it("publishes a validated first cohesive block for the reserved lesson", async () => {
    const saved: unknown[] = [];
    const repository: LessonRepository = {
      async findHomeLesson() {
        return null;
      },
      async findLessonProgress() {
        return null;
      },
      async reserveFirstLesson() {
        throw new Error("unused");
      },
      async retryFailedFirstLesson() {
        return null;
      },
      async publishFirstBlock(input) {
        saved.push(input);
      },
      async persistBlockRun() {
        return undefined;
      },
      async claimQueuedBlockRun() {
        return true;
      },
      async publishBlockRun() {
        return undefined;
      },
      async findActiveBlockRuns() {
        return [];
      },
      async failLesson() {
        throw new Error("unused");
      },
    };
    const model: StructuredModel = {
      async start(input) {
        if (input.contract.name === "lesson_plan") {
          return completedRun(lessonPlan());
        }

        return completedRun({
          title: "Your first greeting",
          objective: "Say hello and share your name.",
          explanation:
            "Use Hello to greet someone. Say My name is before your name.",
          examples: [
            {
              target: "Hello! My name is Ana.",
              instruction: "Olá! Meu nome é Ana.",
            },
          ],
          activities: [
            {
              type: "multiple_choice",
              prompt: "Choose the greeting.",
              options: ["Hello!", "Thank you."],
              correctOptionIndex: 0,
              explanation: "Hello is a greeting.",
            },
          ],
        });
      },
      async inspect() {
        throw new Error("unused");
      },
    };
    const service = new LessonProductionService({ model, repository });

    await service.produceFirstBlock({
      lesson: {
        id: "lesson-1",
        learningTrackId: "track-1",
        moduleId: "module-1",
        priorityCompetencyId: "competency-1",
      },
      context: {
        instructionLanguage: "Portuguese",
        targetLanguage: "English",
        primaryGoal: "travel",
        lessonEmphases: ["reading"],
        priorityCompetencyKey: "introduce-yourself",
      },
    });

    expect(saved).toEqual([
      expect.objectContaining({
        lessonId: "lesson-1",
        plan: expect.objectContaining({ title: "Greetings for travel" }),
        block: expect.objectContaining({
          explanation:
            "Use Hello to greet someone. Say My name is before your name.",
          activities: [expect.objectContaining({ type: "multiple_choice" })],
        }),
      }),
    ]);
  });

  it("logs a safe correlated error before marking a failed generation", async () => {
    const failLesson = vi.fn(async () => undefined);
    const error = vi.fn();
    const repository: LessonRepository = {
      async findHomeLesson() {
        return null;
      },
      async findLessonProgress() {
        return null;
      },
      async reserveFirstLesson() {
        throw new Error("unused");
      },
      async retryFailedFirstLesson() {
        return null;
      },
      async publishFirstBlock() {
        throw new Error("unused");
      },
      async persistBlockRun() {
        return undefined;
      },
      async claimQueuedBlockRun() {
        return true;
      },
      async publishBlockRun() {
        return undefined;
      },
      async findActiveBlockRuns() {
        return [];
      },
      failLesson,
    };
    const service = new LessonProductionService({
      repository,
      model: {
        async start() {
          throw new Error("openai_request_failed");
        },
        async inspect() {
          throw new Error("unused");
        },
      },
      logger: { error } as unknown as AppLogger,
    });

    await service.produceFirstBlock({
      lesson: {
        id: "lesson-1",
        learningTrackId: "track-1",
        moduleId: "module-1",
        priorityCompetencyId: "competency-1",
      },
      context: {
        instructionLanguage: "Portuguese",
        targetLanguage: "English",
        primaryGoal: "travel",
        lessonEmphases: ["reading"],
        priorityCompetencyKey: "introduce-yourself",
      },
      correlationId: "request-1",
      attempt: 2,
    });

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 2,
        category: "provider",
        errorCode: "openai_request_failed",
        event: "lesson_generation.first_block_failed",
        lessonId: "lesson-1",
        requestId: "request-1",
        stage: "lesson_plan",
      }),
      "First Lesson block generation failed",
    );
    expect(failLesson).toHaveBeenCalledWith(
      "lesson-1",
      "openai_request_failed",
    );
  });
});

function repositoryStub(
  overrides: Partial<LessonRepository> = {},
): LessonRepository {
  return {
    async findHomeLesson() {
      return null;
    },
    async findLessonProgress() {
      return null;
    },
    async reserveFirstLesson() {
      throw new Error("unused");
    },
    async retryFailedFirstLesson() {
      return null;
    },
    async publishFirstBlock() {
      return undefined;
    },
    async persistBlockRun() {
      return undefined;
    },
    async claimQueuedBlockRun() {
      return true;
    },
    async publishBlockRun() {
      return undefined;
    },
    async findActiveBlockRuns() {
      return [];
    },
    async failLesson() {
      return undefined;
    },
    ...overrides,
  };
}

function firstLessonInput() {
  return {
    lesson: {
      id: "lesson-1",
      learningTrackId: "track-1",
      moduleId: "module-1",
      priorityCompetencyId: "competency-1",
    },
    context: {
      instructionLanguage: "Portuguese",
      targetLanguage: "English",
      primaryGoal: "travel",
      lessonEmphases: ["reading"],
      priorityCompetencyKey: "introduce-yourself",
    },
  };
}

function lessonPlan() {
  return {
    title: "Greetings for travel",
    objective: "Introduce yourself politely when arriving somewhere.",
    blocks: [
      {
        objective: "Say hello and share your name.",
        title: "Your first greeting",
      },
      { objective: "Ask another person's name.", title: "Ask a name" },
      {
        objective: "End a short introduction politely.",
        title: "Finish politely",
      },
    ],
  };
}

function blockFor(objective: string) {
  return {
    title: "Your first greeting",
    objective,
    explanation: "Use Hello to greet someone. Say My name is before your name.",
    examples: [
      {
        target: "Hello! My name is Ana.",
        instruction: "Olá! Meu nome é Ana.",
      },
    ],
    activities: [
      {
        type: "multiple_choice",
        prompt: "Choose the greeting.",
        options: ["Hello!", "Thank you."],
        correctOptionIndex: 0,
        explanation: "Hello is a greeting.",
      },
    ],
  };
}

function completedRun(output: unknown) {
  return {
    adapter: "test",
    model: "test-model",
    status: "completed" as const,
    reference: "provider-run-1",
    output: JSON.stringify(output),
  };
}
