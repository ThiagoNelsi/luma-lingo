import type { StructuredModel } from "../models/structured-model.js";
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

  constructor(
    private readonly deps: {
      model: StructuredModel;
      repository: LessonRepository;
      logger?: AppLogger;
    },
  ) {
    this.logger = deps.logger ?? createSilentLogger();
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
      const planRun = await this.deps.model.start({
        correlation: {
          attempt,
          lessonId: input.lesson.id,
          requestId: input.correlationId,
        },
        contract: lessonPlanContract,
        workload: "lesson_plan",
        instructions:
          "Produce a concise, safe language lesson plan. Return JSON only.",
        input: planPrompt(input.context),
      });
      const plan = parseCompletedRun(planRun, lessonPlanSchema);
      const firstPlanBlock = plan.blocks[0];
      if (!firstPlanBlock) throw new Error("lesson_plan_without_block");
      this.logger.debug(
        lessonLogFields(input, attempt, "lesson_generation.plan_completed"),
        "Lesson plan generation completed",
      );

      stage = "lesson_block";
      const blockRun = await this.deps.model.start({
        correlation: {
          attempt,
          lessonId: input.lesson.id,
          requestId: input.correlationId,
        },
        contract: lessonBlockContract,
        workload: "lesson_block",
        instructions:
          "Produce one cohesive text lesson block with explanation, examples, and activities. Return JSON only.",
        input: blockPrompt(input.context, plan, firstPlanBlock.objective),
      });
      const block = parseCompletedRun(blockRun, lessonBlockSchema);
      validateSemantics(plan, block, firstPlanBlock.objective);

      stage = "persistence";
      await this.deps.repository.publishFirstBlock({
        lessonId: input.lesson.id,
        plan,
        block,
        runs: {
          plan: {
            reference: planRun.reference,
            adapter: planRun.adapter,
            model: planRun.model,
          },
          block: {
            reference: blockRun.reference,
            adapter: blockRun.adapter,
            model: blockRun.model,
          },
        },
      });
      this.logger.info(
        {
          ...lessonLogFields(input, attempt, "lesson_generation.completed"),
          durationMs: Math.round(performance.now() - startedAt),
        },
        "Lesson generation completed",
      );
    } catch (error) {
      const errorCode =
        error instanceof Error ? error.message : "lesson_production_failed";
      this.logger.error(
        {
          ...lessonLogFields(input, attempt, "lesson_generation.failed"),
          category: lessonGenerationErrorCategory(error, stage),
          durationMs: Math.round(performance.now() - startedAt),
          err: errorMetadata(error),
          errorCode,
          stage,
          ...errorMetadata(error),
        },
        "Lesson generation failed",
      );
      try {
        await this.deps.repository.failLesson(input.lesson.id, errorCode);
      } catch (persistenceError) {
        this.logger.error(
          {
            ...lessonLogFields(
              input,
              attempt,
              "lesson_generation.failure_persistence_failed",
            ),
            category: "persistence",
            err: errorMetadata(persistenceError),
            ...errorMetadata(persistenceError),
          },
          "Lesson generation failure could not be persisted",
        );
        throw persistenceError;
      }
    }
  }
}

function lessonLogFields(
  input: {
    lesson: ReservedFirstLesson;
    correlationId?: string;
  },
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
  if (error instanceof SyntaxError || error instanceof TypeError) {
    return "validation";
  }
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
  run: Awaited<ReturnType<StructuredModel["start"]>>,
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
    task: "Plan the first lesson.",
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
    task: "Produce the first lesson block from this immutable plan.",
    targetLanguage: context.targetLanguage,
    instructionLanguage: context.instructionLanguage,
    plan,
    objective,
    internalDifficultyCeiling: "A1",
  });
}
