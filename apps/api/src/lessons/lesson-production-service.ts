import type {
  StructuredModel,
  StructuredModelRequest,
  StructuredModelRun,
  StructuredModelReadiness,
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
import {
  LessonContentModerationError,
  type ContentModerator,
} from "./content-moderator.js";
import type {
  ActiveLessonPlanRun,
  LessonRepository,
  RetryableLessonWork,
} from "./lesson-repository.js";
import {
  LessonSemanticValidationError,
  validateLessonBlockSemantics,
  validateLessonPlanSemantics,
  type LessonValidationContext,
} from "./lesson-semantic-validator.js";

export type FirstLessonContext = LessonValidationContext;

export interface ReservedFirstLesson {
  id: string;
  learningTrackId: string;
  moduleId: string;
  priorityCompetencyId: string;
}

type CompletedValidatedRun<T> = {
  status: "completed";
  attempt: number;
  run: StructuredModelRun;
  value: T;
};

type ValidatedRun<T> =
  | CompletedValidatedRun<T>
  | {
      status: "pending";
      attempt: number;
      run: StructuredModelRun;
    };

const lessonBlockInstructions =
  "Produce one safe cohesive text lesson block with explanation, one to five examples, and one to five activities. Match the supplied title and objective exactly. Do not use links, markup, audio, video, or speaking tasks. Return JSON only.";
const lessonPlanInstructions =
  "Produce a concise, safe language lesson plan with three to five cohesive blocks. Copy the supplied alignment fields exactly, use only confirmed profile topics, assign every selected emphasis across the blocks, and return JSON only.";
const lessonPromptVersion = "v2";

export class LessonProductionService {
  private readonly logger: AppLogger;
  private readonly concurrencyLimit: number;

  constructor(
    private readonly deps: {
      model: StructuredModel;
      moderator: ContentModerator;
      repository: LessonRepository;
      concurrencyLimit?: number;
      logger?: AppLogger;
    },
  ) {
    this.logger = deps.logger ?? createSilentLogger();
    this.concurrencyLimit = deps.concurrencyLimit ?? 4;
  }

  readiness(): StructuredModelReadiness {
    return this.deps.model.readiness?.() ?? { status: "ready" };
  }

  async produceFirstBlock(input: {
    lesson: ReservedFirstLesson;
    context: FirstLessonContext;
    correlationId?: string;
    attempt?: number;
  }): Promise<void> {
    const startedAt = performance.now();
    const attempt = input.attempt ?? 1;
    const context =
      (await this.deps.repository.findLessonValidationContext?.(
        input.lesson.id,
      )) ?? input.context;
    let stage: "lesson_plan" | "lesson_block" | "persistence" = "lesson_plan";
    try {
      const planResult = await this.startValidatedRun({
        attempt,
        onPending: async (pending) => {
          await this.deps.repository.persistPlanRun({
            attempt: pending.attempt,
            lessonId: input.lesson.id,
            run: pending.run,
          });
        },
        onRejected: async (rejected) => {
          await this.deps.repository.persistPlanRun({
            attempt: rejected.attempt,
            lessonId: input.lesson.id,
            run: rejected.run,
          });
        },
        validate: async (plan, validatedAttempt) => {
          validateLessonPlanSemantics(plan, context);
          await this.moderateGeneratedContent(
            plan,
            "lesson_plan",
            correlation(input, validatedAttempt),
          );
        },
        request: planRequest(context, correlation(input, attempt)),
        schema: lessonPlanSchema,
      });
      if (planResult.status === "pending") return;
      const { run: planRun, value: plan } = planResult;
      stage = "persistence";
      await this.deps.repository.persistPlanRun({
        attempt: planResult.attempt,
        lessonId: input.lesson.id,
        plan,
        run: planRun,
      });

      stage = "lesson_block";
      const published = await this.produceFirstBlockFromPlan({
        attempt: planResult.attempt,
        context,
        correlationId: input.correlationId,
        lesson: input.lesson,
        plan,
        planResult,
      });
      if (!published) return;
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
          ...rejectionMetadata(error),
          ...errorMetadata(error),
        },
        "First Lesson block generation failed",
      );
      await this.deps.repository.failLesson(input.lesson.id, errorCode);
    }
  }

  async recoverInterrupted(): Promise<void> {
    const activePlans = await this.deps.repository.findActivePlanRuns();
    await mapWithConcurrency(
      activePlans,
      this.concurrencyLimit,
      async (active) => {
        try {
          await this.recoverPlanRun(active);
        } catch (error) {
          this.logger.error(
            {
              attempt: active.attempt,
              err: errorMetadata(error),
              event: "lesson_generation.plan_recovery_failed",
              lessonId: active.lesson.id,
              ...rejectionMetadata(error),
              ...errorMetadata(error),
            },
            "Interrupted Lesson plan recovery failed",
          );
          await this.deps.repository.failLesson(
            active.lesson.id,
            errorCodeFor(error, "lesson_plan_recovery_failed"),
          );
        }
      },
    );
    const activeRuns = await this.deps.repository.findActiveBlockRuns();
    await mapWithConcurrency(
      activeRuns,
      this.concurrencyLimit,
      async (active) => {
        try {
          if (active.run.status === "pending" && active.run.reference) {
            let run: StructuredModelRun;
            try {
              run = await this.inspectRun(
                active.run.reference,
                {
                  attempt: active.attempt,
                  lessonId: active.lessonId,
                },
                "lesson_block",
                active.run,
              );
            } catch (error) {
              run = failedRun(active.run, error);
            }
            await this.persistInspectedRun(active, run);
          } else {
            await this.startQueuedOrInterruptedBlock(active);
          }
        } catch (error) {
          this.logBackgroundFailure(active, error, "inspection");
          if (active.blockPosition === 0) {
            await this.deps.repository.failLesson(
              active.lessonId,
              errorCodeFor(error, "lesson_block_recovery_failed"),
            );
          }
        }
      },
    );
  }

  async retryFailedWork(
    learnerId: string,
    lessonId: string,
    correlationId?: string,
  ): Promise<boolean> {
    const retryable = await this.deps.repository.prepareLessonRetry?.(
      learnerId,
      lessonId,
    );
    if (!retryable) return false;
    void this.resumeRetryFailedWork(retryable, correlationId).catch((error) => {
      this.logger.error(
        {
          err: errorMetadata(error),
          event: "lesson_generation.manual_retry_failed",
          learnerId,
          lessonId,
          requestId: correlationId,
          ...rejectionMetadata(error),
          ...errorMetadata(error),
        },
        "Lesson generation manual retry failed",
      );
    });
    return true;
  }

  private async resumeRetryFailedWork(
    retryable: RetryableLessonWork,
    correlationId?: string,
  ): Promise<void> {
    if (!retryable.plan) {
      await this.produceFirstBlock({
        lesson: retryable.lesson,
        context: retryable.context,
        correlationId,
        attempt: retryable.planAttempt,
      });
      return;
    }
    const retryPlan = retryable.plan;
    await mapWithConcurrency(
      retryable.blocks,
      this.concurrencyLimit,
      async (block) => {
        const planBlock = retryPlan.blocks[block.blockPosition];
        if (!planBlock) return;
        const claimed = await this.deps.repository.claimQueuedBlockRun({
          attempt: block.attempt,
          blockPosition: block.blockPosition,
          lessonId: retryable.lesson.id,
        });
        if (!claimed) return;
        await this.startBlock({
          attempt: block.attempt,
          blockPosition: block.blockPosition,
          context: retryable.context,
          correlationId,
          expectedObjective: planBlock.objective,
          lessonId: retryable.lesson.id,
          plan: retryPlan,
        });
      },
    );
  }

  private async produceRemainingBlocks(input: {
    lessonRequest: {
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
            lessonId: input.lessonRequest.lesson.id,
          });
          if (!claimed) return;
          await this.startBlock({
            attempt: input.attempt,
            blockPosition,
            context: input.lessonRequest.context,
            correlationId: input.lessonRequest.correlationId,
            expectedObjective: planBlock.objective,
            lessonId: input.lessonRequest.lesson.id,
            plan: input.plan,
          });
        } catch (error) {
          this.logBackgroundFailure(
            {
              lessonId: input.lessonRequest.lesson.id,
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

  private async produceFirstBlockFromPlan(input: {
    attempt: number;
    context: FirstLessonContext;
    correlationId?: string;
    lesson: ReservedFirstLesson;
    plan: LessonPlan;
    planResult: CompletedValidatedRun<LessonPlan>;
  }): Promise<boolean> {
    const firstPlanBlock = input.plan.blocks[0];
    if (!firstPlanBlock) throw new Error("lesson_plan_without_block");
    const claimed = await this.deps.repository.claimQueuedBlockRun({
      attempt: input.attempt,
      blockPosition: 0,
      lessonId: input.lesson.id,
    });
    if (!claimed) return false;
    const blockResult = await this.startValidatedRun({
      attempt: input.attempt,
      onPending: async (pending) => {
        await this.deps.repository.persistBlockRun({
          attempt: pending.attempt,
          blockPosition: 0,
          lessonId: input.lesson.id,
          run: pending.run,
        });
      },
      onRejected: async (rejected) => {
        await this.deps.repository.persistBlockRun({
          attempt: rejected.attempt,
          blockPosition: 0,
          lessonId: input.lesson.id,
          run: rejected.run,
        });
      },
      validate: async (block, validatedAttempt) => {
        validateLessonBlockSemantics(
          input.plan,
          block,
          firstPlanBlock.objective,
          input.context,
        );
        await this.moderateGeneratedContent(block, "lesson_block", {
          attempt: validatedAttempt,
          lessonId: input.lesson.id,
          requestId: input.correlationId,
        });
      },
      request: {
        ...blockRequest(input.context, input.plan, firstPlanBlock.objective),
        correlation: {
          attempt: input.attempt,
          lessonId: input.lesson.id,
          requestId: input.correlationId,
        },
      },
      schema: lessonBlockSchema,
    });
    if (blockResult.status === "pending") return false;
    await this.deps.repository.publishFirstBlock({
      attempt: input.attempt,
      lessonId: input.lesson.id,
      plan: input.plan,
      block: blockResult.value,
      runs: {
        plan: {
          attempt: input.planResult.attempt,
          run: input.planResult.run,
        },
        block: { attempt: blockResult.attempt, run: blockResult.run },
      },
    });
    void this.produceRemainingBlocks({
      lessonRequest: {
        lesson: input.lesson,
        context: input.context,
        correlationId: input.correlationId,
      },
      plan: input.plan,
      attempt: input.attempt,
    }).catch((error) => {
      this.logger.error(
        {
          attempt: input.attempt,
          err: errorMetadata(error),
          event: "lesson_generation.background_scheduling_failed",
          lessonId: input.lesson.id,
          ...errorMetadata(error),
        },
        "Background Lesson generation scheduling failed",
      );
    });
    return true;
  }

  private async recoverPlanRun(active: ActiveLessonPlanRun): Promise<void> {
    if (!active.run.reference) {
      await this.produceFirstBlock({
        lesson: active.lesson,
        context: active.context,
        attempt: active.attempt,
      });
      return;
    }
    let inspected: StructuredModelRun;
    try {
      inspected = await this.inspectRun(
        active.run.reference,
        {
          attempt: active.attempt,
          lessonId: active.lesson.id,
        },
        "lesson_plan",
        active.run,
      );
    } catch (error) {
      inspected = failedRun(active.run, error);
    }
    if (inspected.status === "pending") {
      await this.deps.repository.persistPlanRun({
        attempt: active.attempt,
        lessonId: active.lesson.id,
        run: inspected,
      });
      return;
    }

    let planResult: CompletedValidatedRun<LessonPlan>;
    try {
      const plan = parseCompletedRun(inspected, lessonPlanSchema);
      validateLessonPlanSemantics(plan, active.context);
      await this.moderateGeneratedContent(plan, "lesson_plan", {
        attempt: active.attempt,
        lessonId: active.lesson.id,
      });
      planResult = {
        status: "completed",
        attempt: active.attempt,
        run: inspected,
        value: plan,
      };
    } catch (error) {
      await this.deps.repository.persistPlanRun({
        attempt: active.attempt,
        lessonId: active.lesson.id,
        run: failedRun(inspected, error),
      });
      const retryAttempt = active.attempt + 1;
      const retried = await this.retryRun(
        withRejectionFeedback(
          planRequest(active.context, {
            attempt: retryAttempt,
            lessonId: active.lesson.id,
          }),
          error,
        ),
        active.run,
      );
      if (retried.status === "pending") {
        await this.deps.repository.persistPlanRun({
          attempt: retryAttempt,
          lessonId: active.lesson.id,
          run: retried,
        });
        return;
      }
      try {
        const plan = parseCompletedRun(retried, lessonPlanSchema);
        validateLessonPlanSemantics(plan, active.context);
        await this.moderateGeneratedContent(plan, "lesson_plan", {
          attempt: retryAttempt,
          lessonId: active.lesson.id,
        });
        planResult = {
          status: "completed",
          attempt: retryAttempt,
          run: retried,
          value: plan,
        };
      } catch (retryError) {
        await this.deps.repository.persistPlanRun({
          attempt: retryAttempt,
          lessonId: active.lesson.id,
          run: failedRun(retried, retryError),
        });
        throw retryError;
      }
    }

    await this.deps.repository.persistPlanRun({
      attempt: planResult.attempt,
      lessonId: active.lesson.id,
      plan: planResult.value,
      run: planResult.run,
    });
    await this.produceFirstBlockFromPlan({
      attempt: planResult.attempt,
      context: active.context,
      lesson: active.lesson,
      plan: planResult.value,
      planResult,
    });
  }

  private async persistInspectedRun(
    active: Awaited<
      ReturnType<LessonRepository["findActiveBlockRuns"]>
    >[number],
    run: StructuredModelRun,
  ): Promise<void> {
    if (run.status === "pending") {
      await this.deps.repository.persistBlockRun({
        ...active,
        run,
      });
      return;
    }
    const expectedObjective =
      active.plan.blocks[active.blockPosition]?.objective ?? "";
    let block: LessonBlock;
    try {
      block = parseCompletedRun(run, lessonBlockSchema);
      validateLessonBlockSemantics(
        active.plan,
        block,
        expectedObjective,
        active.context,
      );
      await this.moderateGeneratedContent(block, "lesson_block", {
        attempt: active.attempt,
        lessonId: active.lessonId,
      });
    } catch (error) {
      await this.deps.repository.persistBlockRun({
        ...active,
        run: failedRun(run, error),
      });
      const retryAttempt = active.attempt + 1;
      let retried: StructuredModelRun | undefined;
      let retriedBlock: LessonBlock;
      try {
        retried = await this.retryRun(
          withRejectionFeedback(
            {
              ...blockRequest(active.context, active.plan, expectedObjective),
              correlation: {
                attempt: retryAttempt,
                lessonId: active.lessonId,
              },
            },
            error,
          ),
          active.run,
        );
        retriedBlock = parseCompletedRun(retried, lessonBlockSchema);
        validateLessonBlockSemantics(
          active.plan,
          retriedBlock,
          expectedObjective,
          active.context,
        );
        await this.moderateGeneratedContent(retriedBlock, "lesson_block", {
          attempt: retryAttempt,
          lessonId: active.lessonId,
        });
      } catch (retryError) {
        await this.deps.repository.persistBlockRun({
          attempt: retryAttempt,
          blockPosition: active.blockPosition,
          lessonId: active.lessonId,
          run: failedRun(retried ?? run, retryError),
        });
        throw retryError;
      }
      await this.deps.repository.publishBlockRun({
        attempt: retryAttempt,
        block: retriedBlock,
        blockPosition: active.blockPosition,
        lessonId: active.lessonId,
        run: retried,
      });
      return;
    }
    await this.deps.repository.publishBlockRun({
      attempt: active.attempt,
      block,
      blockPosition: active.blockPosition,
      lessonId: active.lessonId,
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
    if (active.run.status === "queued") {
      const claimed = await this.deps.repository.claimQueuedBlockRun({
        attempt: active.attempt,
        blockPosition: active.blockPosition,
        lessonId: active.lessonId,
      });
      if (!claimed) return;
    }
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
    const produced = await this.startValidatedRun({
      attempt: input.attempt,
      onPending: async (pending) => {
        await this.deps.repository.persistBlockRun({
          attempt: pending.attempt,
          blockPosition: input.blockPosition,
          lessonId: input.lessonId,
          run: pending.run,
        });
      },
      onRejected: async (rejected) => {
        await this.deps.repository.persistBlockRun({
          attempt: rejected.attempt,
          blockPosition: input.blockPosition,
          lessonId: input.lessonId,
          run: rejected.run,
        });
      },
      request: {
        ...blockRequest(input.context, input.plan, input.expectedObjective),
        correlation: {
          attempt: input.attempt,
          lessonId: input.lessonId,
          requestId: input.correlationId,
        },
      },
      schema: lessonBlockSchema,
      validate: async (block, validatedAttempt) => {
        validateLessonBlockSemantics(
          input.plan,
          block,
          input.expectedObjective,
          input.context,
        );
        await this.moderateGeneratedContent(block, "lesson_block", {
          attempt: validatedAttempt,
          lessonId: input.lessonId,
          requestId: input.correlationId,
        });
      },
    });
    if (produced.status === "pending") return;
    await this.deps.repository.publishBlockRun({
      ...input,
      attempt: produced.attempt,
      block: produced.value,
      run: produced.run,
    });
  }

  private async startValidatedRun<T>(input: {
    attempt: number;
    request: StructuredModelRequest<T>;
    schema: { parse(value: unknown): T };
    validate(value: T, attempt: number): void | Promise<void>;
    onRejected?(input: {
      attempt: number;
      error: unknown;
      run: StructuredModelRun;
    }): Promise<void>;
    onPending?(input: {
      attempt: number;
      run: StructuredModelRun;
    }): Promise<void>;
  }): Promise<ValidatedRun<T>> {
    let firstRun: StructuredModelRun | undefined;
    let pinnedRoute: Pick<StructuredModelRun, "adapter" | "model"> | undefined;
    let lastError: unknown;
    for (let offset = 0; offset < 2; offset += 1) {
      const attempt = input.attempt + offset;
      let attemptedRun: StructuredModelRun | undefined;
      const baseRequest =
        offset === 0
          ? input.request
          : withRejectionFeedback(input.request, lastError);
      const request = {
        ...baseRequest,
        correlation: { ...input.request.correlation, attempt },
      };
      try {
        const run =
          offset === 0
            ? await this.startRun(request)
            : await this.retryRun(request, pinnedRoute);
        attemptedRun = run;
        firstRun ??= run;
        pinnedRoute ??= {
          adapter: firstRun.adapter,
          model: firstRun.model,
        };
        if (run.status === "pending") {
          await input.onPending?.({ attempt, run });
          return { status: "pending", attempt, run };
        }
        const value = parseCompletedRun(run, input.schema);
        await input.validate(value, attempt);
        return { status: "completed", attempt, run, value };
      } catch (error) {
        lastError = error;
        const rejection = rejectionMetadata(error);
        if (rejection.rejectionReason) {
          this.logger.warn(
            {
              ...request.correlation,
              adapter: attemptedRun?.adapter ?? pinnedRoute?.adapter,
              event: "lesson_generation.output_rejected",
              model: attemptedRun?.model ?? pinnedRoute?.model,
              promptVersion: request.promptVersion,
              ...rejection,
              workload: request.workload,
            },
            "Generated Lesson output rejected",
          );
        }
        pinnedRoute ??= this.deps.model.route?.(input.request.workload);
        if (input.onRejected) {
          const route = attemptedRun ?? pinnedRoute;
          if (route) {
            const rejectedRun: StructuredModelRun = attemptedRun ?? {
              ...route,
              reference: `local:${input.request.workload}:${attempt}`,
              status: "failed",
            };
            await input.onRejected({
              attempt,
              error,
              run: failedRun(rejectedRun, error),
            });
          }
        }
        if (offset === 1) throw error;
        if (!pinnedRoute) throw error;
      }
    }
    throw lastError;
  }

  private async moderateGeneratedContent(
    value: LessonPlan | LessonBlock,
    purpose: "lesson_plan" | "lesson_block",
    correlation?: {
      attempt?: number;
      lessonId?: string;
      requestId?: string;
    },
  ): Promise<void> {
    const result = await this.deps.moderator.moderate({
      content: JSON.stringify(value),
      correlation,
      purpose,
    });
    if (result.flagged) {
      throw new LessonContentModerationError(result.flaggedCategories);
    }
  }

  private async startRun(request: Parameters<StructuredModel["start"]>[0]) {
    const startedAt = performance.now();
    const run = await this.deps.model.start(request);
    return withLatency(run, startedAt);
  }

  private async retryRun(
    request: Parameters<StructuredModel["retry"]>[0],
    firstRun:
      | StructuredModelRun
      | Pick<StructuredModelRun, "adapter" | "model">
      | undefined,
  ) {
    if (!firstRun) throw new Error("structured_model_route_unavailable");
    const startedAt = performance.now();
    const run = await this.deps.model.retry(request, {
      adapter: firstRun.adapter,
      model: firstRun.model,
    });
    return withLatency(run, startedAt);
  }

  private async inspectRun(
    reference: string,
    correlation: { attempt: number; lessonId: string },
    workload: StructuredModelRequest<unknown>["workload"] = "lesson_block",
    pinned?: Pick<StructuredModelRun, "adapter" | "model">,
  ) {
    const startedAt = performance.now();
    const run = await this.deps.model.inspect(
      reference,
      correlation,
      workload,
      pinned,
    );
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
        ...rejectionMetadata(error),
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
  if (error instanceof LessonSemanticValidationError) return "validation";
  if (error instanceof LessonContentModerationError) return "moderation";
  if (
    error instanceof Error &&
    (error.message.startsWith("openai_") ||
      error.message.startsWith("structured_model_"))
  ) {
    return "provider";
  }
  return "generation";
}

function rejectionMetadata(error: unknown): {
  flaggedCategories?: string[];
  rejectionReason?: string;
} {
  if (error instanceof LessonSemanticValidationError) {
    return { rejectionReason: error.reason };
  }
  if (error instanceof LessonContentModerationError) {
    return {
      flaggedCategories: error.flaggedCategories,
      rejectionReason: error.reason,
    };
  }
  return {};
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

function planPrompt(context: FirstLessonContext): string {
  const priorityCompetencyState =
    context.competencyProfile?.find(
      (state) => state.competencyKey === context.priorityCompetencyKey,
    ) ?? null;
  return JSON.stringify({
    task: "Plan the first approximately ten-minute lesson.",
    requiredAlignment: {
      targetLanguage: context.targetLanguage,
      instructionLanguage: context.instructionLanguage,
      primaryGoal: context.primaryGoal,
      lessonEmphases: context.lessonEmphases,
      priorityCompetencyKey: context.priorityCompetencyKey,
      priorityCompetencyState: priorityCompetencyState
        ? {
            abilityEstimate: priorityCompetencyState.abilityEstimate,
            confidence: priorityCompetencyState.confidence,
          }
        : null,
      profileTopics: (context.profileTopics ?? []).slice(0, 3),
    },
    learnerAgeRange: context.learnerAgeRange,
    competencyProfile: context.competencyProfile ?? [],
    internalDifficultyCeiling: "A1",
    approvalRequirements: [
      "Copy every requiredAlignment field exactly.",
      "Use only confirmed profile topics and copy declared topics exactly.",
      "Assign every selected Lesson emphasis to at least one block.",
      "Use unique non-empty block objectives.",
      "Keep the learner-facing scenario aligned with the primary Goal.",
      "Keep all content neutral, age-appropriate, and suitable for language learning.",
    ],
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
    approvalRequirements: [
      "Match the supplied block title and objective exactly.",
      "Teach the supplied objective coherently.",
      "Use only the target and instruction languages in their required fields.",
      "Implement the planned emphasis with a supported activity type.",
      "Keep practice volume proportional to the examples.",
      "Keep all content neutral, age-appropriate, and suitable for language learning.",
    ],
  });
}

function blockRequest(
  context: FirstLessonContext,
  plan: LessonPlan,
  objective: string,
): StructuredModelRequest<LessonBlock> {
  return {
    contract: lessonBlockContract,
    workload: "lesson_block",
    instructions: lessonBlockInstructions,
    input: blockPrompt(context, plan, objective),
    promptVersion: lessonPromptVersion,
  };
}

function planRequest(
  context: FirstLessonContext,
  correlation: NonNullable<StructuredModelRequest<LessonPlan>["correlation"]>,
): StructuredModelRequest<LessonPlan> {
  return {
    correlation,
    contract: lessonPlanContract,
    workload: "lesson_plan",
    instructions: lessonPlanInstructions,
    input: planPrompt(context),
    promptVersion: lessonPromptVersion,
  };
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
    rejectionReason: rejectionMetadata(error).rejectionReason,
  };
}

function withRejectionFeedback<T>(
  request: StructuredModelRequest<T>,
  error: unknown,
): StructuredModelRequest<T> {
  const reason = rejectionMetadata(error).rejectionReason;
  if (!reason) return request;
  const input = JSON.parse(request.input) as Record<string, unknown>;
  return {
    ...request,
    input: JSON.stringify({
      ...input,
      previousAttemptRejection: {
        correction: correctionFor(reason),
        reason,
      },
    }),
  };
}

function correctionFor(reason: string): string {
  const corrections: Record<string, string> = {
    curricular_alignment:
      "Keep the exact priority competency metadata and make every block serve the supplied objective.",
    emphasis_alignment:
      "Use only the selected emphases and assign every selected emphasis to at least one block.",
    goal_alignment:
      "Keep the exact primary Goal metadata and make the lesson scenario support that Goal.",
    language_alignment:
      "Use only the supplied target and instruction languages in their required fields.",
    practice_volume:
      "Keep practice volume proportional to the examples and within the contract limits.",
    profile_alignment:
      "Use only confirmed profile topics and copy every declared topic exactly from the supplied list.",
    unsafe_content:
      "Replace the flagged scenario with neutral, age-appropriate language-learning content.",
    unsupported_content:
      "Remove links, markup, media, speaking tasks, and learner-facing CEFR claims.",
  };
  return corrections[reason] ?? "Correct the rejected output before retrying.";
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
