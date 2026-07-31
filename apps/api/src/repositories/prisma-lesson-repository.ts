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
  ActiveLessonPlanRun,
  FirstLessonReservation,
  HomeLesson,
  LessonProgress,
  LessonRepository,
  PersistedRun,
  ReservedHomeLesson,
  RetryableLessonWork,
} from "../lessons/lesson-repository.js";
import {
  lessonValidationContextSchema,
  type LessonValidationContext,
} from "../lessons/lesson-semantic-validator.js";
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

  async findLessonValidationContext(
    lessonId: string,
  ): Promise<LessonValidationContext | null> {
    return this.observe(
      "lesson.find_validation_context",
      { lessonId },
      async () => {
        const lesson = await this.prisma.lesson.findUnique({
          where: { id: lessonId },
          include: {
            priorityCompetency: { select: { key: true } },
            learningTrack: {
              include: {
                competencyStates: {
                  include: { competency: { select: { key: true } } },
                },
                learner: { include: { profileIntroduction: true } },
              },
            },
          },
        });
        if (!lesson) return null;
        const track = lesson.learningTrack;
        const profile = track.learner.profileIntroduction;
        if (
          !track.learner.instructionLanguage ||
          !track.learningGoal ||
          track.lessonEmphases.length === 0
        ) {
          return null;
        }
        return lessonValidationContextSchema.parse({
          instructionLanguage: track.learner.instructionLanguage,
          targetLanguage: track.targetLanguage,
          primaryGoal: track.learningGoal,
          lessonEmphases: track.lessonEmphases,
          priorityCompetencyKey: lesson.priorityCompetency.key,
          learnerAgeRange: track.learner.ageRange,
          profileTopics: profile
            ? [
                ...(profile.jobOrField ? [profile.jobOrField] : []),
                ...profile.interests,
                ...profile.other,
              ]
            : [],
          competencyProfile: track.competencyStates.map((state) => ({
            competencyKey: state.competency.key,
            abilityEstimate: state.abilityEstimate,
            confidence: state.confidence,
          })),
        });
      },
    );
  }

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
      async () => {
        try {
          return await this.prisma.$transaction(async (tx) => {
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
                objectiveSelectionTrace: input.prioritySelectionTrace,
                title: input.priorityCompetencyKey,
              },
              update: {},
            });
            const lesson = await tx.lesson.create({
              data: {
                id: createId(),
                learningTrackId: input.learningTrackId,
                moduleId: module.id,
                priorityCompetencyId: input.priorityCompetencyId,
              },
            });
            return toReservedHomeLesson(lesson, true);
          });
        } catch (error) {
          if (!isUniqueConstraint(error)) throw error;
          const concurrent = await this.prisma.lesson.findUniqueOrThrow({
            where: {
              learningTrackId_priorityCompetencyId: {
                learningTrackId: input.learningTrackId,
                priorityCompetencyId: input.priorityCompetencyId,
              },
            },
          });
          return toReservedHomeLesson(concurrent, false);
        }
      },
    );
  }

  async prepareLessonRetry(
    learnerId: string,
    lessonId: string,
  ): Promise<RetryableLessonWork | null> {
    const context = await this.findLessonValidationContext(lessonId);
    if (!context) return null;
    return this.observe("lesson.prepare_retry", { learnerId, lessonId }, () =>
      this.prisma.$transaction(async (tx) => {
        const lesson = await tx.lesson.findFirst({
          where: { id: lessonId, learningTrack: { learnerId } },
          include: {
            blocks: { select: { position: true } },
            structuredModelRuns: {
              select: { attempt: true, status: true, step: true },
            },
          },
        });
        if (!lesson) return null;
        const plan = lesson.plan
          ? lessonPlanSchema.safeParse(lesson.plan)
          : null;
        const planAttempt =
          Math.max(
            0,
            ...lesson.structuredModelRuns
              .filter((run) => run.step === planStep)
              .map((run) => run.attempt),
          ) + 1;
        if (!plan?.success) {
          if (lesson.status !== "failed") return null;
          const claimed = await tx.lesson.updateMany({
            where: { id: lessonId, status: "failed" },
            data: { failureCode: null, status: "preparing" },
          });
          if (claimed.count === 0) return null;
          return {
            lesson: {
              id: lesson.id,
              learningTrackId: lesson.learningTrackId,
              moduleId: lesson.moduleId,
              priorityCompetencyId: lesson.priorityCompetencyId,
            },
            context,
            plan: null,
            planAttempt,
            blocks: [],
          };
        }

        const approved = new Set(lesson.blocks.map((block) => block.position));
        const blocks = plan.data.blocks.flatMap((_, blockPosition) => {
          if (approved.has(blockPosition)) return [];
          const latest = latestRunForStep(
            lesson.structuredModelRuns,
            blockStep(blockPosition),
          );
          if (latest && latest.status !== "failed") return [];
          return [
            {
              attempt: (latest?.attempt ?? 0) + 1,
              blockPosition,
            },
          ];
        });
        if (blocks.length === 0) return null;
        await Promise.all(
          blocks.map((block) =>
            upsertRun(
              tx,
              lessonId,
              blockStep(block.blockPosition),
              block.attempt,
              queuedRun(),
            ),
          ),
        );
        if (blocks.some((block) => block.blockPosition === 0)) {
          await tx.lesson.update({
            where: { id: lessonId },
            data: { failureCode: null, status: "preparing" },
          });
        }
        return {
          lesson: {
            id: lesson.id,
            learningTrackId: lesson.learningTrackId,
            moduleId: lesson.moduleId,
            priorityCompetencyId: lesson.priorityCompetencyId,
          },
          context,
          plan: plan.data,
          planAttempt,
          blocks,
        };
      }),
    );
  }

  async publishFirstBlock(input: {
    attempt: number;
    lessonId: string;
    plan: LessonPlan;
    block: LessonBlock;
    runs: {
      plan: { attempt: number; run: StructuredModelRun };
      block: { attempt: number; run: StructuredModelRun };
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
              blockAdapter: input.runs.block.run.adapter,
              blockModel: input.runs.block.run.model,
              blockPromptVersion: "v1",
              blockContractVersion: "v1",
            },
          });
          if (published.count === 0) return;
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
              input.runs.plan.attempt,
              input.runs.plan.run,
            ),
            upsertRun(
              tx,
              input.lessonId,
              blockStep(firstBlockPosition),
              input.runs.block.attempt,
              input.runs.block.run,
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

  async persistPlanRun(input: {
    attempt: number;
    lessonId: string;
    plan?: LessonPlan;
    run: StructuredModelRun;
  }): Promise<void> {
    await this.observe(
      "lesson.persist_plan_run",
      { lessonId: input.lessonId },
      () =>
        this.prisma.$transaction(async (tx) => {
          await upsertRun(
            tx,
            input.lessonId,
            planStep,
            input.attempt,
            input.run,
          );
          if (!input.plan) return;
          const existing = await tx.lesson.findUnique({
            where: { id: input.lessonId },
            select: { plan: true },
          });
          if (!existing || existing.plan !== null) return;
          const saved = await tx.lesson.updateMany({
            where: { id: input.lessonId, planAdapter: null },
            data: {
              plan: input.plan,
              planAdapter: input.run.adapter,
              planModel: input.run.model,
              planPromptVersion: "v1",
              planContractVersion: "v1",
            },
          });
          if (saved.count === 1) {
            await Promise.all([
              tx.lesson.update({
                where: { id: input.lessonId },
                data: { module: { update: { title: input.plan.title } } },
              }),
              ...input.plan.blocks.map((_, position) =>
                upsertRun(
                  tx,
                  input.lessonId,
                  blockStep(position),
                  input.attempt,
                  queuedRun(),
                ),
              ),
            ]);
          }
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
            ...(input.blockPosition === firstBlockPosition
              ? [
                  tx.lesson.update({
                    where: { id: input.lessonId },
                    data: {
                      blockAdapter: input.run.adapter,
                      blockContractVersion: "v1",
                      blockModel: input.run.model,
                      blockPromptVersion: "v1",
                      failureCode: null,
                      status: "ready",
                    },
                  }),
                ]
              : []),
          ]);
        }),
    );
  }

  async findActivePlanRuns(): Promise<ActiveLessonPlanRun[]> {
    return this.observe("lesson.find_active_plan_runs", {}, async () => {
      const runs = await this.prisma.structuredModelRun.findMany({
        where: {
          status: "pending",
          step: planStep,
        },
        include: {
          lesson: {
            include: {
              learningTrack: {
                include: {
                  competencyStates: {
                    include: { competency: { select: { key: true } } },
                  },
                  learner: { include: { profileIntroduction: true } },
                },
              },
              priorityCompetency: { select: { key: true } },
            },
          },
        },
      });
      return runs.flatMap((run) => {
        const track = run.lesson.learningTrack;
        if (
          !track.learner.instructionLanguage ||
          !track.learningGoal ||
          track.lessonEmphases.length === 0
        ) {
          return [];
        }
        const profile = track.learner.profileIntroduction;
        return [
          {
            attempt: run.attempt,
            lesson: {
              id: run.lesson.id,
              learningTrackId: run.lesson.learningTrackId,
              moduleId: run.lesson.moduleId,
              priorityCompetencyId: run.lesson.priorityCompetencyId,
            },
            context: lessonValidationContextSchema.parse({
              instructionLanguage: track.learner.instructionLanguage,
              targetLanguage: track.targetLanguage,
              primaryGoal: track.learningGoal,
              lessonEmphases: track.lessonEmphases,
              priorityCompetencyKey: run.lesson.priorityCompetency.key,
              learnerAgeRange: track.learner.ageRange,
              profileTopics: profile
                ? [
                    ...(profile.jobOrField ? [profile.jobOrField] : []),
                    ...profile.interests,
                    ...profile.other,
                  ]
                : [],
              competencyProfile: track.competencyStates.map((state) => ({
                competencyKey: state.competency.key,
                abilityEstimate: state.abilityEstimate,
                confidence: state.confidence,
              })),
            }),
            run: toStructuredModelRun(run),
          },
        ];
      });
    });
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
              learningTrack: {
                include: {
                  competencyStates: {
                    include: { competency: { select: { key: true } } },
                  },
                  learner: { include: { profileIntroduction: true } },
                },
              },
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
          run.lesson.status === "failed" ||
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
            context: lessonValidationContextSchema.parse({
              instructionLanguage: context.learner.instructionLanguage,
              targetLanguage: context.targetLanguage,
              primaryGoal: context.learningGoal,
              lessonEmphases: context.lessonEmphases,
              priorityCompetencyKey: run.lesson.priorityCompetency.key,
              learnerAgeRange: context.learner.ageRange,
              profileTopics: context.learner.profileIntroduction
                ? [
                    ...(context.learner.profileIntroduction.jobOrField
                      ? [context.learner.profileIntroduction.jobOrField]
                      : []),
                    ...context.learner.profileIntroduction.interests,
                    ...context.learner.profileIntroduction.other,
                  ]
                : [],
              competencyProfile: context.competencyStates.map((state) => ({
                competencyKey: state.competency.key,
                abilityEstimate: state.abilityEstimate,
                confidence: state.confidence,
              })),
            }),
            run: toStructuredModelRun(run),
          },
        ];
      });
    });
  }

  async failLesson(lessonId: string, errorCode: string): Promise<void> {
    await this.observe("lesson.mark_failed", { lessonId }, async () => {
      await this.prisma.$transaction([
        this.prisma.lesson.update({
          where: { id: lessonId },
          data: { status: "failed", failureCode: errorCode.slice(0, 120) },
        }),
        this.prisma.structuredModelRun.updateMany({
          where: { lessonId, status: "queued" },
          data: {
            status: "failed",
            errorCode: "lesson_generation_cancelled",
          },
        }),
      ]);
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
    promptVersion: (run.promptVersion ?? "v1").slice(0, 120),
    providerReference: run.reference,
    rejectionReason: run.rejectionReason?.slice(0, 120),
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
  promptVersion?: string;
  providerReference: string | null;
  rejectionReason?: string | null;
  status: "queued" | "pending" | "completed" | "failed";
}): StructuredModelRun {
  return {
    adapter: run.adapter,
    errorCode: run.errorCode ?? undefined,
    latencyMs: run.latencyMs ?? undefined,
    model: run.model,
    promptVersion: run.promptVersion,
    reference: run.providerReference ?? "",
    rejectionReason: run.rejectionReason ?? undefined,
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
