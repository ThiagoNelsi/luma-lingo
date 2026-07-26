import { randomUUID } from "node:crypto";

import { PrismaClient } from "@luma-lingo/database";
import type { FastifyInstance } from "fastify";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { AuthProvider } from "../auth/auth-provider.js";
import type { AppConfig } from "../config.js";
import { PrismaDiagnosticAttemptRepository } from "../repositories/prisma-diagnostic-attempt-repository.js";
import { PrismaLearnerRepository } from "../repositories/prisma-learner-repository.js";
import { PrismaOnboardingCompletionRepository } from "../repositories/prisma-onboarding-completion-repository.js";
import { PrismaSessionRepository } from "../repositories/prisma-session-repository.js";
import { PrismaUserRepository } from "../repositories/prisma-user-repository.js";
import { hashSessionToken } from "../sessions/session-token.js";
import { createApp } from "../http/app.js";
import type {
  StructuredModel,
  StructuredModelRequest,
  StructuredModelRun,
} from "../models/structured-model.js";
import { HomeService } from "./home-service.js";
import { LessonProductionService } from "./lesson-production-service.js";
import { PrismaLessonRepository } from "../repositories/prisma-lesson-repository.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = testDatabaseUrl ? describe : describe.skip;

integrationDescribe("Lesson flow with Fastify, Prisma, and PostgreSQL", () => {
  let prisma: PrismaClient;
  const userIds = new Set<string>();
  const catalogIds = new Set<string>();
  const openApps = new Set<FastifyInstance>();

  beforeAll(async () => {
    if (process.env.ALLOW_INTEGRATION_DATABASE !== "1") {
      throw new Error("integration_database_not_explicitly_allowed");
    }
    if (!testDatabaseUrl) throw new Error("test_database_url_required");
    const parsed = new URL(testDatabaseUrl);
    if (
      parsed.protocol !== "postgresql:" ||
      !parsed.hostname.endsWith(".neon.tech")
    ) {
      throw new Error("integration_database_must_be_neon_postgres");
    }
    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl } },
    });
    await prisma.$queryRaw`SELECT 1`;
  });

  afterEach(async () => {
    await Promise.all([...openApps].map((app) => app.close()));
    openApps.clear();
    await prisma.$transaction([
      prisma.user.deleteMany({ where: { id: { in: [...userIds] } } }),
      prisma.competencyCatalog.deleteMany({
        where: { id: { in: [...catalogIds] } },
      }),
    ]);
    userIds.clear();
    catalogIds.clear();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("generates the first Lesson from an authenticated Home request and reveals every block", async () => {
    const fixture = await seedLearner(prisma);
    userIds.add(fixture.userId);
    catalogIds.add(fixture.catalogId);
    const repository = new PrismaLessonRepository(prisma);
    let runNumber = 0;
    const production = new LessonProductionService({
      repository,
      model: immediateLessonModel(() => {
        runNumber += 1;
        return `initial-generation-${runNumber}`;
      }),
      moderator: safeModerator(),
    });
    const app = await createIntegrationApp(prisma, repository, production, {
      priority: fixture,
    });
    openApps.add(app);

    const preparing = await app.inject({
      method: "GET",
      url: "/me/home",
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    expect(preparing.statusCode).toBe(200);
    expect(preparing.json()).toMatchObject({ status: "preparing" });
    const lessonId = preparing.json<{ lessonId: string }>().lessonId;

    await vi.waitFor(
      async () => {
        const lesson = await app.inject({
          method: "GET",
          url: `/me/lessons/${lessonId}`,
          headers: { cookie: sessionCookie(fixture.sessionToken) },
        });
        expect(lesson.statusCode).toBe(200);
        expect(lesson.json()).toMatchObject({
          lessonId,
          nextBlockStatus: "complete",
        });
        expect(lesson.json<{ blocks: unknown[] }>().blocks).toHaveLength(3);
      },
      { interval: 100, timeout: 15_000 },
    );

    const ready = await app.inject({
      method: "GET",
      url: "/me/home",
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toMatchObject({ lessonId, status: "ready" });
  }, 40_000);

  it("polls one preparing Lesson without starting duplicate production", async () => {
    const fixture = await seedLearner(prisma);
    userIds.add(fixture.userId);
    catalogIds.add(fixture.catalogId);
    const repository = new PrismaLessonRepository(prisma);
    const pendingPlan = deferred<StructuredModelRun>();
    const start = vi.fn(async (request: StructuredModelRequest<unknown>) =>
      request.workload === "lesson_plan"
        ? pendingPlan.promise
        : completedRun(
            blockFor(requestObjective(request)),
            `polling-${request.correlation?.attempt}-${requestObjective(request)}`,
          ),
    );
    const production = new LessonProductionService({
      repository,
      model: {
        start,
        async retry() {
          throw new Error("unused");
        },
        async inspect() {
          throw new Error("unused");
        },
      },
      moderator: safeModerator(),
    });
    const app = await createIntegrationApp(prisma, repository, production, {
      priority: fixture,
    });
    openApps.add(app);

    const first = await app.inject({
      method: "GET",
      url: "/me/home",
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    const second = await app.inject({
      method: "GET",
      url: "/me/home",
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    const third = await app.inject({
      method: "GET",
      url: "/me/home",
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    expect([first.json(), second.json(), third.json()]).toEqual([
      expect.objectContaining({
        lessonId: first.json<{ lessonId: string }>().lessonId,
        status: "preparing",
      }),
      expect.objectContaining({
        lessonId: first.json<{ lessonId: string }>().lessonId,
        status: "preparing",
      }),
      expect.objectContaining({
        lessonId: first.json<{ lessonId: string }>().lessonId,
        status: "preparing",
      }),
    ]);
    await vi.waitFor(
      () => {
        expect(
          start.mock.calls.filter(
            ([request]) => request.workload === "lesson_plan",
          ),
        ).toHaveLength(1);
      },
      { interval: 100, timeout: 10_000 },
    );

    pendingPlan.resolve(completedRun(lessonPlan(), "polling-plan"));
    await vi.waitFor(
      async () => {
        const home = await app.inject({
          method: "GET",
          url: "/me/home",
          headers: { cookie: sessionCookie(fixture.sessionToken) },
        });
        expect(home.json()).toMatchObject({
          lessonId: first.json<{ lessonId: string }>().lessonId,
          status: "ready",
        });
      },
      { interval: 100, timeout: 15_000 },
    );
  }, 40_000);

  it("returns a previously generated Lesson after the API is recreated without generating it again", async () => {
    const fixture = await seedLearner(prisma);
    userIds.add(fixture.userId);
    catalogIds.add(fixture.catalogId);
    const repository = new PrismaLessonRepository(prisma);
    const initialProduction = new LessonProductionService({
      repository,
      model: immediateLessonModel(() => `before-restart-${randomUUID()}`),
      moderator: safeModerator(),
    });
    const initialApp = await createIntegrationApp(
      prisma,
      repository,
      initialProduction,
      { priority: fixture },
    );
    openApps.add(initialApp);

    const preparing = await initialApp.inject({
      method: "GET",
      url: "/me/home",
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    const lessonId = preparing.json<{ lessonId: string }>().lessonId;
    await vi.waitFor(
      async () => {
        const lesson = await initialApp.inject({
          method: "GET",
          url: `/me/lessons/${lessonId}`,
          headers: { cookie: sessionCookie(fixture.sessionToken) },
        });
        expect(lesson.json()).toMatchObject({
          lessonId,
          nextBlockStatus: "complete",
        });
      },
      { interval: 100, timeout: 15_000 },
    );
    await initialApp.close();
    openApps.delete(initialApp);

    const start = vi.fn(async () => {
      throw new Error("existing_lesson_must_not_be_generated_again");
    });
    const recreatedProduction = new LessonProductionService({
      repository,
      model: {
        start,
        async retry() {
          throw new Error("unused");
        },
        async inspect() {
          throw new Error("unused");
        },
      },
      moderator: safeModerator(),
    });
    const recreatedApp = await createIntegrationApp(
      prisma,
      repository,
      recreatedProduction,
    );
    openApps.add(recreatedApp);

    const home = await recreatedApp.inject({
      method: "GET",
      url: "/me/home",
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    const lesson = await recreatedApp.inject({
      method: "GET",
      url: `/me/lessons/${lessonId}`,
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    expect(home.json()).toMatchObject({ lessonId, status: "ready" });
    expect(lesson.json()).toMatchObject({
      lessonId,
      nextBlockStatus: "complete",
    });
    expect(lesson.json<{ blocks: unknown[] }>().blocks).toHaveLength(3);
    expect(start).not.toHaveBeenCalled();
  }, 40_000);

  it("reserves and produces only one Lesson under concurrent Home requests", async () => {
    const fixture = await seedLearner(prisma);
    userIds.add(fixture.userId);
    catalogIds.add(fixture.catalogId);
    const repository = new PrismaLessonRepository(prisma);
    const pendingPlan = deferred<StructuredModelRun>();
    const start = vi.fn(async (request: StructuredModelRequest<unknown>) =>
      request.workload === "lesson_plan"
        ? pendingPlan.promise
        : completedRun(
            blockFor(requestObjective(request)),
            `concurrent-${request.correlation?.attempt}-${requestObjective(request)}`,
          ),
    );
    const production = new LessonProductionService({
      repository,
      model: {
        start,
        async retry() {
          throw new Error("unused");
        },
        async inspect() {
          throw new Error("unused");
        },
      },
      moderator: safeModerator(),
    });
    const app = await createIntegrationApp(prisma, repository, production, {
      priority: fixture,
    });
    openApps.add(app);

    const [left, right] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/me/home",
        headers: { cookie: sessionCookie(fixture.sessionToken) },
      }),
      app.inject({
        method: "GET",
        url: "/me/home",
        headers: { cookie: sessionCookie(fixture.sessionToken) },
      }),
    ]);
    expect(left.statusCode, left.body).toBe(200);
    expect(right.statusCode, right.body).toBe(200);
    expect(left.json()).toMatchObject({ status: "preparing" });
    expect(right.json()).toMatchObject({
      lessonId: left.json<{ lessonId: string }>().lessonId,
      status: "preparing",
    });
    await vi.waitFor(
      () => {
        expect(
          start.mock.calls.filter(
            ([request]) => request.workload === "lesson_plan",
          ),
        ).toHaveLength(1);
      },
      { interval: 100, timeout: 10_000 },
    );

    const lessons = await prisma.lesson.findMany({
      where: { learningTrackId: fixture.learningTrackId },
      select: { id: true },
    });
    expect(lessons).toEqual([
      { id: left.json<{ lessonId: string }>().lessonId },
    ]);

    pendingPlan.resolve(completedRun(lessonPlan(), "concurrent-plan"));
    await vi.waitFor(
      async () => {
        const home = await app.inject({
          method: "GET",
          url: "/me/home",
          headers: { cookie: sessionCookie(fixture.sessionToken) },
        });
        expect(home.json()).toMatchObject({ status: "ready" });
      },
      { interval: 100, timeout: 15_000 },
    );
  }, 40_000);

  it("publishes nothing after repeated plan rejection and accepts a safe manual retry", async () => {
    const fixture = await seedLearner(prisma);
    userIds.add(fixture.userId);
    catalogIds.add(fixture.catalogId);
    const repository = new PrismaLessonRepository(prisma);
    let rejectContent = true;
    const production = new LessonProductionService({
      repository,
      model: immediateLessonModel(() => `rejected-plan-${randomUUID()}`),
      moderator: {
        async moderate() {
          return rejectContent
            ? {
                flagged: true,
                flaggedCategories: ["violence"],
                model: "integration-moderator",
                reference: "unsafe-plan",
              }
            : {
                flagged: false,
                flaggedCategories: [],
                model: "integration-moderator",
                reference: "safe-retry",
              };
        },
      },
    });
    const app = await createIntegrationApp(prisma, repository, production, {
      priority: fixture,
    });
    openApps.add(app);

    const preparing = await app.inject({
      method: "GET",
      url: "/me/home",
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    const lessonId = preparing.json<{ lessonId: string }>().lessonId;
    await vi.waitFor(
      async () => {
        const home = await app.inject({
          method: "GET",
          url: "/me/home",
          headers: { cookie: sessionCookie(fixture.sessionToken) },
        });
        expect(home.json()).toMatchObject({ lessonId, status: "failed" });
      },
      { interval: 100, timeout: 15_000 },
    );

    const rejected = await prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      include: {
        blocks: true,
        structuredModelRuns: { orderBy: { attempt: "asc" } },
      },
    });
    expect(rejected.blocks).toHaveLength(0);
    expect(rejected.failureCode).toBe("lesson_content_moderation_rejected");
    expect(rejected.structuredModelRuns).toEqual([
      expect.objectContaining({
        attempt: 1,
        rejectionReason: "unsafe_content",
        status: "failed",
        step: "plan",
      }),
      expect.objectContaining({
        attempt: 2,
        rejectionReason: "unsafe_content",
        status: "failed",
        step: "plan",
      }),
    ]);

    rejectContent = false;
    const retry = await app.inject({
      method: "POST",
      url: `/me/lessons/${lessonId}/retry`,
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    expect(retry.statusCode, retry.body).toBe(202);
    await vi.waitFor(
      async () => {
        const lesson = await app.inject({
          method: "GET",
          url: `/me/lessons/${lessonId}`,
          headers: { cookie: sessionCookie(fixture.sessionToken) },
        });
        expect(lesson.json()).toMatchObject({ nextBlockStatus: "complete" });
        expect(lesson.json<{ blocks: unknown[] }>().blocks).toHaveLength(3);
      },
      { interval: 100, timeout: 15_000 },
    );
  }, 40_000);

  it("keeps approved blocks visible and retries only a later failed block", async () => {
    const fixture = await seedLearner(prisma);
    userIds.add(fixture.userId);
    catalogIds.add(fixture.catalogId);
    const repository = new PrismaLessonRepository(prisma);
    const failedObjective = lessonPlan().blocks[1]?.objective ?? "";
    let rejectSecondBlock = true;
    const runFor = (request: StructuredModelRequest<unknown>) => {
      if (request.workload === "lesson_plan") {
        return completedRun(lessonPlan(), `partial-plan-${randomUUID()}`);
      }
      const objective = requestObjective(request);
      return rejectSecondBlock && objective === failedObjective
        ? completedRun({ invalid: true }, `partial-invalid-${randomUUID()}`)
        : completedRun(blockFor(objective), `partial-block-${randomUUID()}`);
    };
    const production = new LessonProductionService({
      repository,
      model: {
        async start(request) {
          return runFor(request);
        },
        async retry(request) {
          return runFor(request);
        },
        async inspect() {
          throw new Error("unused");
        },
      },
      moderator: safeModerator(),
    });
    const app = await createIntegrationApp(prisma, repository, production, {
      priority: fixture,
    });
    openApps.add(app);

    const preparing = await app.inject({
      method: "GET",
      url: "/me/home",
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    const lessonId = preparing.json<{ lessonId: string }>().lessonId;
    let approvedFirstBlock: unknown;
    await vi.waitFor(
      async () => {
        const lesson = await app.inject({
          method: "GET",
          url: `/me/lessons/${lessonId}`,
          headers: { cookie: sessionCookie(fixture.sessionToken) },
        });
        expect(lesson.json()).toMatchObject({ nextBlockStatus: "failed" });
        const blocks = lesson.json<{ blocks: unknown[] }>().blocks;
        expect(blocks).toHaveLength(1);
        approvedFirstBlock = blocks[0];
      },
      { interval: 100, timeout: 15_000 },
    );

    rejectSecondBlock = false;
    const retry = await app.inject({
      method: "POST",
      url: `/me/lessons/${lessonId}/retry`,
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    expect(retry.statusCode, retry.body).toBe(202);
    await vi.waitFor(
      async () => {
        const lesson = await app.inject({
          method: "GET",
          url: `/me/lessons/${lessonId}`,
          headers: { cookie: sessionCookie(fixture.sessionToken) },
        });
        expect(lesson.json()).toMatchObject({ nextBlockStatus: "complete" });
        const blocks = lesson.json<{ blocks: unknown[] }>().blocks;
        expect(blocks).toHaveLength(3);
        expect(blocks[0]).toEqual(approvedFirstBlock);
      },
      { interval: 100, timeout: 15_000 },
    );

    const runs = await prisma.structuredModelRun.findMany({
      where: { lessonId, step: { in: ["block:1", "block:2"] } },
      orderBy: [{ step: "asc" }, { attempt: "asc" }],
      select: { attempt: true, status: true, step: true },
    });
    expect(runs).toEqual([
      { attempt: 1, status: "failed", step: "block:1" },
      { attempt: 2, status: "failed", step: "block:1" },
      { attempt: 3, status: "completed", step: "block:1" },
      { attempt: 1, status: "completed", step: "block:2" },
    ]);
  }, 40_000);

  it("moves an authenticated retry from attempt 7 to approved attempt 8 and returns ready through HTTP", async () => {
    const fixture = await seedFailedLesson(prisma, 6);
    userIds.add(fixture.userId);
    catalogIds.add(fixture.catalogId);
    const repository = new PrismaLessonRepository(prisma);
    let moderationCall = 0;
    let runNumber = 0;
    const model = immediateLessonModel(() => {
      runNumber += 1;
      return `integration-run-${runNumber}`;
    });
    const production = new LessonProductionService({
      repository,
      model,
      moderator: {
        async moderate() {
          moderationCall += 1;
          return moderationCall === 1
            ? {
                flagged: true,
                flaggedCategories: ["violence"],
                model: "integration-moderator",
                reference: "moderation-rejected",
              }
            : {
                flagged: false,
                flaggedCategories: [],
                model: "integration-moderator",
                reference: `moderation-approved-${moderationCall}`,
              };
        },
      },
    });
    const app = await createIntegrationApp(prisma, repository, production);
    openApps.add(app);

    const retry = await app.inject({
      method: "POST",
      url: `/me/lessons/${fixture.lessonId}/retry`,
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    expect(retry.statusCode, retry.body).toBe(202);
    expect(retry.json()).toEqual({ accepted: true });

    await vi.waitFor(
      async () => {
        const lesson = await prisma.lesson.findUniqueOrThrow({
          where: { id: fixture.lessonId },
          include: { blocks: true },
        });
        expect(lesson.status).toBe("ready");
        expect(lesson.blocks).toHaveLength(3);
      },
      { interval: 100, timeout: 15_000 },
    );

    const home = await app.inject({
      method: "GET",
      url: "/me/home",
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    expect(home.statusCode).toBe(200);
    expect(home.json()).toMatchObject({
      status: "ready",
      lessonId: fixture.lessonId,
    });

    const lesson = await app.inject({
      method: "GET",
      url: `/me/lessons/${fixture.lessonId}`,
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    expect(lesson.statusCode).toBe(200);
    const lessonBody = lesson.json();
    expect(lessonBody).toMatchObject({
      lessonId: fixture.lessonId,
      nextBlockStatus: "complete",
    });
    expect(lessonBody.blocks).toHaveLength(3);
    expect(lessonBody.blocks[0]).toMatchObject({
      objective: lessonPlan().blocks[0]?.objective,
    });

    const runs = await prisma.structuredModelRun.findMany({
      where: { lessonId: fixture.lessonId },
      orderBy: [{ step: "asc" }, { attempt: "asc" }],
    });
    expect(runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attempt: 7,
          rejectionReason: "unsafe_content",
          status: "failed",
          step: "plan",
        }),
        expect.objectContaining({
          attempt: 8,
          status: "completed",
          step: "plan",
        }),
        expect.objectContaining({
          attempt: 8,
          status: "completed",
          step: "block:0",
        }),
      ]),
    );

    await app.close();
    openApps.delete(app);
  }, 40_000);

  it("recovers a persisted pending plan after the API is recreated", async () => {
    const fixture = await seedFailedLesson(prisma, 0);
    userIds.add(fixture.userId);
    catalogIds.add(fixture.catalogId);
    const repository = new PrismaLessonRepository(prisma);
    const interruptedProduction = new LessonProductionService({
      repository,
      moderator: safeModerator(),
      model: {
        async start(request) {
          if (request.workload !== "lesson_plan")
            throw new Error("unexpected_workload");
          return {
            adapter: "integration",
            model: "integration-model",
            promptVersion: request.promptVersion,
            reference: "pending-plan-before-restart",
            status: "pending",
          };
        },
        async retry() {
          throw new Error("unused");
        },
        async inspect() {
          throw new Error("api_restarted_before_inspection");
        },
      },
    });
    const interruptedApp = await createIntegrationApp(
      prisma,
      repository,
      interruptedProduction,
    );
    openApps.add(interruptedApp);

    const retry = await interruptedApp.inject({
      method: "POST",
      url: `/me/lessons/${fixture.lessonId}/retry`,
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    expect(retry.statusCode, retry.body).toBe(202);
    await waitForRun(prisma, fixture.lessonId, "plan", 1, "pending");
    await interruptedApp.close();
    openApps.delete(interruptedApp);

    const recoveredProduction = new LessonProductionService({
      repository,
      moderator: safeModerator(),
      model: {
        async start(request) {
          if (request.workload !== "lesson_block")
            throw new Error("unexpected_workload");
          return completedRun(
            blockFor(requestObjective(request)),
            `recovered-plan-block-${requestObjective(request)}`,
          );
        },
        async retry() {
          throw new Error("unused");
        },
        async inspect(_reference, _correlation, workload) {
          if (workload !== "lesson_plan")
            throw new Error("unexpected_workload");
          return completedRun(lessonPlan(), "inspected-pending-plan");
        },
      },
    });
    await recoveredProduction.recoverInterrupted();
    const recoveredApp = await createIntegrationApp(
      prisma,
      repository,
      recoveredProduction,
    );
    openApps.add(recoveredApp);

    await vi.waitFor(
      async () => {
        const lesson = await recoveredApp.inject({
          method: "GET",
          url: `/me/lessons/${fixture.lessonId}`,
          headers: { cookie: sessionCookie(fixture.sessionToken) },
        });
        expect(lesson.json()).toMatchObject({ nextBlockStatus: "complete" });
        expect(lesson.json<{ blocks: unknown[] }>().blocks).toHaveLength(3);
      },
      { interval: 100, timeout: 15_000 },
    );
  }, 40_000);

  it("keeps a provider plan pending across recovery without duplicating model work", async () => {
    const fixture = await seedFailedLesson(prisma, 0);
    userIds.add(fixture.userId);
    catalogIds.add(fixture.catalogId);
    const repository = new PrismaLessonRepository(prisma);
    const interruptedStart = vi.fn(
      async (request: StructuredModelRequest<unknown>) => ({
        adapter: "integration",
        model: "integration-model",
        promptVersion: request.promptVersion,
        reference: "provider-plan-still-pending",
        status: "pending" as const,
      }),
    );
    const interruptedProduction = new LessonProductionService({
      repository,
      moderator: safeModerator(),
      model: {
        start: interruptedStart,
        async retry() {
          throw new Error("unused");
        },
        async inspect() {
          throw new Error("api_restarted_before_inspection");
        },
      },
    });
    const interruptedApp = await createIntegrationApp(
      prisma,
      repository,
      interruptedProduction,
    );
    openApps.add(interruptedApp);

    const retry = await interruptedApp.inject({
      method: "POST",
      url: `/me/lessons/${fixture.lessonId}/retry`,
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    expect(retry.statusCode, retry.body).toBe(202);
    await waitForRun(prisma, fixture.lessonId, "plan", 1, "pending");
    await interruptedApp.close();
    openApps.delete(interruptedApp);

    const recoveredStart = vi.fn();
    const recoveredRetry = vi.fn();
    const inspect = vi.fn(
      async (
        _reference: string,
        _correlation:
          StructuredModelRequest<unknown>["correlation"] | undefined,
        workload: StructuredModelRequest<unknown>["workload"] | undefined,
      ) => {
        if (workload !== "lesson_plan") throw new Error("unexpected_workload");
        return {
          adapter: "integration",
          model: "integration-model",
          reference: "provider-plan-still-pending",
          status: "pending" as const,
        };
      },
    );
    const recoveredProduction = new LessonProductionService({
      repository,
      moderator: safeModerator(),
      model: {
        start: recoveredStart,
        retry: recoveredRetry,
        inspect,
      },
    });
    await recoveredProduction.recoverInterrupted();
    await recoveredProduction.recoverInterrupted();
    const recoveredApp = await createIntegrationApp(
      prisma,
      repository,
      recoveredProduction,
    );
    openApps.add(recoveredApp);

    const home = await recoveredApp.inject({
      method: "GET",
      url: "/me/home",
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    expect(home.json()).toMatchObject({
      lessonId: fixture.lessonId,
      status: "preparing",
    });
    expect(interruptedStart).toHaveBeenCalledOnce();
    expect(inspect).toHaveBeenCalledTimes(2);
    expect(recoveredStart).not.toHaveBeenCalled();
    expect(recoveredRetry).not.toHaveBeenCalled();
    const runs = await prisma.structuredModelRun.findMany({
      where: { lessonId: fixture.lessonId, step: "plan" },
      select: { attempt: true, providerReference: true, status: true },
    });
    expect(runs).toEqual([
      {
        attempt: 1,
        providerReference: "provider-plan-still-pending",
        status: "pending",
      },
    ]);
  }, 40_000);

  it("recovers persisted pending work after the API service is recreated", async () => {
    const fixture = await seedFailedLesson(prisma, 0);
    userIds.add(fixture.userId);
    catalogIds.add(fixture.catalogId);
    const repository = new PrismaLessonRepository(prisma);
    const interruptedProduction = new LessonProductionService({
      repository,
      moderator: safeModerator(),
      model: {
        async start(request) {
          if (request.workload === "lesson_plan") {
            return completedRun(lessonPlan(), "plan-before-restart");
          }
          return {
            adapter: "integration",
            model: "integration-model",
            promptVersion: request.promptVersion,
            reference: "pending-first-block",
            status: "pending",
          };
        },
        async retry() {
          throw new Error("unused");
        },
        async inspect() {
          throw new Error("api_restarted_before_inspection");
        },
      },
    });
    const interruptedApp = await createIntegrationApp(
      prisma,
      repository,
      interruptedProduction,
    );
    openApps.add(interruptedApp);

    const retry = await interruptedApp.inject({
      method: "POST",
      url: `/me/lessons/${fixture.lessonId}/retry`,
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    expect(retry.statusCode, retry.body).toBe(202);
    await vi.waitFor(
      async () => {
        const pending = await prisma.structuredModelRun.findUnique({
          where: {
            lessonId_step_attempt: {
              attempt: 1,
              lessonId: fixture.lessonId,
              step: "block:0",
            },
          },
        });
        expect(pending?.status).toBe("pending");
      },
      { interval: 100, timeout: 10_000 },
    );
    await interruptedApp.close();
    openApps.delete(interruptedApp);

    const recoveredProduction = new LessonProductionService({
      repository,
      moderator: safeModerator(),
      model: {
        async start(request) {
          const objective = requestObjective(request);
          return completedRun(
            blockFor(objective),
            `recovered-${request.correlation?.attempt}-${objective}`,
          );
        },
        async retry() {
          throw new Error("unused");
        },
        async inspect(_reference, _correlation, workload) {
          if (workload !== "lesson_block")
            throw new Error("unexpected_workload");
          return completedRun(
            blockFor(lessonPlan().blocks[0]?.objective ?? ""),
            "inspected-first-block",
          );
        },
      },
    });
    await recoveredProduction.recoverInterrupted();
    const recoveredApp = await createIntegrationApp(
      prisma,
      repository,
      recoveredProduction,
    );
    openApps.add(recoveredApp);

    const home = await recoveredApp.inject({
      method: "GET",
      url: "/me/home",
      headers: { cookie: sessionCookie(fixture.sessionToken) },
    });
    expect(home.statusCode).toBe(200);
    expect(home.json()).toMatchObject({
      status: "ready",
      lessonId: fixture.lessonId,
    });
    const persisted = await prisma.lesson.findUniqueOrThrow({
      where: { id: fixture.lessonId },
      include: { blocks: true },
    });
    expect(persisted.status).toBe("ready");
    expect(persisted.blocks).toHaveLength(3);

    await recoveredApp.close();
    openApps.delete(recoveredApp);
  }, 40_000);
});

async function createIntegrationApp(
  prisma: PrismaClient,
  repository: PrismaLessonRepository,
  production: LessonProductionService,
  options: {
    priority?: { competencyId: string; competencyKey: string };
  } = {},
) {
  return createApp({
    authProvider: integrationAuthProvider,
    config: integrationAppConfig,
    diagnosticAttempts: new PrismaDiagnosticAttemptRepository(prisma),
    home: new HomeService({
      foregroundBudgetMs: 0,
      lessons: repository,
      priorities: {
        async findInitialLearningPriority() {
          if (!options.priority) throw new Error("unused");
          return {
            basePriority: 100,
            competencyId: options.priority.competencyId,
            competencyKey: options.priority.competencyKey,
            foundationWeight: 100,
            goalFit: 100,
            knowledgeGap: 1,
            readiness: 1,
            recentRepetition: 0,
            reviewNeed: 0,
            score: 100,
            selectionReason: "beginner_pre_a1_foundation" as const,
            uncertainty: 1,
          };
        },
      },
      production,
    }),
    learners: new PrismaLearnerRepository(prisma),
    onboardingCompletion: new PrismaOnboardingCompletionRepository(prisma),
    sessions: new PrismaSessionRepository(prisma),
    users: new PrismaUserRepository(prisma),
  });
}

async function seedLearner(prisma: PrismaClient) {
  const catalogId = randomUUID();
  const competencyId = randomUUID();
  const competencyKey = "introduce-yourself";
  const userId = randomUUID();
  const learnerId = randomUUID();
  const learningTrackId = randomUUID();
  const sessionToken = `integration-session-${randomUUID()}`;
  const now = new Date();

  await prisma.competencyCatalog.create({
    data: {
      id: catalogId,
      targetLanguage: "en",
      version: `integration-${randomUUID()}`,
      status: "published",
      publishedAt: now,
      competencies: {
        create: {
          id: competencyId,
          key: competencyKey,
          title: "Introduce yourself",
          family: "situational",
          taxonomyId: `integration-${randomUUID()}`,
          status: "published",
        },
      },
    },
  });
  await prisma.user.create({
    data: {
      id: userId,
      primaryEmail: `integration-${randomUUID()}@example.com`,
      emailVerifiedAt: now,
      learner: {
        create: {
          id: learnerId,
          displayName: "Integration learner",
          instructionLanguage: "pt",
          ageRange: "25_39",
        },
      },
    },
  });
  await prisma.learningTrack.create({
    data: {
      id: learningTrackId,
      learnerId,
      targetLanguage: "en",
      learningGoal: "travel",
      lessonEmphases: ["reading"],
      onboardingStartingPoint: "beginner",
      onboardingStatus: "completed",
      competencyCatalogId: catalogId,
    },
  });
  await prisma.learner.update({
    where: { id: learnerId },
    data: { currentLearningTrackId: learningTrackId },
  });
  await prisma.session.create({
    data: {
      id: randomUUID(),
      userId,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      lastSeenAt: now,
    },
  });

  return {
    catalogId,
    competencyId,
    competencyKey,
    learnerId,
    learningTrackId,
    sessionToken,
    userId,
  };
}

async function seedFailedLesson(
  prisma: PrismaClient,
  priorPlanAttempts: number,
) {
  const fixture = await seedLearner(prisma);
  const moduleId = randomUUID();
  const lessonId = randomUUID();
  await prisma.learningModule.create({
    data: {
      id: moduleId,
      learningTrackId: fixture.learningTrackId,
      objectiveCompetencyId: fixture.competencyId,
      title: "Introduce yourself",
    },
  });
  await prisma.lesson.create({
    data: {
      id: lessonId,
      learningTrackId: fixture.learningTrackId,
      moduleId,
      priorityCompetencyId: fixture.competencyId,
      status: "failed",
      failureCode: "lesson_semantic_rejected",
      structuredModelRuns: {
        create: Array.from({ length: priorPlanAttempts }, (_, index) => ({
          id: randomUUID(),
          step: "plan",
          adapter: "integration",
          model: "integration-model",
          status: "failed" as const,
          attempt: index + 1,
          promptVersion: "v1",
          contractVersion: "v1",
          errorCode: "lesson_semantic_rejected",
        })),
      },
    },
  });

  return { ...fixture, lessonId };
}

function immediateLessonModel(reference: () => string): StructuredModel {
  return {
    async start(request) {
      return request.workload === "lesson_plan"
        ? completedRun(lessonPlan(), reference())
        : completedRun(blockFor(requestObjective(request)), reference());
    },
    async retry() {
      return completedRun(lessonPlan(), reference());
    },
    async inspect() {
      throw new Error("unused");
    },
  };
}

function safeModerator() {
  return {
    async moderate() {
      return {
        flagged: false,
        flaggedCategories: [],
        model: "integration-moderator",
        reference: "moderation-approved",
      };
    },
  };
}

function requestObjective(request: StructuredModelRequest<unknown>): string {
  return (JSON.parse(request.input) as { objective: string }).objective;
}

function completedRun(output: unknown, reference: string): StructuredModelRun {
  return {
    adapter: "integration",
    model: "integration-model",
    reference,
    status: "completed",
    output: JSON.stringify(output),
  };
}

async function waitForRun(
  prisma: PrismaClient,
  lessonId: string,
  step: string,
  attempt: number,
  status: "queued" | "pending" | "completed" | "failed",
) {
  await vi.waitFor(
    async () => {
      const run = await prisma.structuredModelRun.findUnique({
        where: {
          lessonId_step_attempt: { attempt, lessonId, step },
        },
      });
      expect(run?.status).toBe(status);
    },
    { interval: 100, timeout: 10_000 },
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function lessonPlan() {
  return {
    title: "Greetings for travel",
    objective: "Introduce yourself politely when arriving somewhere.",
    alignment: {
      instructionLanguage: "pt",
      targetLanguage: "en",
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
        type: "multiple_choice" as const,
        prompt: "Choose the greeting.",
        options: ["Hello!", "Thank you."],
        correctOptionIndex: 0,
        explanation: "Hello is a greeting.",
      },
    ],
  };
}

function sessionCookie(sessionToken: string): string {
  return `${integrationAppConfig.sessionCookieName}=${sessionToken}`;
}

const integrationAppConfig: AppConfig = {
  apiOrigin: "http://127.0.0.1:3200",
  authCallbackUrl: "http://127.0.0.1:3200/auth/callback",
  authLogoutUrl: "http://127.0.0.1:4273/login",
  frontendOrigin: "http://127.0.0.1:4273",
  logLevel: "silent",
  nodeEnv: "test",
  sessionCookieName: "luma_lingo_integration_session",
  sessionCookieSecure: false,
  sessionTtlDays: 1,
};

const integrationAuthProvider: AuthProvider = {
  getAuthorizationUrl() {
    return "http://127.0.0.1:3200/test-auth";
  },
  async exchangeCode() {
    throw new Error("unused");
  },
  async getLogoutUrl() {
    return "http://127.0.0.1:4273/login";
  },
};
