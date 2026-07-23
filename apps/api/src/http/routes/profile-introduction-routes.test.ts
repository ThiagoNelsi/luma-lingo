import { randomUUID } from "node:crypto";

import type { LearnerAgeRange } from "@luma-lingo/shared";
import { describe, expect, it } from "vitest";

import type { AuthProvider } from "../../auth/auth-provider.js";
import type { AppConfig } from "../../config.js";
import type { ProfileIntroductionRepository } from "../../profile/profile-introduction-repository.js";
import { ProfileIntroductionService } from "../../profile/profile-introduction-service.js";
import type { AuthenticatedSessionProfile } from "../../services/auth-profile.js";
import { createApp } from "../app.js";
import { normalizeAudioMimeType } from "./profile-introduction-routes.js";

const config: AppConfig = {
  apiOrigin: "http://localhost:3000",
  authCallbackUrl: "http://localhost:3000/auth/callback",
  authLogoutUrl: "http://localhost:5173/login",
  frontendOrigin: "http://localhost:5173",
  logLevel: "silent",
  nodeEnv: "test",
  sessionCookieName: "luma_lingo_session",
  sessionCookieSecure: false,
  sessionTtlDays: 7,
};

function createHarness(ageRange: LearnerAgeRange = "25_39") {
  const learnerId = randomUUID();
  const session: AuthenticatedSessionProfile = {
    user: {
      id: randomUUID(),
      primaryEmail: "learner@example.com",
      emailVerifiedAt: new Date(),
      lastLoginAt: new Date(),
    },
    learner: {
      id: learnerId,
      displayName: "Learner",
      instructionLanguage: "pt",
      ageRange,
      currentLearningTrackId: randomUUID(),
    },
    currentLearningTrack: {
      id: randomUUID(),
      targetLanguage: "en",
      level: null,
      learningGoal: "work",
      goalCefrLevel: null,
      additionalGoals: [],
      lessonEmphases: [],
      studyPace: null,
      onboardingStartingPoint: null,
      onboardingStatus: "in_progress",
      onboardingStep: "age_and_goals",
    },
    session: {
      id: randomUUID(),
      userId: "user",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
      lastSeenAt: new Date(),
      revokedAt: null,
    },
  };
  let status = "not_started" as
    | "not_started"
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | "manual_required";
  const repository: ProfileIntroductionRepository = {
    async get() {
      return {
        status,
        confirmed: false,
        attempts: 0,
        errorCode: null,
        profile: null,
      };
    },
    async markPending() {
      status = "pending";
      return {
        status,
        confirmed: false,
        attempts: 0,
        errorCode: null,
        profile: null,
      };
    },
    async markProcessing() {},
    async markCompleted() {},
    async markFailed() {},
    async markManualRequired() {
      status = "manual_required";
      return {
        status,
        confirmed: false,
        attempts: 0,
        errorCode: null,
        profile: null,
      };
    },
    async confirmProfile() {
      status = "completed";
    },
    async failInterrupted() {
      return 0;
    },
  };
  const profileIntroduction = new ProfileIntroductionService({
    repository,
    transcription: {
      async transcribe() {
        return "transcript";
      },
    },
    extraction: {
      async extract() {
        return {
          jobOrField: null,
          interests: [],
          dailyRoutine: [],
          studyContext: null,
          other: [],
        };
      },
    },
    schedule() {},
  });
  const authProvider: AuthProvider = {
    getAuthorizationUrl() {
      return "https://auth.example.com";
    },
    async getLogoutUrl() {
      return "https://auth.example.com/logout";
    },
    async exchangeCode() {
      throw new Error("unused");
    },
  };
  return createApp({
    config,
    authProvider,
    profileIntroduction,
    learners: {
      async saveLanguageSelection() {
        throw new Error("unused");
      },
      async saveAgeAndGoals() {
        throw new Error("unused");
      },
      async saveLessonPreferences() {
        throw new Error("unused");
      },
      async saveOnboardingStartingPoint() {
        throw new Error("unused");
      },
    },
    onboardingCompletion: {
      async completeBeginnerOnboarding() {
        throw new Error("unused");
      },
      async completeDiagnosticOnboarding() {
        throw new Error("unused");
      },
    },
    diagnosticAttempts: {
      async findInProgressAttempt() {
        return null;
      },
      async findCompletedAttempt() {
        return null;
      },
      async createAttempt() {
        throw new Error("unused");
      },
      async findAttemptItems() {
        return [];
      },
      async abandonAttempt() {
        throw new Error("unused");
      },
      async createAttemptItem() {
        throw new Error("unused");
      },
      async answerAttemptItem() {
        throw new Error("unused");
      },
      async completeAttempt() {
        throw new Error("unused");
      },
    },
    users: {
      async upsertVerifiedAuthIdentity() {
        throw new Error("unused");
      },
    },
    sessions: {
      async create() {
        throw new Error("unused");
      },
      async findValidByTokenHash() {
        return session;
      },
      async revokeByTokenHash() {},
    },
  });
}

async function multipart(
  audio = "audio",
  durationMs = 1_000,
  mimeType = "audio/webm",
) {
  const form = new FormData();
  form.append("durationMs", String(durationMs));
  form.append("mimeType", mimeType);
  form.append("byteSize", String(Buffer.byteLength(audio)));
  form.append("audio", new Blob([audio], { type: mimeType }), "audio.webm");
  const request = new Request("http://localhost", {
    method: "POST",
    body: form,
  });
  return {
    payload: Buffer.from(await request.arrayBuffer()),
    contentType: request.headers.get("content-type") ?? "",
  };
}

describe("profile introduction route handlers", () => {
  it("normalizes MIME parameters and casing to their media type", () => {
    expect(normalizeAudioMimeType(" Audio/WebM;Codecs=Opus ")).toBe(
      "audio/webm",
    );
  });

  it("gets persisted progress with an authenticated session", async () => {
    const app = await createHarness();
    const response = await app.inject({
      method: "GET",
      url: "/me/profile-introduction",
      cookies: { luma_lingo_session: "token" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("not_started");
  });

  it("accepts bounded audio and returns pending before processing", async () => {
    const app = await createHarness();
    const body = await multipart("audio", 1_000, "audio/webm;codecs=opus");
    const response = await app.inject({
      method: "POST",
      url: "/me/profile-introduction",
      cookies: { luma_lingo_session: "token" },
      headers: {
        origin: config.frontendOrigin,
        "content-type": body.contentType,
      },
      payload: body.payload,
    });
    expect(response.statusCode).toBe(202);
    expect(response.json().status).toBe("pending");
  });

  it("rejects invalid duration and recordings for learners under 13", async () => {
    const invalidApp = await createHarness();
    const body = await multipart("audio", 90_001);
    const invalid = await invalidApp.inject({
      method: "POST",
      url: "/me/profile-introduction",
      cookies: { luma_lingo_session: "token" },
      headers: {
        origin: config.frontendOrigin,
        "content-type": body.contentType,
      },
      payload: body.payload,
    });
    expect(invalid.statusCode).toBe(400);
    const childApp = await createHarness("under_13");
    const child = await childApp.inject({
      method: "POST",
      url: "/me/profile-introduction",
      cookies: { luma_lingo_session: "token" },
      headers: {
        origin: config.frontendOrigin,
        "content-type": body.contentType,
      },
      payload: body.payload,
    });
    expect(child.statusCode).toBe(403);
  });

  it("marks the manual fallback without provider work", async () => {
    const app = await createHarness();
    const response = await app.inject({
      method: "POST",
      url: "/me/profile-introduction/manual",
      cookies: { luma_lingo_session: "token" },
      headers: { origin: config.frontendOrigin },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("manual_required");
  });

  it("confirms a complete manual profile and rejects missing required details", async () => {
    const app = await createHarness();
    const valid = await app.inject({
      method: "POST",
      url: "/me/profile-introduction/confirm",
      cookies: { luma_lingo_session: "token" },
      headers: { origin: config.frontendOrigin },
      payload: {
        jobOrField: "Professora",
        interests: ["cinema"],
        dailyRoutine: [],
        studyContext: null,
        other: [],
      },
    });
    expect(valid.statusCode).toBe(200);
    expect(valid.json().status).toBe("completed");

    const invalid = await app.inject({
      method: "POST",
      url: "/me/profile-introduction/confirm",
      cookies: { luma_lingo_session: "token" },
      headers: { origin: config.frontendOrigin },
      payload: {
        jobOrField: "",
        interests: [],
        dailyRoutine: [],
        studyContext: null,
        other: [],
      },
    });
    expect(invalid.statusCode).toBe(400);
  });

  it("protects profile confirmation with origin and session checks", async () => {
    const app = await createHarness();
    const payload = {
      jobOrField: "Professora",
      interests: ["cinema"],
      dailyRoutine: [],
      studyContext: null,
      other: [],
    };

    const unauthenticated = await app.inject({
      method: "POST",
      url: "/me/profile-introduction/confirm",
      headers: { origin: config.frontendOrigin },
      payload,
    });
    expect(unauthenticated.statusCode).toBe(401);

    const untrustedOrigin = await app.inject({
      method: "POST",
      url: "/me/profile-introduction/confirm",
      cookies: { luma_lingo_session: "token" },
      headers: { origin: "https://untrusted.example" },
      payload,
    });
    expect(untrustedOrigin.statusCode).toBe(403);
  });
});
