import { describe, expect, it, vi } from "vitest";

import type { StructuredModel } from "../models/structured-model.js";
import type { AppLogger } from "../observability/logger.js";
import type { LessonRepository } from "./lesson-repository.js";
import {
  LessonProductionService,
  type FirstLessonContext,
} from "./lesson-production-service.js";

describe("LessonProductionService", () => {
  it("states the current deterministic approval requirements in the versioned prompt", async () => {
    const start = vi.fn(async (input) => {
      if (input.workload === "lesson_plan") return completedRun(lessonPlan());
      const objective = (JSON.parse(input.input) as { objective: string })
        .objective;
      return completedRun(blockFor(objective));
    });
    const service = new LessonProductionService({
      moderator: moderatorStub(),
      repository: repositoryStub(),
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

    await service.produceFirstBlock(firstLessonInput());

    const request = start.mock.calls.find(
      ([candidate]) => candidate.workload === "lesson_plan",
    )?.[0];
    expect(request?.promptVersion).toBe("v2");
    expect(JSON.parse(request?.input ?? "{}")).toMatchObject({
      approvalRequirements: expect.arrayContaining([
        "Copy every requiredAlignment field exactly.",
        "Use only confirmed profile topics and copy declared topics exactly.",
        "Assign every selected Lesson emphasis to at least one block.",
      ]),
    });
  });

  it("moderates generated work and gives a pinned retry the rejection reason", async () => {
    const moderate = vi
      .fn()
      .mockResolvedValueOnce({
        flagged: true,
        flaggedCategories: ["hate"],
        model: "omni-moderation-latest",
        reference: "modr-1",
      })
      .mockResolvedValue({
        flagged: false,
        flaggedCategories: [],
        model: "omni-moderation-latest",
        reference: "modr-2",
      });
    const retry = vi.fn(async () => completedRun(lessonPlan()));
    const publishFirstBlock = vi.fn(async () => undefined);
    const service = new LessonProductionService({
      moderator: { moderate },
      repository: repositoryStub({ publishFirstBlock }),
      model: {
        async start(input) {
          if (input.workload === "lesson_plan")
            return completedRun(lessonPlan());
          const objective = (JSON.parse(input.input) as { objective: string })
            .objective;
          return completedRun(blockFor(objective));
        },
        retry,
        async inspect() {
          throw new Error("unused");
        },
      },
    });

    await service.produceFirstBlock(firstLessonInput());

    expect(moderate).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "lesson_plan" }),
    );
    expect(
      JSON.parse((moderate.mock.calls[0]?.[0] as { content: string }).content),
    ).toEqual(lessonPlan());
    expect(
      moderate.mock.calls
        .map(([input]) => input)
        .filter((input) => input.purpose === "lesson_plan")
        .map((input) => input.correlation?.attempt),
    ).toEqual([1, 2]);
    expect(retry).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.stringContaining('"reason":"unsafe_content"'),
      }),
      { adapter: "test", model: "test-model" },
    );
    expect(publishFirstBlock).toHaveBeenCalledOnce();
  });

  it("publishes the first block after a manual retry approves the second plan attempt", async () => {
    const publishFirstBlock = vi.fn(async () => undefined);
    const moderate = vi
      .fn()
      .mockResolvedValueOnce({
        flagged: true,
        flaggedCategories: ["violence"],
        model: "omni-moderation-latest",
        reference: "modr-rejected",
      })
      .mockResolvedValue({
        flagged: false,
        flaggedCategories: [],
        model: "omni-moderation-latest",
        reference: "modr-approved",
      });
    const service = new LessonProductionService({
      moderator: { moderate },
      repository: repositoryStub({
        async prepareLessonRetry() {
          return {
            lesson: firstLessonInput().lesson,
            context: firstLessonInput().context,
            plan: null,
            planAttempt: 7,
            blocks: [],
          };
        },
        async claimQueuedBlockRun(input) {
          return input.attempt === 8;
        },
        publishFirstBlock,
      }),
      model: {
        async start(input) {
          if (input.workload === "lesson_plan")
            return completedRun(lessonPlan());
          const objective = (JSON.parse(input.input) as { objective: string })
            .objective;
          return completedRun(blockFor(objective));
        },
        async retry() {
          return completedRun(lessonPlan());
        },
        async inspect() {
          throw new Error("unused");
        },
      },
    });

    await expect(
      service.retryFailedWork("learner-1", "lesson-1"),
    ).resolves.toBe(true);
    await vi.waitFor(() => expect(publishFirstBlock).toHaveBeenCalledOnce());
    expect(publishFirstBlock).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 8 }),
    );
  });

  it("logs the safe rejection reason and moderation categories when moderation rejects twice", async () => {
    const failLesson = vi.fn(async () => undefined);
    const error = vi.fn();
    const warn = vi.fn();
    const service = new LessonProductionService({
      moderator: {
        async moderate() {
          return {
            flagged: true,
            flaggedCategories: ["violence", "violence/graphic"],
            model: "omni-moderation-latest",
            reference: "modr-rejected",
          };
        },
      },
      repository: repositoryStub({ failLesson }),
      model: {
        async start() {
          return completedRun(lessonPlan());
        },
        async retry() {
          return completedRun(lessonPlan());
        },
        async inspect() {
          throw new Error("unused");
        },
      },
      logger: { error, warn } as unknown as AppLogger,
    });

    await service.produceFirstBlock(firstLessonInput());

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "moderation",
        errorCode: "lesson_content_moderation_rejected",
        flaggedCategories: ["violence", "violence/graphic"],
        rejectionReason: "unsafe_content",
      }),
      "First Lesson block generation failed",
    );
    expect(failLesson).toHaveBeenCalledWith(
      "lesson-1",
      "lesson_content_moderation_rejected",
    );
  });

  it("automatically retries a rejected run once through its pinned adapter and model", async () => {
    const retry = vi.fn(async () => completedRun(lessonPlan()));
    const failLesson = vi.fn(async () => undefined);
    const publishFirstBlock = vi.fn(async () => undefined);
    const service = new LessonProductionService({
      moderator: moderatorStub(),
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
      moderator: moderatorStub(),
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
      moderator: moderatorStub(),
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
      moderator: moderatorStub(),
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
      moderator: moderatorStub(),
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

  it("accepts a manual retry before generating only missing failed blocks in the background", async () => {
    const publishBlockRun = vi.fn(async () => undefined);
    let releaseGeneration: (() => void) | undefined;
    const generationPending = new Promise<void>((resolve) => {
      releaseGeneration = resolve;
    });
    const start = vi.fn(async (request) => {
      await generationPending;
      const objective = (JSON.parse(request.input) as { objective: string })
        .objective;
      return completedRun(blockFor(objective));
    });
    const service = new LessonProductionService({
      moderator: moderatorStub(),
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

    let accepted = false;
    const request = service
      .retryFailedWork("learner-1", "lesson-1")
      .then((result) => {
        accepted = result;
        return result;
      });
    await vi.waitFor(() => expect(start).toHaveBeenCalledOnce());
    await Promise.resolve();

    expect(accepted).toBe(true);
    await expect(request).resolves.toBe(true);
    expect(publishBlockRun).not.toHaveBeenCalled();

    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        correlation: expect.objectContaining({ attempt: 4 }),
        input: expect.stringContaining(
          lessonPlan().blocks[2]?.objective ?? "missing",
        ),
      }),
    );
    releaseGeneration?.();
    await vi.waitFor(() =>
      expect(publishBlockRun).toHaveBeenCalledWith(
        expect.objectContaining({ attempt: 4, blockPosition: 2 }),
      ),
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
      moderator: moderatorStub(),
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
      moderator: moderatorStub(),
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
      moderator: moderatorStub(),
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
      moderator: moderatorStub(),
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
      moderator: moderatorStub(),
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
      moderator: moderatorStub(),
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
    const service = new LessonProductionService({
      model,
      moderator: moderatorStub(),
      repository,
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
      moderator: moderatorStub(),
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
      moderator: moderatorStub(),
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

function moderatorStub() {
  return {
    async moderate() {
      return {
        flagged: false,
        flaggedCategories: [],
        model: "test-moderator",
        reference: "moderation-accepted",
      };
    },
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
