import { describe, expect, it, vi } from "vitest";

import type { StructuredModel } from "../models/structured-model.js";
import type { AppLogger } from "../observability/logger.js";
import type { LessonRepository } from "./lesson-repository.js";
import {
  LessonProductionService,
  type FirstLessonContext,
} from "./lesson-production-service.js";

describe("LessonProductionService", () => {
  it("automatically retries a rejected run once through its pinned adapter and model", async () => {
    const retry = vi.fn(async () => completedRun(lessonPlan()));
    const failLesson = vi.fn(async () => undefined);
    const publishFirstBlock = vi.fn(async () => undefined);
    const service = new LessonProductionService({
      repository: repositoryStub({ failLesson, publishFirstBlock }),
      model: {
        async start(input) {
          if (input.workload === "lesson_plan") {
            return {
              adapter: "test-adapter",
              model: "pinned-model",
              status: "failed",
              reference: "refusal-1",
              errorCode: "provider_refusal",
            };
          }
          return completedRun(
            blockFor(lessonPlan().blocks[0]?.objective ?? ""),
          );
        },
        retry,
        async inspect() {
          throw new Error("unused");
        },
      },
    });

    await service.produceFirstBlock(firstLessonInput());

    expect(retry).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledWith(
      expect.objectContaining({
        correlation: expect.objectContaining({ attempt: 2 }),
        workload: "lesson_plan",
      }),
      { adapter: "test-adapter", model: "pinned-model" },
    );
    expect(publishFirstBlock).toHaveBeenCalledOnce();
    expect(failLesson).not.toHaveBeenCalled();
  });

  it("persists the validated immutable plan before a block can exhaust its retries", async () => {
    const persistPlanRun = vi.fn(async () => undefined);
    const failLesson = vi.fn(async () => undefined);
    const service = new LessonProductionService({
      repository: repositoryStub({ persistPlanRun, failLesson }),
      model: {
        async start(input) {
          if (input.workload === "lesson_plan")
            return completedRun(lessonPlan());
          return {
            adapter: "test",
            model: "test-model",
            status: "failed",
            reference: "failed-block-1",
            errorCode: "provider_refusal",
          };
        },
        async retry() {
          return {
            adapter: "test",
            model: "test-model",
            status: "failed",
            reference: "failed-block-2",
            errorCode: "provider_refusal",
          };
        },
        async inspect() {
          throw new Error("unused");
        },
      },
    });

    await service.produceFirstBlock(firstLessonInput());

    expect(persistPlanRun).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        lessonId: "lesson-1",
        plan: lessonPlan(),
      }),
    );
    expect(failLesson).toHaveBeenCalledWith("lesson-1", "provider_refusal");
  });

  it("persists a pending plan without retrying or failing the lesson", async () => {
    const persistPlanRun = vi.fn(async () => undefined);
    const failLesson = vi.fn(async () => undefined);
    const retry = vi.fn();
    const service = new LessonProductionService({
      repository: repositoryStub({ persistPlanRun, failLesson }),
      model: {
        async start() {
          return {
            adapter: "test",
            model: "pinned-model",
            status: "pending",
            reference: "pending-plan-1",
          };
        },
        retry,
        async inspect() {
          throw new Error("unused");
        },
      },
    });

    await service.produceFirstBlock(firstLessonInput());

    expect(persistPlanRun).toHaveBeenCalledWith({
      attempt: 1,
      lessonId: "lesson-1",
      run: expect.objectContaining({
        reference: "pending-plan-1",
        status: "pending",
      }),
    });
    expect(retry).not.toHaveBeenCalled();
    expect(failLesson).not.toHaveBeenCalled();
  });

  it("persists a pending block without retrying or failing the lesson", async () => {
    const persistBlockRun = vi.fn(async () => undefined);
    const failLesson = vi.fn(async () => undefined);
    const retry = vi.fn();
    const service = new LessonProductionService({
      repository: repositoryStub({ persistBlockRun, failLesson }),
      model: {
        async start(input) {
          if (input.workload === "lesson_plan")
            return completedRun(lessonPlan());
          return {
            adapter: "test",
            model: "pinned-model",
            status: "pending",
            reference: "pending-block-1",
          };
        },
        retry,
        async inspect() {
          throw new Error("unused");
        },
      },
    });

    await service.produceFirstBlock(firstLessonInput());

    expect(persistBlockRun).toHaveBeenCalledWith({
      attempt: 1,
      blockPosition: 0,
      lessonId: "lesson-1",
      run: expect.objectContaining({
        reference: "pending-block-1",
        status: "pending",
      }),
    });
    expect(retry).not.toHaveBeenCalled();
    expect(failLesson).not.toHaveBeenCalled();
  });

  it("retries a rejected background block once and publishes only the accepted attempt", async () => {
    const persistBlockRun = vi.fn(async () => undefined);
    const publishBlockRun = vi.fn(async () => undefined);
    const retry = vi.fn(async (request) => {
      const objective = (JSON.parse(request.input) as { objective: string })
        .objective;
      return completedRun(blockFor(objective));
    });
    const service = new LessonProductionService({
      repository: repositoryStub({ persistBlockRun, publishBlockRun }),
      model: {
        async start(input) {
          if (input.workload === "lesson_plan")
            return completedRun(lessonPlan());
          const objective = (JSON.parse(input.input) as { objective: string })
            .objective;
          if (objective === lessonPlan().blocks[1]?.objective) {
            return {
              adapter: "test",
              model: "pinned-model",
              status: "failed",
              reference: "refused-background-1",
              errorCode: "provider_refusal",
            };
          }
          return completedRun(blockFor(objective));
        },
        retry,
        async inspect() {
          throw new Error("unused");
        },
      },
    });

    await service.produceFirstBlock(firstLessonInput());
    await vi.waitFor(() =>
      expect(publishBlockRun).toHaveBeenCalledWith(
        expect.objectContaining({ attempt: 2, blockPosition: 1 }),
      ),
    );

    expect(persistBlockRun).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        blockPosition: 1,
        run: expect.objectContaining({
          errorCode: "provider_refusal",
          status: "failed",
        }),
      }),
    );
    expect(retry).toHaveBeenCalledWith(
      expect.objectContaining({
        correlation: expect.objectContaining({ attempt: 2 }),
      }),
      { adapter: "test", model: "pinned-model" },
    );
  });

  it("manually retries only missing failed blocks through the current route", async () => {
    const publishBlockRun = vi.fn(async () => undefined);
    const start = vi.fn(async (request) => {
      const objective = (JSON.parse(request.input) as { objective: string })
        .objective;
      return completedRun(blockFor(objective));
    });
    const service = new LessonProductionService({
      repository: repositoryStub({
        async prepareLessonRetry() {
          return {
            lesson: firstLessonInput().lesson,
            context: firstLessonInput().context,
            plan: lessonPlan(),
            planAttempt: 3,
            blocks: [{ attempt: 4, blockPosition: 2 }],
          };
        },
        publishBlockRun,
      }),
      model: {
        start,
        async retry() {
          throw new Error("unused");
        },
        async inspect() {
          throw new Error("unused");
        },
      },
    });

    await expect(
      service.retryFailedWork("learner-1", "lesson-1"),
    ).resolves.toBe(true);

    expect(start).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        correlation: expect.objectContaining({ attempt: 4 }),
        input: expect.stringContaining(
          lessonPlan().blocks[2]?.objective ?? "missing",
        ),
      }),
    );
    expect(publishBlockRun).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 4, blockPosition: 2 }),
    );
  });

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
        async retry() {
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
        async retry() {
          throw new Error("unused");
        },
      },
    });

    await service.recoverInterrupted();

    expect(publishBlockRun).toHaveBeenCalledWith(
      expect.objectContaining({ blockPosition: 1, lessonId: "lesson-1" }),
    );
  });

  it("reconciles a pending plan after restart and continues with its first block", async () => {
    const persistPlanRun = vi.fn(async () => undefined);
    const publishFirstBlock = vi.fn(async () => undefined);
    const service = new LessonProductionService({
      repository: repositoryStub({
        async findActivePlanRuns() {
          return [
            {
              attempt: 1,
              context: firstLessonInput().context,
              lesson: firstLessonInput().lesson,
              run: {
                adapter: "test",
                model: "pinned-model",
                reference: "pending-plan-1",
                status: "pending",
              },
            },
          ];
        },
        persistPlanRun,
        publishFirstBlock,
      }),
      model: {
        async start(input) {
          const objective = (JSON.parse(input.input) as { objective: string })
            .objective;
          return completedRun(blockFor(objective));
        },
        async inspect() {
          return completedRun(lessonPlan());
        },
        async retry() {
          throw new Error("unused");
        },
      },
    });

    await service.recoverInterrupted();

    expect(persistPlanRun).toHaveBeenCalledWith(
      expect.objectContaining({ lessonId: "lesson-1", plan: lessonPlan() }),
    );
    expect(publishFirstBlock).toHaveBeenCalledOnce();
  });

  it("keeps an inspected provider run pending without creating a duplicate", async () => {
    const persistBlockRun = vi.fn(async () => undefined);
    const retry = vi.fn();
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
                model: "pinned-model",
                reference: "pending-run-1",
                status: "pending",
              },
            },
          ];
        },
        persistBlockRun,
      }),
      model: {
        async start() {
          throw new Error("unused");
        },
        async inspect() {
          return {
            adapter: "test",
            model: "pinned-model",
            reference: "pending-run-1",
            status: "pending",
          };
        },
        retry,
      },
    });

    await service.recoverInterrupted();

    expect(persistBlockRun).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        blockPosition: 1,
        run: expect.objectContaining({ status: "pending" }),
      }),
    );
    expect(retry).not.toHaveBeenCalled();
  });

  it("regenerates an interrupted rejected run once through its original route", async () => {
    const persistBlockRun = vi.fn(async () => undefined);
    const publishBlockRun = vi.fn(async () => undefined);
    const retry = vi.fn(async () =>
      completedRun(blockFor(lessonPlan().blocks[1]?.objective ?? "")),
    );
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
                model: "pinned-model",
                reference: "pending-run-1",
                status: "pending",
              },
            },
          ];
        },
        persistBlockRun,
        publishBlockRun,
      }),
      model: {
        async start() {
          throw new Error("unused");
        },
        retry,
        async inspect() {
          return {
            adapter: "test",
            model: "pinned-model",
            reference: "pending-run-1",
            status: "failed",
            errorCode: "provider_interrupted",
          };
        },
      },
    });

    await service.recoverInterrupted();

    expect(persistBlockRun).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        run: expect.objectContaining({
          errorCode: "provider_interrupted",
          status: "failed",
        }),
      }),
    );
    expect(retry).toHaveBeenCalledWith(
      expect.objectContaining({
        correlation: expect.objectContaining({ attempt: 2 }),
      }),
      { adapter: "test", model: "pinned-model" },
    );
    expect(publishBlockRun).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 2, blockPosition: 1 }),
    );
  });

  it("marks the Lesson recoverably failed when its interrupted first block exhausts retry", async () => {
    const failLesson = vi.fn(async () => undefined);
    const service = new LessonProductionService({
      repository: repositoryStub({
        async findActiveBlockRuns() {
          return [
            {
              attempt: 1,
              blockPosition: 0,
              lessonId: "lesson-1",
              plan: lessonPlan(),
              context: firstLessonInput().context,
              run: {
                adapter: "test",
                model: "pinned-model",
                reference: "pending-run-1",
                status: "pending",
              },
            },
          ];
        },
        failLesson,
      }),
      model: {
        async start() {
          throw new Error("unused");
        },
        async inspect() {
          return {
            adapter: "test",
            model: "pinned-model",
            reference: "pending-run-1",
            status: "failed",
            errorCode: "provider_interrupted",
          };
        },
        async retry() {
          return {
            adapter: "test",
            model: "pinned-model",
            reference: "retry-run-2",
            status: "failed",
            errorCode: "provider_refusal",
          };
        },
      },
    });

    await service.recoverInterrupted();

    expect(failLesson).toHaveBeenCalledWith("lesson-1", "provider_refusal");
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
      async publishFirstBlock(input) {
        saved.push(input);
      },
      async persistPlanRun() {
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
      async findActivePlanRuns() {
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
      async retry() {
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
      async publishFirstBlock() {
        throw new Error("unused");
      },
      async persistPlanRun() {
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
      async findActivePlanRuns() {
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
        async retry() {
          throw new Error("openai_request_failed");
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

  it("fails malformed provider content with a stable safe code", async () => {
    const failLesson = vi.fn(async () => undefined);
    const service = new LessonProductionService({
      repository: repositoryStub({ failLesson }),
      model: {
        async start(input) {
          if (input.workload === "lesson_plan")
            return completedRun(lessonPlan());
          return completedRun({
            ...blockFor(lessonPlan().blocks[0]?.objective ?? ""),
            examples: Array.from({ length: 6 }, () => ({
              target: "Hello!",
              instruction: "Olá!",
            })),
          });
        },
        async inspect() {
          throw new Error("unused");
        },
        async retry() {
          return completedRun({
            ...blockFor(lessonPlan().blocks[0]?.objective ?? ""),
            examples: Array.from({ length: 6 }, () => ({
              target: "Hello!",
              instruction: "Olá!",
            })),
          });
        },
      },
    });

    await service.produceFirstBlock(firstLessonInput());

    expect(failLesson).toHaveBeenCalledWith(
      "lesson-1",
      "lesson_content_invalid",
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
    async publishFirstBlock() {
      return undefined;
    },
    async persistPlanRun() {
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
    async findActivePlanRuns() {
      return [];
    },
    async failLesson() {
      return undefined;
    },
    ...overrides,
  };
}

function firstLessonInput(): {
  lesson: {
    id: string;
    learningTrackId: string;
    moduleId: string;
    priorityCompetencyId: string;
  };
  context: FirstLessonContext;
} {
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
      learnerAgeRange: "25-39",
      profileTopics: [],
      competencyProfile: [],
    },
  };
}

function lessonPlan(): import("./lesson-content.js").LessonPlan {
  return {
    title: "Greetings for travel",
    objective: "Introduce yourself politely when arriving somewhere.",
    alignment: {
      instructionLanguage: "Portuguese",
      targetLanguage: "English",
      primaryGoal: "travel",
      priorityCompetencyKey: "introduce-yourself",
      priorityCompetencyState: null,
      lessonEmphases: ["reading"],
      profileTopics: [],
    },
    blocks: [
      {
        objective: "Say hello and share your name.",
        title: "Your first greeting",
        emphasis: "reading",
      },
      {
        objective: "Ask another person's name.",
        title: "Ask a name",
        emphasis: "reading",
      },
      {
        objective: "End a short introduction politely.",
        title: "Finish politely",
        emphasis: "reading",
      },
    ],
  };
}

function blockFor(objective: string) {
  const title =
    lessonPlan().blocks.find((candidate) => candidate.objective === objective)
      ?.title ?? "Your first greeting";
  return {
    title,
    objective,
    explanation: `${objective} Use Hello to greet someone. Say My name is before your name.`,
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
