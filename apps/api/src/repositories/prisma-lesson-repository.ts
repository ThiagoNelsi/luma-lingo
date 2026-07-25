import { createId, type PrismaClient } from "@luma-lingo/database";

import type { StructuredModelRun } from "../models/structured-model.js";
import {
  lessonBlockSchema,
  lessonPlanSchema,
  type LessonBlock,
  type LessonPlan,
} from "../lessons/lesson-content.js";
import type {
  ActiveLessonBlockRun,
  FirstLessonReservation,
  HomeLesson,
  LessonProgress,
  LessonRepository,
  PersistedRun,
  RetriedHomeLesson,
  ReservedHomeLesson,
} from "../lessons/lesson-repository.js";
import {
  createSilentLogger,
  errorMetadata,
  type AppLogger,
} from "../observability/logger.js";

const firstBlockPosition = 0;
const planStep = "plan";

export class PrismaLessonRepository implements LessonRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: AppLogger = createSilentLogger(),
  ) {}

  async findHomeLesson(learnerId: string): Promise<HomeLesson | null> {
    return this.observe("lesson.find_home", { learnerId }, async () => {
      const lesson = await this.prisma.lesson.findFirst({
        where: { learningTrack: { learnerId } },
        orderBy: { createdAt: "asc" },
        include: {
          blocks: { where: { position: firstBlockPosition }, take: 1 },
        },
      });
      if (!lesson) return null;
      return {
        id: lesson.id,
        status: lesson.status,
        block: lesson.blocks[0]
          ? lessonBlockSchema.parse(lesson.blocks[0].content)
          : null,
      };
    });
  }

  async findLessonProgress(
    learnerId: string,
    lessonId: string,
  ): Promise<LessonProgress | null> {
    return this.observe(
      "lesson.find_progress",
      { learnerId, lessonId },
      async () => {
        const lesson = await this.prisma.lesson.findFirst({
          where: { id: lessonId, learningTrack: { learnerId } },
          include: {
            blocks: { orderBy: { position: "asc" } },
            structuredModelRuns: { where: { step: { startsWith: "block:" } } },
          },
        });
        if (!lesson) return null;
        const plan = lesson.plan ? lessonPlanSchema.parse(lesson.plan) : null;
        const blocks = contiguousBlocks(
          lesson.blocks.map((block) => ({
            content: lessonBlockSchema.parse(block.content),
            position: block.position,
          })),
        );
        const nextPosition = blocks.length;
        const nextRun = latestRunForStep(
          lesson.structuredModelRuns,
          blockStep(nextPosition),
        );
        return {
          blocks,
          nextBlockStatus:
            !plan || nextPosition >= plan.blocks.length
              ? "complete"
              : nextRun?.status === "failed"
                ? "failed"
                : "preparing",
        };
      },
    );
  }

  async reserveFirstLesson(
    input: FirstLessonReservation,
  ): Promise<ReservedHomeLesson> {
    return this.observe(
      "lesson.reserve_first",
      {
        learnerId: input.learnerId,
        learningTrackId: input.learningTrackId,
        priorityCompetencyId: input.priorityCompetencyId,
      },
      () =>
        this.prisma.$transaction(async (tx) => {
          const existing = await tx.lesson.findUnique({
            where: {
              learningTrackId_priorityCompetencyId: {
                learningTrackId: input.learningTrackId,
                priorityCompetencyId: input.priorityCompetencyId,
              },
            },
          });
          if (existing) return toReservedHomeLesson(existing, false);

          const module = await tx.learningModule.upsert({
            where: {
              learningTrackId_objectiveCompetencyId: {
                learningTrackId: input.learningTrackId,
                objectiveCompetencyId: input.priorityCompetencyId,
              },
            },
            create: {
              id: createId(),
              learningTrackId: input.learningTrackId,
              objectiveCompetencyId: input.priorityCompetencyId,
              title: input.priorityCompetencyKey,
            },
            update: {},
          });
          try {
            const lesson = await tx.lesson.create({
              data: {
                id: createId(),
                learningTrackId: input.learningTrackId,
                moduleId: module.id,
                priorityCompetencyId: input.priorityCompetencyId,
              },
            });
            return toReservedHomeLesson(lesson, true);
          } catch (error) {
            if (!isUniqueConstraint(error)) throw error;
            const concurrent = await tx.lesson.findUniqueOrThrow({
              where: {
                learningTrackId_priorityCompetencyId: {
                  learningTrackId: input.learningTrackId,
                  priorityCompetencyId: input.priorityCompetencyId,
                },
              },
            });
            return toReservedHomeLesson(concurrent, false);
          }
        }),
    );
  }

  async retryFailedFirstLesson(
    learnerId: string,
  ): Promise<RetriedHomeLesson | null> {
    return this.observe(
      "lesson.retry_failed_first",
      { learnerId },
      async () => {
        const failedLesson = await this.prisma.lesson.findFirst({
          where: { status: "failed", learningTrack: { learnerId } },
          orderBy: { createdAt: "asc" },
          include: { priorityCompetency: { select: { key: true } } },
        });
        if (!failedLesson) return null;
        const resumed = await this.prisma.lesson.updateMany({
          where: { id: failedLesson.id, status: "failed" },
          data: { status: "preparing", failureCode: null },
        });
        if (resumed.count === 0) return null;
        return {
          ...toReservedHomeLesson(failedLesson, true),
          priorityCompetencyKey: failedLesson.priorityCompetency.key,
        };
      },
    );
  }

  async publishFirstBlock(input: {
    attempt: number;
    lessonId: string;
    plan: LessonPlan;
    block: LessonBlock;
    runs: { plan: StructuredModelRun; block: StructuredModelRun };
  }): Promise<void> {
    await this.observe(
      "lesson.publish_first_block",
      { lessonId: input.lessonId },
      () =>
        this.prisma.$transaction(async (tx) => {
          const published = await tx.lesson.updateMany({
            where: { id: input.lessonId, status: "preparing" },
            data: {
              status: "ready",
              failureCode: null,
              plan: input.plan,
              planAdapter: input.runs.plan.adapter,
              planModel: input.runs.plan.model,
              planPromptVersion: "v1",
              planContractVersion: "v1",
              blockAdapter: input.runs.block.adapter,
              blockModel: input.runs.block.model,
              blockPromptVersion: "v1",
              blockContractVersion: "v1",
            },
          });
          if (published.count === 0) return;
          await tx.lesson.update({
            where: { id: input.lessonId },
            data: { module: { update: { title: input.plan.title } } },
          });
          await Promise.all([
            tx.lessonBlock.upsert({
              where: {
                lessonId_position: {
                  lessonId: input.lessonId,
                  position: firstBlockPosition,
                },
              },
              create: {
                id: createId(),
                lessonId: input.lessonId,
                position: firstBlockPosition,
                content: input.block,
              },
              update: { content: input.block },
            }),
            upsertRun(
              tx,
              input.lessonId,
              planStep,
              input.attempt,
              input.runs.plan,
            ),
            upsertRun(
              tx,
              input.lessonId,
              blockStep(firstBlockPosition),
              input.attempt,
              input.runs.block,
            ),
            ...input.plan.blocks
              .slice(1)
              .map((_, position) =>
                upsertRun(
                  tx,
                  input.lessonId,
                  blockStep(position + 1),
                  input.attempt,
                  queuedRun(),
                ),
              ),
          ]);
        }),
    );
  }

  async persistBlockRun(input: PersistedRun): Promise<void> {
    await this.observe(
      "lesson.persist_block_run",
      { lessonId: input.lessonId, blockPosition: String(input.blockPosition) },
      () =>
        this.prisma.$transaction((tx) =>
          upsertRun(
            tx,
            input.lessonId,
            blockStep(input.blockPosition),
            input.attempt,
            input.run,
          ),
        ),
    );
  }

  async claimQueuedBlockRun(
    input: Omit<PersistedRun, "run">,
  ): Promise<boolean> {
    return this.observe(
      "lesson.claim_queued_block_run",
      { lessonId: input.lessonId, blockPosition: String(input.blockPosition) },
      async () => {
        const claimed = await this.prisma.structuredModelRun.updateMany({
          where: {
            lessonId: input.lessonId,
            step: blockStep(input.blockPosition),
            attempt: input.attempt,
            status: "queued",
          },
          data: { status: "pending" },
        });
        return claimed.count === 1;
      },
    );
  }

  async publishBlockRun(
    input: PersistedRun & { block: LessonBlock },
  ): Promise<void> {
    await this.observe(
      "lesson.publish_block_run",
      { lessonId: input.lessonId, blockPosition: String(input.blockPosition) },
      () =>
        this.prisma.$transaction(async (tx) => {
          await Promise.all([
            tx.lessonBlock.upsert({
              where: {
                lessonId_position: {
                  lessonId: input.lessonId,
                  position: input.blockPosition,
                },
              },
              create: {
                id: createId(),
                lessonId: input.lessonId,
                position: input.blockPosition,
                content: input.block,
              },
              update: { content: input.block },
            }),
            upsertRun(
              tx,
              input.lessonId,
              blockStep(input.blockPosition),
              input.attempt,
              input.run,
            ),
          ]);
        }),
    );
  }

  async findActiveBlockRuns(): Promise<ActiveLessonBlockRun[]> {
    return this.observe("lesson.find_active_block_runs", {}, async () => {
      const runs = await this.prisma.structuredModelRun.findMany({
        where: {
          status: { in: ["queued", "pending"] },
          step: { startsWith: "block:" },
        },
        include: {
          lesson: {
            include: {
              learningTrack: { include: { learner: true } },
              priorityCompetency: { select: { key: true } },
            },
          },
        },
      });
      return runs.flatMap((run) => {
        const plan = run.lesson.plan
          ? lessonPlanSchema.safeParse(run.lesson.plan)
          : null;
        const position = blockPositionFromStep(run.step);
        const context = run.lesson.learningTrack;
        if (
          !plan?.success ||
          position === null ||
          !context.learner.instructionLanguage ||
          !context.learningGoal
        ) {
          return [];
        }
        return [
          {
            attempt: run.attempt,
            blockPosition: position,
            lessonId: run.lessonId,
            plan: plan.data,
            context: {
              instructionLanguage: context.learner.instructionLanguage,
              targetLanguage: context.targetLanguage,
              primaryGoal: context.learningGoal,
              lessonEmphases: context.lessonEmphases,
              priorityCompetencyKey: run.lesson.priorityCompetency.key,
            },
            run: toStructuredModelRun(run),
          },
        ];
      });
    });
  }

  async failLesson(lessonId: string, errorCode: string): Promise<void> {
    await this.observe("lesson.mark_failed", { lessonId }, async () => {
      await this.prisma.lesson.update({
        where: { id: lessonId },
        data: { status: "failed", failureCode: errorCode.slice(0, 120) },
      });
    });
  }

  private async observe<T>(
    operation: string,
    correlation: Record<string, string>,
    task: () => Promise<T>,
  ): Promise<T> {
    const startedAt = performance.now();
    try {
      const result = await task();
      this.logger.debug(
        {
          ...correlation,
          durationMs: Math.round(performance.now() - startedAt),
          event: "prisma.operation.completed",
          operation,
          provider: "prisma",
          status: "completed",
        },
        "Prisma operation completed",
      );
      return result;
    } catch (error) {
      this.logger.error(
        {
          ...correlation,
          durationMs: Math.round(performance.now() - startedAt),
          err: errorMetadata(error),
          event: "prisma.operation.failed",
          operation,
          prismaCode: prismaErrorCode(error),
          provider: "prisma",
          status: "failed",
          ...errorMetadata(error),
        },
        "Prisma operation failed",
      );
      throw error;
    }
  }
}

function upsertRun(
  tx: Parameters<PrismaClient["$transaction"]>[0] extends (
    transaction: infer Transaction,
  ) => unknown
    ? Transaction
    : never,
  lessonId: string,
  step: string,
  attempt: number,
  run: StructuredModelRun,
) {
  const data = runData(attempt, run);
  return tx.structuredModelRun.upsert({
    where: { lessonId_step_attempt: { lessonId, step, attempt } },
    create: { id: createId(), lessonId, step, ...data },
    update: data,
  });
}

function runData(attempt: number, run: StructuredModelRun) {
  return {
    adapter: run.adapter,
    attempt,
    contractVersion: "v1",
    errorCode: run.errorCode?.slice(0, 120),
    inputTokens: run.usage?.inputTokens,
    latencyMs: run.latencyMs,
    model: run.model,
    outputTokens: run.usage?.outputTokens,
    promptVersion: "v1",
    providerReference: run.reference,
    status: run.status,
  };
}

function toStructuredModelRun(run: {
  adapter: string;
  errorCode: string | null;
  inputTokens: number | null;
  latencyMs: number | null;
  model: string;
  outputTokens: number | null;
  providerReference: string | null;
  status: "queued" | "pending" | "completed" | "failed";
}): StructuredModelRun {
  return {
    adapter: run.adapter,
    errorCode: run.errorCode ?? undefined,
    latencyMs: run.latencyMs ?? undefined,
    model: run.model,
    reference: run.providerReference ?? "",
    status: run.status,
    usage:
      run.inputTokens === null && run.outputTokens === null
        ? undefined
        : {
            inputTokens: run.inputTokens ?? undefined,
            outputTokens: run.outputTokens ?? undefined,
          },
  };
}

function contiguousBlocks(
  blocks: { content: LessonBlock; position: number }[],
): LessonBlock[] {
  const contiguous: LessonBlock[] = [];
  for (const block of blocks) {
    if (block.position !== contiguous.length) break;
    contiguous.push(block.content);
  }
  return contiguous;
}

function latestRunForStep<Run extends { attempt: number; step: string }>(
  runs: Run[],
  step: string,
): Run | undefined {
  return runs
    .filter((run) => run.step === step)
    .sort((left, right) => right.attempt - left.attempt)[0];
}

function queuedRun(): StructuredModelRun {
  return {
    adapter: "unsubmitted",
    model: "unsubmitted",
    reference: "",
    status: "queued",
  };
}

function blockStep(position: number): string {
  return `block:${position}`;
}

function blockPositionFromStep(step: string): number | null {
  const match = /^block:(\d+)$/.exec(step);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

function toReservedHomeLesson(
  lesson: {
    id: string;
    status: "preparing" | "ready" | "failed";
    moduleId: string;
    learningTrackId: string;
    priorityCompetencyId: string;
  },
  created: boolean,
): ReservedHomeLesson {
  return {
    lesson: { id: lesson.id, status: lesson.status, block: null },
    created,
    production: {
      moduleId: lesson.moduleId,
      learningTrackId: lesson.learningTrackId,
      priorityCompetencyId: lesson.priorityCompetencyId,
    },
  };
}

function isUniqueConstraint(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function prismaErrorCode(error: unknown): string | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    typeof error.code !== "string"
  ) {
    return undefined;
  }
  return error.code;
}
