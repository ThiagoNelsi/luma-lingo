import { createId, type PrismaClient } from "@luma-lingo/database";

import {
  lessonBlockSchema,
  type LessonBlock,
  type LessonPlan,
} from "../lessons/lesson-content.js";
import type {
  FirstLessonReservation,
  HomeLesson,
  LessonRepository,
  RetriedHomeLesson,
  ReservedHomeLesson,
} from "../lessons/lesson-repository.js";
import {
  createSilentLogger,
  errorMetadata,
  type AppLogger,
} from "../observability/logger.js";

const firstBlockPosition = 0;

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

  async findLessonBlock(
    learnerId: string,
    lessonId: string,
  ): Promise<LessonBlock | null> {
    return this.observe(
      "lesson.find_block",
      { learnerId, lessonId },
      async () => {
        const block = await this.prisma.lessonBlock.findFirst({
          where: {
            lessonId,
            position: firstBlockPosition,
            lesson: { learningTrack: { learnerId } },
          },
        });
        return block ? lessonBlockSchema.parse(block.content) : null;
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
          where: {
            status: "failed",
            learningTrack: { learnerId },
          },
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
    lessonId: string;
    plan: LessonPlan;
    block: LessonBlock;
    runs: {
      plan: { reference: string; adapter: string; model: string };
      block: { reference: string; adapter: string; model: string };
    };
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
            tx.lessonProductionRun.upsert({
              where: {
                lessonId_step: { lessonId: input.lessonId, step: "plan" },
              },
              create: {
                id: createId(),
                lessonId: input.lessonId,
                step: "plan",
                adapter: input.runs.plan.adapter,
                model: input.runs.plan.model,
                promptVersion: "v1",
                contractVersion: "v1",
                providerReference: input.runs.plan.reference,
              },
              update: {},
            }),
            tx.lessonProductionRun.upsert({
              where: {
                lessonId_step: {
                  lessonId: input.lessonId,
                  step: "first_block",
                },
              },
              create: {
                id: createId(),
                lessonId: input.lessonId,
                step: "first_block",
                adapter: input.runs.block.adapter,
                model: input.runs.block.model,
                promptVersion: "v1",
                contractVersion: "v1",
                providerReference: input.runs.block.reference,
              },
              update: {},
            }),
          ]);
        }),
    );
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
