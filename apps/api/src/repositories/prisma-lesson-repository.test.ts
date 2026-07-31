import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../observability/logger.js";
import { PrismaLessonRepository } from "./prisma-lesson-repository.js";

const prioritySelectionTrace = {
  competencyId: "competency-1",
  competencyKey: "situational.greetings",
  score: 142,
  readiness: 1,
  foundationWeight: 100,
  basePriority: 80,
  goalFit: 90,
  knowledgeGap: 1,
  uncertainty: 1,
  reviewNeed: 0,
  recentRepetition: 0,
  selectionReason: "beginner_pre_a1_foundation" as const,
};

describe("PrismaLessonRepository", () => {
  it("stores the immutable priority decision with the module objective", async () => {
    const learningModule = {
      upsert: vi.fn(async () => ({ id: "module-1" })),
    };
    const lesson = {
      create: vi.fn(async () => ({
        id: "lesson-1",
        learningTrackId: "track-1",
        moduleId: "module-1",
        priorityCompetencyId: "competency-1",
        status: "preparing" as const,
      })),
      findUnique: vi.fn(async () => null),
    };
    const repository = new PrismaLessonRepository({
      lesson,
      async $transaction(task: (tx: unknown) => Promise<unknown>) {
        return task({ learningModule, lesson });
      },
    } as never);

    await repository.reserveFirstLesson({
      learnerId: "learner-1",
      learningTrackId: "track-1",
      priorityCompetencyId: "competency-1",
      priorityCompetencyKey: "situational.greetings",
      prioritySelectionTrace,
    });

    expect(learningModule.upsert).toHaveBeenCalledWith({
      where: {
        learningTrackId_objectiveCompetencyId: {
          learningTrackId: "track-1",
          objectiveCompetencyId: "competency-1",
        },
      },
      create: {
        id: expect.any(String),
        learningTrackId: "track-1",
        objectiveCompetencyId: "competency-1",
        objectiveSelectionTrace: prioritySelectionTrace,
        title: "situational.greetings",
      },
      update: {},
    });
  });

  it("returns the concurrently reserved Lesson after a unique constraint aborts its transaction", async () => {
    const concurrentLesson = {
      id: "lesson-1",
      learningTrackId: "track-1",
      moduleId: "module-1",
      priorityCompetencyId: "competency-1",
      status: "preparing" as const,
    };
    const findUniqueOrThrow = vi.fn(async () => concurrentLesson);
    const repository = new PrismaLessonRepository({
      lesson: { findUniqueOrThrow },
      async $transaction() {
        throw Object.assign(new Error("concurrent_reservation"), {
          code: "P2002",
        });
      },
    } as never);

    await expect(
      repository.reserveFirstLesson({
        learnerId: "learner-1",
        learningTrackId: "track-1",
        priorityCompetencyId: "competency-1",
        priorityCompetencyKey: "situational.greetings",
        prioritySelectionTrace: prioritySelectionTrace,
      }),
    ).resolves.toEqual({
      created: false,
      lesson: { block: null, id: "lesson-1", status: "preparing" },
      production: {
        learningTrackId: "track-1",
        moduleId: "module-1",
        priorityCompetencyId: "competency-1",
      },
    });
    expect(findUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        learningTrackId_priorityCompetencyId: {
          learningTrackId: "track-1",
          priorityCompetencyId: "competency-1",
        },
      },
    });
  });

  it("builds validation context from confirmed profile, Goal, emphasis, and competency state", async () => {
    const repository = new PrismaLessonRepository({
      lesson: {
        findUnique: vi.fn(async () => ({
          priorityCompetency: { key: "situational.greetings" },
          learningTrack: {
            targetLanguage: "en",
            learningGoal: "travel",
            lessonEmphases: ["reading", "writing"],
            learner: {
              instructionLanguage: "pt-BR",
              ageRange: "25_39",
              profileIntroduction: {
                jobOrField: "software",
                interests: ["music"],
                other: ["travel"],
              },
            },
            competencyStates: [
              {
                abilityEstimate: 0.25,
                confidence: 0.8,
                competency: { key: "situational.greetings" },
              },
            ],
          },
        })),
      },
    } as never);

    await expect(
      repository.findLessonValidationContext("lesson-1"),
    ).resolves.toEqual({
      instructionLanguage: "pt-BR",
      targetLanguage: "en",
      primaryGoal: "travel",
      lessonEmphases: ["reading", "writing"],
      priorityCompetencyKey: "situational.greetings",
      learnerAgeRange: "25_39",
      profileTopics: ["software", "music", "travel"],
      competencyProfile: [
        {
          competencyKey: "situational.greetings",
          abilityEstimate: 0.25,
          confidence: 0.8,
        },
      ],
    });
  });

  it("persists an approved immutable plan and its normalized run ledger before blocks", async () => {
    const structuredModelRun = { upsert: vi.fn(async () => ({})) };
    const lesson = {
      findUnique: vi.fn(async () => ({ plan: null })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async () => ({})),
    };
    const repository = new PrismaLessonRepository({
      lesson,
      structuredModelRun,
      async $transaction(task: (tx: unknown) => Promise<unknown>) {
        return task({ lesson, structuredModelRun });
      },
    } as never);

    await repository.persistPlanRun({
      attempt: 2,
      lessonId: "lesson-1",
      plan: {
        title: "Travel greetings",
        objective: "Greet someone while travelling.",
        alignment: {
          instructionLanguage: "pt-BR",
          targetLanguage: "en",
          primaryGoal: "travel",
          priorityCompetencyKey: "situational.greetings",
          priorityCompetencyState: null,
          lessonEmphases: ["reading"],
          profileTopics: [],
        },
        blocks: [
          {
            title: "Hello",
            objective: "Say hello.",
            emphasis: "reading",
          },
          {
            title: "Names",
            objective: "Ask a name.",
            emphasis: "reading",
          },
          {
            title: "Goodbye",
            objective: "End politely.",
            emphasis: "reading",
          },
        ],
      },
      run: {
        adapter: "openai",
        model: "gpt-test",
        status: "completed",
        reference: "resp-2",
        latencyMs: 120,
        promptVersion: "v2",
        rejectionReason: "profile_alignment",
        usage: { inputTokens: 10, outputTokens: 20 },
      },
    });

    expect(structuredModelRun.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          adapter: "openai",
          attempt: 2,
          inputTokens: 10,
          model: "gpt-test",
          outputTokens: 20,
          promptVersion: "v2",
          rejectionReason: "profile_alignment",
          step: "plan",
        }),
      }),
    );
    expect(lesson.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          plan: expect.objectContaining({ title: "Travel greetings" }),
        }),
      }),
    );
  });

  it("queues a new attempt only for missing work whose latest run failed", async () => {
    const plan = {
      title: "Travel greetings",
      objective: "Greet someone while travelling.",
      alignment: {
        instructionLanguage: "pt-BR",
        targetLanguage: "en",
        primaryGoal: "travel",
        priorityCompetencyKey: "situational.greetings",
        priorityCompetencyState: null,
        lessonEmphases: ["reading" as const],
        profileTopics: [],
      },
      blocks: [
        {
          title: "Hello",
          objective: "Say hello.",
          emphasis: "reading" as const,
        },
        {
          title: "Names",
          objective: "Ask a name.",
          emphasis: "reading" as const,
        },
        {
          title: "Goodbye",
          objective: "End politely.",
          emphasis: "reading" as const,
        },
      ],
    };
    const structuredModelRun = { upsert: vi.fn(async () => ({})) };
    const lesson = {
      findUnique: vi.fn(async () => ({
        priorityCompetency: { key: "situational.greetings" },
        learningTrack: {
          targetLanguage: "en",
          learningGoal: "travel",
          lessonEmphases: ["reading"],
          learner: {
            instructionLanguage: "pt-BR",
            ageRange: "25_39",
            profileIntroduction: null,
          },
          competencyStates: [],
        },
      })),
      findFirst: vi.fn(async () => ({
        id: "lesson-1",
        learningTrackId: "track-1",
        moduleId: "module-1",
        priorityCompetencyId: "competency-1",
        status: "ready",
        plan,
        blocks: [{ position: 0 }, { position: 2 }],
        structuredModelRuns: [
          { attempt: 1, status: "completed", step: "block:0" },
          { attempt: 2, status: "failed", step: "block:1" },
          { attempt: 1, status: "completed", step: "block:2" },
          { attempt: 1, status: "completed", step: "plan" },
        ],
      })),
    };
    const repository = new PrismaLessonRepository({
      lesson,
      structuredModelRun,
      async $transaction(task: (tx: unknown) => Promise<unknown>) {
        return task({ lesson, structuredModelRun });
      },
    } as never);

    await expect(
      repository.prepareLessonRetry("learner-1", "lesson-1"),
    ).resolves.toMatchObject({
      blocks: [{ attempt: 3, blockPosition: 1 }],
      plan,
    });
    expect(structuredModelRun.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          attempt: 3,
          status: "queued",
          step: "block:1",
        }),
      }),
    );
  });

  it("returns pending plan runs with enough context to recover after restart", async () => {
    const repository = new PrismaLessonRepository({
      structuredModelRun: {
        findMany: vi.fn(async () => [
          {
            adapter: "openai",
            attempt: 1,
            errorCode: null,
            inputTokens: 12,
            latencyMs: 80,
            model: "pinned-model",
            outputTokens: null,
            providerReference: "resp_pending",
            status: "pending",
            lesson: {
              id: "lesson-1",
              learningTrackId: "track-1",
              moduleId: "module-1",
              priorityCompetencyId: "competency-1",
              priorityCompetency: { key: "situational.greetings" },
              learningTrack: {
                targetLanguage: "en",
                learningGoal: "travel",
                lessonEmphases: ["reading"],
                learner: {
                  instructionLanguage: "pt-BR",
                  ageRange: "25_39",
                  profileIntroduction: null,
                },
                competencyStates: [],
              },
            },
          },
        ]),
      },
    } as never);

    await expect(repository.findActivePlanRuns()).resolves.toEqual([
      expect.objectContaining({
        attempt: 1,
        lesson: expect.objectContaining({ id: "lesson-1" }),
        context: expect.objectContaining({
          primaryGoal: "travel",
          priorityCompetencyKey: "situational.greetings",
        }),
        run: expect.objectContaining({
          model: "pinned-model",
          reference: "resp_pending",
          status: "pending",
        }),
      }),
    ]);
  });

  it("marks queued dependent work as failed when a Lesson fails", async () => {
    const lesson = { update: vi.fn(() => "lesson-update") };
    const structuredModelRun = {
      updateMany: vi.fn(() => "run-update"),
    };
    const transaction = vi.fn(async () => undefined);
    const repository = new PrismaLessonRepository({
      lesson,
      structuredModelRun,
      $transaction: transaction,
    } as never);

    await repository.failLesson("lesson-1", "lesson_semantic_rejected");

    expect(transaction).toHaveBeenCalledWith(["lesson-update", "run-update"]);
    expect(structuredModelRun.updateMany).toHaveBeenCalledWith({
      where: { lessonId: "lesson-1", status: "queued" },
      data: {
        status: "failed",
        errorCode: "lesson_generation_cancelled",
      },
    });
  });

  it("logs a safe Prisma code, operation, latency, and technical correlation", async () => {
    const failure = Object.assign(new Error("database_unavailable"), {
      code: "P2024",
    });
    const error = vi.fn();
    const repository = new PrismaLessonRepository(
      {
        lesson: {
          findFirst: vi.fn(async () => {
            throw failure;
          }),
        },
      } as never,
      { error } as unknown as AppLogger,
    );

    await expect(repository.findHomeLesson("learner-1")).rejects.toThrow(
      "database_unavailable",
    );

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: expect.any(Number),
        errorMessage: "database_unavailable",
        event: "prisma.operation.failed",
        learnerId: "learner-1",
        operation: "lesson.find_home",
        prismaCode: "P2024",
        provider: "prisma",
        status: "failed",
      }),
      "Prisma operation failed",
    );
  });
});
