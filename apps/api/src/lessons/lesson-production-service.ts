import type {
  StructuredModel,
  StructuredModelRun,
} from "../models/structured-model.js";
import {
  createSilentLogger,
  errorMetadata,
  type AppLogger,
} from "../observability/logger.js";
import {
  lessonBlockContract,
  lessonBlockSchema,
  lessonPlanContract,
  lessonPlanSchema,
  type LessonBlock,
  type LessonPlan,
} from "./lesson-content.js";
import type { LessonRepository } from "./lesson-repository.js";

export interface FirstLessonContext {
  instructionLanguage: string;
  targetLanguage: string;
  primaryGoal: string;
  lessonEmphases: string[];
  priorityCompetencyKey: string;
}

export interface ReservedFirstLesson {
  id: string;
  learningTrackId: string;
  moduleId: string;
  priorityCompetencyId: string;
}

export class LessonProductionService {
  private readonly logger: AppLogger;
  private readonly concurrencyLimit: number;

  constructor(
    private readonly deps: {
      model: StructuredModel;
      repository: LessonRepository;
      concurrencyLimit?: number;
      logger?: AppLogger;
    },
  ) {
    this.logger = deps.logger ?? createSilentLogger();
    this.concurrencyLimit = deps.concurrencyLimit ?? 4;
  }

  async produceFirstBlock(input: {
    lesson: ReservedFirstLesson;
    context: FirstLessonContext;
    correlationId?: string;
    attempt?: number;
  }): Promise<void> {
    const startedAt = performance.now();
    const attempt = input.attempt ?? 1;
    let stage: "lesson_plan" | "lesson_block" | "persistence" = "lesson_plan";
    try {
      const planRun = await this.startRun({
        correlation: correlation(input, attempt),
        contract: lessonPlanContract,
        workload: "lesson_plan",
        instructions:
          "Produce a concise, safe language lesson plan with three to five cohesive blocks. Return JSON only.",
        input: planPrompt(input.context),
      });
      const plan = parseCompletedRun(planRun, lessonPlanSchema);

      stage = "lesson_block";
      const firstPlanBlock = plan.blocks[0];
      if (!firstPlanBlock) throw new Error("lesson_plan_without_block");
      const blockRun = await this.startRun({
        correlation: correlation(input, attempt),
        contract: lessonBlockContract,
        workload: "lesson_block",
        instructions:
          "Produce one cohesive text lesson block with explanation, one to five examples, and one to five activities. Match the supplied objective exactly. Return JSON only.",
        input: blockPrompt(input.context, plan, firstPlanBlock.objective),
      });
      const block = parseCompletedRun(blockRun, lessonBlockSchema);
      validateSemantics(plan, block, firstPlanBlock.objective);

      stage = "persistence";
      await this.deps.repository.publishFirstBlock({
        attempt,
        lessonId: input.lesson.id,
        plan,
        block,
        runs: { plan: planRun, block: blockRun },
      });
      this.logger.info(
        {
          ...lessonLogFields(
            input,
            attempt,
            "lesson_generation.first_block_completed",
          ),
          durationMs: Math.round(performance.now() - startedAt),
        },
        "First Lesson block generation completed",
      );
      void this.produceRemainingBlocks({ input, plan, attempt }).catch(
        (error) => {
          this.logger.error(
            {
              ...lessonLogFields(
                input,
                attempt,
                "lesson_generation.background_scheduling_failed",
              ),
              err: errorMetadata(error),
              ...errorMetadata(error),
            },
            "Background Lesson generation scheduling failed",
          );
        },
      );
    } catch (error) {
      const errorCode = errorCodeFor(error, "lesson_production_failed");
      this.logger.error(
        {
          ...lessonLogFields(
            input,
            attempt,
            "lesson_generation.first_block_failed",
          ),
          category: lessonGenerationErrorCategory(error, stage),
          durationMs: Math.round(performance.now() - startedAt),
          err: errorMetadata(error),
          errorCode,
          stage,
          ...errorMetadata(error),
        },
        "First Lesson block generation failed",
      );
      await this.deps.repository.failLesson(input.lesson.id, errorCode);
    }
  }

  async recoverInterrupted(): Promise<void> {
    const activeRuns = await this.deps.repository.findActiveBlockRuns();
    await mapWithConcurrency(
      activeRuns,
      this.concurrencyLimit,
      async (active) => {
        try {
          if (active.run.status === "pending" && active.run.reference) {
            const run = await this.inspectRun(active.run.reference, {
              attempt: active.attempt,
              lessonId: active.lessonId,
            });
            await this.persistInspectedRun(active, run);
          } else {
            await this.startQueuedOrInterruptedBlock(active);
          }
        } catch (error) {
          await this.deps.repository.persistBlockRun({
            ...active,
            run: failedRun(active.run, error),
          });
          this.logBackgroundFailure(active, error, "inspection");
        }
      },
    );
  }

  private async produceRemainingBlocks(input: {
    input: {
      lesson: ReservedFirstLesson;
      context: FirstLessonContext;
      correlationId?: string;
    };
    plan: LessonPlan;
    attempt: number;
  }): Promise<void> {
    const remaining = input.plan.blocks.slice(1);
    await mapWithConcurrency(
      remaining,
      this.concurrencyLimit,
      async (planBlock, index) => {
        const blockPosition = index + 1;
        try {
          const claimed = await this.deps.repository.claimQueuedBlockRun({
            attempt: input.attempt,
            blockPosition,
            lessonId: input.input.lesson.id,
          });
          if (!claimed) return;
          await this.startBlock({
            attempt: input.attempt,
            blockPosition,
            context: input.input.context,
            correlationId: input.input.correlationId,
            expectedObjective: planBlock.objective,
            lessonId: input.input.lesson.id,
            plan: input.plan,
          });
        } catch (error) {
          const failed = failedRun(
            {
              adapter: "unavailable",
              model: "unavailable",
              reference: `local:${input.input.lesson.id}:${blockPosition}:${input.attempt}`,
              status: "failed",
            },
            error,
          );
          await this.deps.repository.persistBlockRun({
            attempt: input.attempt,
            blockPosition,
            lessonId: input.input.lesson.id,
            run: failed,
          });
          this.logBackgroundFailure(
            {
              lessonId: input.input.lesson.id,
              blockPosition,
              attempt: input.attempt,
            },
            error,
            "generation",
          );
        }
      },
    );
  }

  private async persistInspectedRun(
    active: Awaited<
      ReturnType<LessonRepository["findActiveBlockRuns"]>
    >[number],
    run: StructuredModelRun,
  ): Promise<void> {
    await this.persistProducedRun({
      attempt: active.attempt,
      blockPosition: active.blockPosition,
      lessonId: active.lessonId,
      plan: active.plan,
      expectedObjective:
        active.plan.blocks[active.blockPosition]?.objective ?? "",
      run,
    });
  }

  private async startQueuedOrInterruptedBlock(
    active: Awaited<
      ReturnType<LessonRepository["findActiveBlockRuns"]>
    >[number],
  ): Promise<void> {
    const objective = active.plan.blocks[active.blockPosition]?.objective;
    if (!objective) throw new Error("lesson_plan_block_missing");
    await this.startBlock({
      attempt: active.attempt,
      blockPosition: active.blockPosition,
      context: active.context,
      expectedObjective: objective,
      lessonId: active.lessonId,
      plan: active.plan,
    });
  }

  private async startBlock(input: {
    attempt: number;
    blockPosition: number;
    context: FirstLessonContext;
    correlationId?: string;
    expectedObjective: string;
    lessonId: string;
    plan: LessonPlan;
  }): Promise<void> {
    const run = await this.startRun({
      correlation: {
        attempt: input.attempt,
        lessonId: input.lessonId,
        requestId: input.correlationId,
      },
      contract: lessonBlockContract,
      workload: "lesson_block",
      instructions:
        "Produce one cohesive text lesson block with explanation, one to five examples, and one to five activities. Match the supplied objective exactly. Return JSON only.",
      input: blockPrompt(input.context, input.plan, input.expectedObjective),
    });
    await this.persistProducedRun({ ...input, run });
  }

  private async persistProducedRun(input: {
    attempt: number;
    blockPosition: number;
    lessonId: string;
    plan: LessonPlan;
    expectedObjective: string;
    run: StructuredModelRun;
  }): Promise<void> {
    if (input.run.status !== "completed" || !input.run.output) {
      await this.deps.repository.persistBlockRun(input);
      return;
    }
    const block = lessonBlockSchema.parse(JSON.parse(input.run.output));
    validateSemantics(input.plan, block, input.expectedObjective);
    await this.deps.repository.publishBlockRun({ ...input, block });
  }

  private async startRun(request: Parameters<StructuredModel["start"]>[0]) {
    const startedAt = performance.now();
    const run = await this.deps.model.start(request);
    return withLatency(run, startedAt);
  }

  private async inspectRun(
    reference: string,
    correlation: { attempt: number; lessonId: string },
  ) {
    const startedAt = performance.now();
    const run = await this.deps.model.inspect(reference, correlation);
    return withLatency(run, startedAt);
  }

  private logBackgroundFailure(
    run: { lessonId: string; blockPosition: number; attempt: number },
    error: unknown,
    phase: "generation" | "inspection",
  ): void {
    this.logger.error(
      {
        attempt: run.attempt,
        blockPosition: run.blockPosition,
        err: errorMetadata(error),
        event: "lesson_generation.background_block_failed",
        lessonId: run.lessonId,
        phase,
        ...errorMetadata(error),
      },
      "Background Lesson block generation failed",
    );
  }
}

function correlation(
  input: { lesson: ReservedFirstLesson; correlationId?: string },
  attempt: number,
) {
  return { attempt, lessonId: input.lesson.id, requestId: input.correlationId };
}

function lessonLogFields(
  input: { lesson: ReservedFirstLesson; correlationId?: string },
  attempt: number,
  event: string,
) {
  return {
    attempt,
    event,
    lessonId: input.lesson.id,
    learningTrackId: input.lesson.learningTrackId,
    moduleId: input.lesson.moduleId,
    priorityCompetencyId: input.lesson.priorityCompetencyId,
    requestId: input.correlationId,
  };
}

function lessonGenerationErrorCategory(
  error: unknown,
  stage: "lesson_plan" | "lesson_block" | "persistence",
): string {
  if (stage === "persistence") return "persistence";
  if (error instanceof SyntaxError || error instanceof TypeError)
    return "validation";
  if (error instanceof Error && error.name === "ZodError") return "validation";
  if (
    error instanceof Error &&
    (error.message.startsWith("openai_") ||
      error.message.startsWith("structured_model_"))
  ) {
    return "provider";
  }
  return "generation";
}

function parseCompletedRun<T>(
  run: StructuredModelRun,
  schema: { parse(value: unknown): T },
): T {
  if (run.status !== "completed" || !run.output) {
    throw new Error(run.errorCode ?? "structured_model_incomplete");
  }
  return schema.parse(JSON.parse(run.output));
}

function validateSemantics(
  plan: LessonPlan,
  block: LessonBlock,
  expectedObjective: string,
): void {
  if (block.objective !== expectedObjective || !plan.objective.trim()) {
    throw new Error("lesson_block_objective_mismatch");
  }
}

function planPrompt(context: FirstLessonContext): string {
  return JSON.stringify({
    task: "Plan the first approximately ten-minute lesson.",
    targetLanguage: context.targetLanguage,
    instructionLanguage: context.instructionLanguage,
    primaryGoal: context.primaryGoal,
    lessonEmphases: context.lessonEmphases,
    priorityCompetency: context.priorityCompetencyKey,
    internalDifficultyCeiling: "A1",
  });
}

function blockPrompt(
  context: FirstLessonContext,
  plan: LessonPlan,
  objective: string,
): string {
  return JSON.stringify({
    task: "Produce this Lesson block from the immutable plan.",
    targetLanguage: context.targetLanguage,
    instructionLanguage: context.instructionLanguage,
    plan,
    objective,
    internalDifficultyCeiling: "A1",
  });
}

function withLatency(
  run: StructuredModelRun,
  startedAt: number,
): StructuredModelRun {
  return { ...run, latencyMs: Math.round(performance.now() - startedAt) };
}

function failedRun(
  run: StructuredModelRun,
  error: unknown,
): StructuredModelRun {
  return {
    ...run,
    status: "failed",
    errorCode: errorCodeFor(error, "lesson_block_generation_failed"),
  };
}

function errorCodeFor(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  if (/^[a-z][a-z0-9_]*(?::\d{3})?$/.test(error.message)) {
    return error.message;
  }
  if (error.name === "ZodError") return "lesson_content_invalid";
  return fallback;
}

async function mapWithConcurrency<T>(
  values: readonly T[],
  concurrencyLimit: number,
  worker: (value: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function consume(): Promise<void> {
    while (next < values.length) {
      const index = next++;
      const value = values[index];
      if (value !== undefined) await worker(value, index);
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(concurrencyLimit, 1), values.length) },
      () => consume(),
    ),
  );
}
