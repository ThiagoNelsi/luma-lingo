import type { ConfirmedProfile, ExtractedProfile } from "@luma-lingo/shared";
import { describe, expect, it, vi } from "vitest";

import type { ProfileIntroductionRepository } from "./profile-introduction-repository.js";
import type { AppLogger } from "../observability/logger.js";
import { ProfileIntroductionService } from "./profile-introduction-service.js";

function createHarness(
  options: {
    logger?: AppLogger;
    maxAttempts?: number;
    random?: () => number;
    retryAfterMilliseconds?: number;
    transcriptionStatus?: number;
    transcriptionFailures?: number;
  } = {},
) {
  let status:
    | "not_started"
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | "manual_required" = "not_started";
  let attempts = 0;
  let errorCode: string | null = null;
  let profile: ExtractedProfile | null = null;
  let confirmedProfile: ConfirmedProfile | null = null;
  let failures = options.transcriptionFailures ?? 0;
  const tasks: Array<() => Promise<void>> = [];
  const repository: ProfileIntroductionRepository = {
    async get() {
      return {
        status,
        confirmed: confirmedProfile !== null,
        attempts,
        errorCode,
        profile,
      };
    },
    async markPending() {
      status = "pending";
      attempts = 0;
      errorCode = null;
      profile = null;
      return { status, confirmed: false, attempts, errorCode, profile };
    },
    async markProcessing(_id, value) {
      status = "processing";
      attempts = value;
    },
    async markCompleted(_id, value) {
      if (confirmedProfile) return;
      status = "completed";
      profile = value;
      errorCode = null;
    },
    async markFailed(_id, value) {
      status = "failed";
      errorCode = value;
    },
    async markManualRequired() {
      status = "manual_required";
      return {
        status,
        confirmed: confirmedProfile !== null,
        attempts,
        errorCode,
        profile,
      };
    },
    async confirmProfile(_id, value) {
      status = "completed";
      profile = value;
      confirmedProfile = value;
    },
    async failInterrupted() {
      return 2;
    },
  };
  const extracted: ExtractedProfile = {
    jobOrField: "Design",
    interests: ["cinema"],
    dailyRoutine: [],
    studyContext: null,
    other: [],
  };
  const audio = Buffer.from("audio-data");
  const sleep = vi.fn(async () => undefined);
  const service = new ProfileIntroductionService({
    repository,
    transcription: {
      async transcribe() {
        if (failures > 0) {
          failures -= 1;
          throw Object.assign(new Error("temporary"), {
            retryAfterMilliseconds: options.retryAfterMilliseconds,
            status: options.transcriptionStatus ?? 503,
          });
        }
        return "Eu trabalho com design e gosto de cinema.";
      },
    },
    extraction: {
      async extract() {
        return extracted;
      },
    },
    schedule(task) {
      tasks.push(task);
    },
    sleep,
    maxAttempts: options.maxAttempts ?? 4,
    logger: options.logger,
    random: options.random,
  });
  return {
    audio,
    service,
    tasks,
    repository,
    sleep,
    getState: () => ({
      status,
      attempts,
      errorCode,
      profile,
      confirmedProfile,
    }),
  };
}

describe("ProfileIntroductionService", () => {
  it("persists pending before scheduling ephemeral processing", async () => {
    const harness = createHarness();
    const progress = await harness.service.submit("learner-1", "pt-BR", {
      audio: harness.audio,
      mimeType: "audio/webm",
    });
    expect(progress.status).toBe("pending");
    expect(harness.tasks).toHaveLength(1);
    expect(harness.getState().status).toBe("pending");
  });

  it("clears audio when persistence prevents scheduling", async () => {
    const harness = createHarness();
    harness.repository.markPending = async () => {
      throw new Error("database_unavailable");
    };
    await expect(
      harness.service.submit("learner-1", "pt-BR", {
        audio: harness.audio,
        mimeType: "audio/webm",
      }),
    ).rejects.toThrow("database_unavailable");
    expect(harness.audio.every((byte) => byte === 0)).toBe(true);
  });

  it("retries transient failures, persists extraction, and clears audio memory", async () => {
    const harness = createHarness({ transcriptionFailures: 1 });
    await harness.service.submit("learner-1", "pt-BR", {
      audio: harness.audio,
      mimeType: "audio/webm",
    });
    await harness.tasks[0]?.();
    expect(harness.getState()).toMatchObject({
      status: "completed",
      attempts: 2,
      profile: { jobOrField: "Design" },
    });
    expect([...harness.audio]).toEqual(new Array(harness.audio.length).fill(0));
  });

  it("uses exponential backoff with jitter for transient provider failures", async () => {
    const harness = createHarness({
      maxAttempts: 4,
      random: () => 0.5,
      transcriptionFailures: 3,
    });

    await harness.service.submit("learner-1", "pt-BR", {
      audio: harness.audio,
      mimeType: "audio/webm",
    });
    await harness.tasks[0]?.();

    expect(harness.sleep).toHaveBeenNthCalledWith(1, 1_500);
    expect(harness.sleep).toHaveBeenNthCalledWith(2, 2_500);
    expect(harness.sleep).toHaveBeenNthCalledWith(3, 4_500);
  });

  it("honors provider retry guidance when it exceeds calculated backoff", async () => {
    const harness = createHarness({
      random: () => 0,
      retryAfterMilliseconds: 4_500,
      transcriptionFailures: 1,
    });

    await harness.service.submit("learner-1", "pt-BR", {
      audio: harness.audio,
      mimeType: "audio/webm",
    });
    await harness.tasks[0]?.();

    expect(harness.sleep).toHaveBeenCalledWith(4_500);
  });

  it("does not retry non-transient provider failures", async () => {
    const harness = createHarness({
      transcriptionFailures: 1,
      transcriptionStatus: 400,
    });

    await harness.service.submit("learner-1", "pt-BR", {
      audio: harness.audio,
      mimeType: "audio/webm",
    });
    await harness.tasks[0]?.();

    expect(harness.getState()).toMatchObject({ attempts: 1, status: "failed" });
    expect(harness.sleep).not.toHaveBeenCalled();
  });

  it("persists a bounded final failure and clears audio memory", async () => {
    const harness = createHarness({ transcriptionFailures: 4 });
    await harness.service.submit("learner-1", "pt-BR", {
      audio: harness.audio,
      mimeType: "audio/webm",
    });
    await harness.tasks[0]?.();
    expect(harness.getState()).toMatchObject({
      status: "failed",
      attempts: 4,
      errorCode: "profile_transcription_failed",
    });
    expect(harness.audio.every((byte) => byte === 0)).toBe(true);
  });

  it("logs the original error and stage when all processing attempts fail", async () => {
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    } as unknown as AppLogger;
    const harness = createHarness({ logger, transcriptionFailures: 4 });

    await harness.service.submit("learner-1", "pt-BR", {
      audio: harness.audio,
      mimeType: "audio/webm",
    });
    await harness.tasks[0]?.();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "profile_transcription_failed",
        event: "profile_introduction.failed",
        learnerId: "learner-1",
      }),
      "Profile introduction failed after all attempts",
    );
  });

  it("marks manual fallback without scheduling provider work", async () => {
    const harness = createHarness();
    expect((await harness.service.useManualFallback("learner-1")).status).toBe(
      "manual_required",
    );
    expect(harness.tasks).toHaveLength(0);
  });

  it("persists a validated manual confirmation without allowing late extraction to replace it", async () => {
    const harness = createHarness();
    const confirmed = await harness.service.confirm("learner-1", {
      jobOrField: "Professora",
      interests: ["cinema"],
      dailyRoutine: ["estuda à noite"],
      studyContext: null,
      other: [],
    });

    await harness.repository.markCompleted("learner-1", {
      jobOrField: "Design",
      interests: ["música"],
      dailyRoutine: [],
      studyContext: null,
      other: [],
    });

    expect(confirmed).toMatchObject({
      status: "completed",
      profile: { jobOrField: "Professora", interests: ["cinema"] },
    });
    expect(harness.getState().profile).toMatchObject({
      jobOrField: "Professora",
    });
  });

  it("rejects profile confirmation without required details", async () => {
    const harness = createHarness();

    await expect(
      harness.service.confirm("learner-1", {
        jobOrField: "",
        interests: [],
        dailyRoutine: [],
        studyContext: null,
        other: [],
      }),
    ).rejects.toThrow();
  });

  it("exposes status and fails work interrupted by a restart", async () => {
    const harness = createHarness();
    expect((await harness.service.get("learner-1")).status).toBe("not_started");
    expect(await harness.service.recoverInterrupted()).toBe(2);
  });
});
