import { randomUUID } from "node:crypto";

import type {
  AgeAndGoalsSelection,
  LanguageSelection,
  LessonPreferencesSelection,
  OnboardingStartingPointSelection,
} from "@luma-lingo/shared";
import { describe, expect, it } from "vitest";

import type { AuthIdentity } from "../auth/auth-identity.js";
import type { AuthProvider } from "../auth/auth-provider.js";
import type { AppConfig } from "../config.js";
import type { DiagnosticAttempt } from "../diagnostics/diagnostic-attempt.js";
import type { DiagnosticAttemptRepository } from "../diagnostics/diagnostic-attempt-repository.js";
import type { InitialDiagnosticRuntimeService } from "../diagnostics/initial-diagnostic-runtime-service.js";
import type { OnboardingCompletionRepository } from "../learners/onboarding-completion-repository.js";
import type { UserRepository } from "../repositories/user-repository.js";
import type { SessionRecord } from "../sessions/session-record.js";
import type { SessionRepository } from "../sessions/session-repository.js";
import type { AuthProfile } from "../services/auth-profile.js";
import { createApp } from "./app.js";

const baseConfig: AppConfig = {
  apiOrigin: "http://localhost:3000",
  authCallbackUrl: "http://localhost:3000/auth/callback",
  authLogoutUrl: "http://localhost:5173/login",
  frontendOrigin: "http://localhost:5173",
  nodeEnv: "test",
  sessionCookieName: "luma_lingo_session",
  sessionCookieSecure: false,
  sessionTtlDays: 7,
};

const verifiedIdentity: AuthIdentity = {
  provider: "cognito",
  providerSubject: "cognito-sub-1",
  email: "learner@example.com",
  emailVerified: true,
  name: "Learner One",
};

function createMemoryDeps(identity: AuthIdentity = verifiedIdentity) {
  let session: SessionRecord | null = null;
  let completedDiagnosticAttempt: DiagnosticAttempt | null = null;
  const usersByIdentity = new Map<string, AuthProfile>();

  const authProvider: AuthProvider = {
    getAuthorizationUrl({ state, redirectUri }) {
      return `https://auth.example.com/oauth2/authorize?state=${state}&redirect_uri=${encodeURIComponent(
        redirectUri,
      )}`;
    },
    async getLogoutUrl({ logoutUri }) {
      return `https://auth.example.com/logout?logout_uri=${encodeURIComponent(logoutUri)}`;
    },
    async exchangeCode() {
      return identity;
    },
  };

  const users: UserRepository = {
    async upsertVerifiedAuthIdentity(authIdentity) {
      const key = `${authIdentity.provider}:${authIdentity.providerSubject}`;
      const now = new Date("2026-06-18T12:00:00.000Z");
      const existing = usersByIdentity.get(key);

      if (existing) {
        const updated = {
          ...existing,
          user: { ...existing.user, lastLoginAt: now },
        };
        usersByIdentity.set(key, updated);
        return updated;
      }

      const created: AuthProfile = {
        user: {
          id: randomUUID(),
          primaryEmail: authIdentity.email,
          emailVerifiedAt: now,
          lastLoginAt: now,
        },
        learner: {
          id: randomUUID(),
          displayName: authIdentity.name,
          instructionLanguage: null,
          ageRange: null,
          currentLearningTrackId: null,
        },
        currentLearningTrack: null,
      };

      usersByIdentity.set(key, created);
      return created;
    },
  };

  const sessions: SessionRepository = {
    async create(userId, tokenHash, expiresAt, now) {
      session = {
        id: randomUUID(),
        userId,
        tokenHash,
        expiresAt,
        lastSeenAt: now,
        revokedAt: null,
      };
      return session;
    },
    async findValidByTokenHash(tokenHash, now) {
      if (!session || session.tokenHash !== tokenHash) return null;
      if (session.revokedAt) return null;
      if (session.expiresAt <= now) return null;

      const profile = [...usersByIdentity.values()].find(
        (value) => value.user.id === session?.userId,
      );
      if (!profile) return null;

      session = { ...session, lastSeenAt: now };
      return { ...profile, session };
    },
    async revokeByTokenHash(tokenHash) {
      if (session?.tokenHash === tokenHash) {
        session = {
          ...session,
          revokedAt: new Date("2026-06-18T12:00:00.000Z"),
        };
      }
    },
  };

  const learners = {
    async saveLanguageSelection(
      learnerId: string,
      selection: LanguageSelection,
    ) {
      const entry = [...usersByIdentity.entries()].find(
        ([, profile]) => profile.learner.id === learnerId,
      );
      if (!entry) throw new Error("learner_not_found");

      const [key, profile] = entry;
      const trackId = profile.currentLearningTrack?.id ?? randomUUID();
      const updated: AuthProfile = {
        ...profile,
        learner: {
          ...profile.learner,
          instructionLanguage: selection.instructionLanguage,
          currentLearningTrackId: trackId,
        },
        currentLearningTrack: {
          id: trackId,
          targetLanguage: selection.targetLanguage,
          level: null,
          learningGoal: null,
          goalCefrLevel: null,
          additionalGoals: [],
          lessonEmphases: [],
          studyPace: null,
          onboardingStartingPoint: null,
          onboardingStatus: "in_progress",
          onboardingStep: "languages",
        },
      };
      usersByIdentity.set(key, updated);
      return {
        ...selection,
        onboardingStatus: "in_progress" as const,
        onboardingStep: "languages" as const,
      };
    },
    async saveAgeAndGoals(learnerId: string, selection: AgeAndGoalsSelection) {
      const entry = [...usersByIdentity.entries()].find(
        ([, profile]) => profile.learner.id === learnerId,
      );
      if (!entry) throw new Error("learner_not_found");

      const [key, profile] = entry;
      usersByIdentity.set(key, {
        ...profile,
        learner: {
          ...profile.learner,
          ageRange: selection.ageRange,
          displayName: selection.displayName,
        },
        currentLearningTrack: profile.currentLearningTrack
          ? {
              ...profile.currentLearningTrack,
              learningGoal: selection.primaryGoal,
              goalCefrLevel: selection.cefrGoalLevel,
              additionalGoals: selection.additionalGoals,
              onboardingStep: "age_and_goals",
            }
          : null,
      });
      return {
        ...selection,
        onboardingStatus: "in_progress" as const,
        onboardingStep: "age_and_goals" as const,
      };
    },
    async saveLessonPreferences(
      learnerId: string,
      selection: LessonPreferencesSelection,
    ) {
      const entry = [...usersByIdentity.entries()].find(
        ([, profile]) => profile.learner.id === learnerId,
      );
      if (!entry) throw new Error("learner_not_found");

      const [key, profile] = entry;
      usersByIdentity.set(key, {
        ...profile,
        currentLearningTrack: profile.currentLearningTrack
          ? {
              ...profile.currentLearningTrack,
              lessonEmphases: selection.lessonEmphases,
              studyPace: selection.studyPace,
              onboardingStep: "lesson_preferences",
            }
          : null,
      });
      return {
        ...selection,
        onboardingStatus: "in_progress" as const,
        onboardingStep: "lesson_preferences" as const,
      };
    },
    async saveOnboardingStartingPoint(
      learnerId: string,
      selection: OnboardingStartingPointSelection,
    ) {
      const entry = [...usersByIdentity.entries()].find(
        ([, profile]) => profile.learner.id === learnerId,
      );
      if (!entry) throw new Error("learner_not_found");

      const [key, profile] = entry;
      usersByIdentity.set(key, {
        ...profile,
        currentLearningTrack: profile.currentLearningTrack
          ? {
              ...profile.currentLearningTrack,
              onboardingStartingPoint: selection.onboardingStartingPoint,
              onboardingStep: "starting_point",
            }
          : null,
      });
      return {
        ...selection,
        onboardingStatus: "in_progress" as const,
        onboardingStep: "starting_point" as const,
      };
    },
  };

  const onboardingCompletion: OnboardingCompletionRepository = {
    async completeBeginnerOnboarding(input) {
      return completeCurrentTrack(input.learningTrackId);
    },
    async completeDiagnosticOnboarding(input) {
      return completeCurrentTrack(input.learningTrackId);
    },
  };

  const diagnosticAttempts: DiagnosticAttemptRepository = {
    async findInProgressAttempt() {
      return null;
    },
    async findCompletedAttempt(learningTrackId, purpose) {
      if (
        completedDiagnosticAttempt?.learningTrackId === learningTrackId &&
        completedDiagnosticAttempt.purpose === purpose
      ) {
        return completedDiagnosticAttempt;
      }

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
  };

  function completeCurrentTrack(learningTrackId: string) {
    const entry = [...usersByIdentity.entries()].find(
      ([, profile]) => profile.currentLearningTrack?.id === learningTrackId,
    );
    if (!entry?.[1].currentLearningTrack) {
      throw new Error("learning_track_not_found");
    }

    const [key, profile] = entry;
    const currentLearningTrack = profile.currentLearningTrack;
    if (!currentLearningTrack) throw new Error("learning_track_not_found");

    usersByIdentity.set(key, {
      ...profile,
      currentLearningTrack: {
        ...currentLearningTrack,
        onboardingStatus: "completed",
        onboardingStep: null,
      },
    });

    return {
      onboardingStatus: "completed" as const,
      onboardingStep: null,
    };
  }

  function completeDiagnosticAttempt() {
    const profile = [...usersByIdentity.values()].find(
      (candidate) => candidate.currentLearningTrack,
    );
    const track = profile?.currentLearningTrack;
    if (!track) throw new Error("learning_track_not_found");

    completedDiagnosticAttempt = {
      id: "attempt-1",
      learningTrackId: track.id,
      catalogId: "catalog-1",
      purpose: "onboarding_initial",
      status: "completed",
      selectionPolicyVersion: "initial-diagnostic-selection-v1",
      scoringPolicyVersion: "initial-diagnostic-scoring-v1",
      startedAt: new Date("2026-06-28T12:00:00.000Z"),
      completedAt: new Date("2026-06-28T12:08:00.000Z"),
      abandonedAt: null,
      summary: {
        schemaVersion: 1,
        answeredItemCount: 2,
      },
      details: {},
    };
  }

  return {
    authProvider,
    learners,
    onboardingCompletion,
    diagnosticAttempts,
    users,
    sessions,
    initialDiagnostic: {
      async startInitialDiagnostic() {
        return {
          attempt: {
            id: "attempt-1",
            status: "in_progress" as const,
          },
          item: null,
        };
      },
      async answerInitialDiagnosticItem() {
        return {
          attempt: {
            id: "attempt-1",
            status: "completed" as const,
            summary: {
              schemaVersion: 1,
              answeredItemCount: 1,
              stopReason: "question_bank_exhausted",
            },
          },
          item: null,
        };
      },
    } as unknown as InitialDiagnosticRuntimeService,
    getUserCount: () => usersByIdentity.size,
    getSession: () => session,
    completeDiagnosticAttempt,
  };
}

describe("auth routes", () => {
  it("allows the web app to preflight language-selection writes", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });

    const response = await app.inject({
      method: "OPTIONS",
      url: "/me/languages",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "PUT",
        "access-control-request-headers": "content-type",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toContain("PUT");
  });

  it("exposes OpenAPI documentation for the HTTP routes", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });

    const response = await app.inject({ method: "GET", url: "/docs/json" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      openapi: expect.any(String),
      paths: {
        "/health": expect.any(Object),
        "/auth/login": expect.any(Object),
        "/auth/callback": expect.any(Object),
        "/auth/logout": expect.any(Object),
        "/me": expect.any(Object),
        "/me/languages": expect.any(Object),
        "/me/age-and-goals": expect.any(Object),
        "/me/lesson-preferences": expect.any(Object),
        "/me/onboarding-starting-point": expect.any(Object),
        "/me/onboarding/complete": expect.any(Object),
        "/me/initial-diagnostic/start": expect.any(Object),
        "/me/initial-diagnostic/responses": expect.any(Object),
      },
    });
  });

  it("starts login with OAuth state and redirects to the auth provider", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });

    const response = await app.inject({ method: "GET", url: "/auth/login" });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain(
      "https://auth.example.com/oauth2/authorize",
    );
    expect(response.headers.location).toContain("state=");
    expect(response.cookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "luma_lingo_session_oauth_state",
          httpOnly: true,
          sameSite: "Lax",
        }),
      ]),
    );
  });

  it("creates the learner session after a verified callback", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });
    const login = await app.inject({ method: "GET", url: "/auth/login" });
    const state =
      login.cookies.find(
        (cookie) => cookie.name === "luma_lingo_session_oauth_state",
      )?.value ?? "";

    const callback = await app.inject({
      method: "GET",
      url: `/auth/callback?code=ok&state=${state}`,
      cookies: { luma_lingo_session_oauth_state: state },
    });

    expect(callback.statusCode).toBe(302);
    expect(callback.headers.location).toBe("http://localhost:5173/private");
    expect(callback.cookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "luma_lingo_session",
          httpOnly: true,
          sameSite: "Lax",
        }),
      ]),
    );
    expect(callback.headers["set-cookie"]?.toString()).not.toContain("Secure");
  });

  it("rejects callback state mismatch", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });

    const response = await app.inject({
      method: "GET",
      url: "/auth/callback?code=ok&state=bad",
      cookies: { luma_lingo_session_oauth_state: "good" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_oauth_state" });
  });

  it("rejects unverified email without setting a session cookie", async () => {
    const app = await createApp({
      config: baseConfig,
      ...createMemoryDeps({ ...verifiedIdentity, emailVerified: false }),
    });

    const response = await app.inject({
      method: "GET",
      url: "/auth/callback?code=ok&state=state-1",
      cookies: { luma_lingo_session_oauth_state: "state-1" },
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      "http://localhost:5173/login?error=email_not_verified",
    );
    expect(
      response.cookies.some((cookie) => cookie.name === "luma_lingo_session"),
    ).toBe(false);
  });

  it("returns the current learner for a valid session", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });
    const login = await app.inject({ method: "GET", url: "/auth/login" });
    const state =
      login.cookies.find(
        (cookie) => cookie.name === "luma_lingo_session_oauth_state",
      )?.value ?? "";
    const callback = await app.inject({
      method: "GET",
      url: `/auth/callback?code=ok&state=${state}`,
      cookies: { luma_lingo_session_oauth_state: state },
    });
    const sessionCookie =
      callback.cookies.find((cookie) => cookie.name === "luma_lingo_session")
        ?.value ?? "";

    const response = await app.inject({
      method: "GET",
      url: "/me",
      cookies: { luma_lingo_session: sessionCookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: { primaryEmail: "learner@example.com" },
      learner: { displayName: "Learner One" },
      currentLearningTrack: null,
    });
  });

  it("saves language selection for the authenticated learner and exposes it through /me", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });
    const login = await app.inject({ method: "GET", url: "/auth/login" });
    const state =
      login.cookies.find(
        (cookie) => cookie.name === "luma_lingo_session_oauth_state",
      )?.value ?? "";
    const callback = await app.inject({
      method: "GET",
      url: `/auth/callback?code=ok&state=${state}`,
      cookies: { luma_lingo_session_oauth_state: state },
    });
    const sessionCookie =
      callback.cookies.find((cookie) => cookie.name === "luma_lingo_session")
        ?.value ?? "";

    const saved = await app.inject({
      method: "PUT",
      url: "/me/languages",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
      payload: {
        instructionLanguage: "pt",
        targetLanguage: "en",
      },
    });

    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toEqual({
      instructionLanguage: "pt",
      targetLanguage: "en",
      onboardingStatus: "in_progress",
      onboardingStep: "languages",
    });

    const me = await app.inject({
      method: "GET",
      url: "/me",
      cookies: { luma_lingo_session: sessionCookie },
    });
    expect(me.json()).toMatchObject({
      learner: { instructionLanguage: "pt" },
      currentLearningTrack: {
        targetLanguage: "en",
        onboardingStatus: "in_progress",
        onboardingStep: "languages",
      },
    });
  });

  it("saves age and goals for the authenticated learner", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });
    const login = await app.inject({ method: "GET", url: "/auth/login" });
    const state =
      login.cookies.find(
        (cookie) => cookie.name === "luma_lingo_session_oauth_state",
      )?.value ?? "";
    const callback = await app.inject({
      method: "GET",
      url: `/auth/callback?code=ok&state=${state}`,
      cookies: { luma_lingo_session_oauth_state: state },
    });
    const sessionCookie =
      callback.cookies.find((cookie) => cookie.name === "luma_lingo_session")
        ?.value ?? "";

    await app.inject({
      method: "PUT",
      url: "/me/languages",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
      payload: { instructionLanguage: "pt", targetLanguage: "en" },
    });
    const response = await app.inject({
      method: "PUT",
      url: "/me/age-and-goals",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
      payload: {
        ageRange: "25_39",
        displayName: "Thiago",
        primaryGoal: "cefr_level",
        cefrGoalLevel: "B2",
        additionalGoals: ["travel"],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ageRange: "25_39",
      displayName: "Thiago",
      primaryGoal: "cefr_level",
      cefrGoalLevel: "B2",
      additionalGoals: ["travel"],
      onboardingStatus: "in_progress",
      onboardingStep: "age_and_goals",
    });

    const me = await app.inject({
      method: "GET",
      url: "/me",
      cookies: { luma_lingo_session: sessionCookie },
    });
    expect(me.json()).toMatchObject({
      learner: { ageRange: "25_39", displayName: "Thiago" },
      currentLearningTrack: {
        learningGoal: "cefr_level",
        goalCefrLevel: "B2",
        additionalGoals: ["travel"],
        onboardingStep: "age_and_goals",
      },
    });
  });

  it("rejects invalid or unauthenticated age and goal selections", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });
    const invalid = await app.inject({
      method: "PUT",
      url: "/me/age-and-goals",
      headers: { origin: "http://localhost:5173" },
      payload: {
        ageRange: "unknown",
        displayName: null,
        primaryGoal: "cefr_level",
        cefrGoalLevel: null,
        additionalGoals: ["work", "work", "travel"],
      },
    });
    expect(invalid.statusCode).toBe(400);

    const unauthenticated = await app.inject({
      method: "PUT",
      url: "/me/age-and-goals",
      headers: { origin: "http://localhost:5173" },
      payload: {
        ageRange: "25_39",
        displayName: null,
        primaryGoal: "travel",
        cefrGoalLevel: null,
        additionalGoals: [],
      },
    });
    expect(unauthenticated.statusCode).toBe(401);
  });

  it("saves Lesson emphasis and optional Study pace and exposes them through /me", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });
    const login = await app.inject({ method: "GET", url: "/auth/login" });
    const state =
      login.cookies.find(
        (cookie) => cookie.name === "luma_lingo_session_oauth_state",
      )?.value ?? "";
    const callback = await app.inject({
      method: "GET",
      url: `/auth/callback?code=ok&state=${state}`,
      cookies: { luma_lingo_session_oauth_state: state },
    });
    const sessionCookie =
      callback.cookies.find((cookie) => cookie.name === "luma_lingo_session")
        ?.value ?? "";

    await app.inject({
      method: "PUT",
      url: "/me/languages",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
      payload: { instructionLanguage: "pt", targetLanguage: "en" },
    });
    const response = await app.inject({
      method: "PUT",
      url: "/me/lesson-preferences",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
      payload: {
        lessonEmphases: ["listening", "reading"],
        studyPace: null,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      lessonEmphases: ["listening", "reading"],
      studyPace: null,
      onboardingStatus: "in_progress",
      onboardingStep: "lesson_preferences",
    });

    const me = await app.inject({
      method: "GET",
      url: "/me",
      cookies: { luma_lingo_session: sessionCookie },
    });
    expect(me.json()).toMatchObject({
      currentLearningTrack: {
        lessonEmphases: ["listening", "reading"],
        studyPace: null,
        onboardingStep: "lesson_preferences",
      },
    });
  });

  it("rejects Speaking and an empty Lesson emphasis selection", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });

    for (const lessonEmphases of [["speaking"], []]) {
      const response = await app.inject({
        method: "PUT",
        url: "/me/lesson-preferences",
        headers: { origin: "http://localhost:5173" },
        payload: { lessonEmphases, studyPace: null },
      });
      expect(response.statusCode).toBe(400);
    }
  });

  it("saves Onboarding starting point choices and exposes them through /me", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });
    const login = await app.inject({ method: "GET", url: "/auth/login" });
    const state =
      login.cookies.find(
        (cookie) => cookie.name === "luma_lingo_session_oauth_state",
      )?.value ?? "";
    const callback = await app.inject({
      method: "GET",
      url: `/auth/callback?code=ok&state=${state}`,
      cookies: { luma_lingo_session_oauth_state: state },
    });
    const sessionCookie =
      callback.cookies.find((cookie) => cookie.name === "luma_lingo_session")
        ?.value ?? "";

    await app.inject({
      method: "PUT",
      url: "/me/languages",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
      payload: { instructionLanguage: "pt", targetLanguage: "en" },
    });
    await app.inject({
      method: "PUT",
      url: "/me/lesson-preferences",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
      payload: {
        lessonEmphases: ["listening", "reading"],
        studyPace: "relaxed",
      },
    });

    for (const onboardingStartingPoint of ["beginner", "diagnostic"]) {
      const response = await app.inject({
        method: "PUT",
        url: "/me/onboarding-starting-point",
        headers: { origin: "http://localhost:5173" },
        cookies: { luma_lingo_session: sessionCookie },
        payload: { onboardingStartingPoint },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        onboardingStartingPoint,
        onboardingStatus: "in_progress",
        onboardingStep: "starting_point",
      });

      const me = await app.inject({
        method: "GET",
        url: "/me",
        cookies: { luma_lingo_session: sessionCookie },
      });
      expect(me.json()).toMatchObject({
        currentLearningTrack: {
          onboardingStartingPoint,
          onboardingStep: "starting_point",
        },
      });
    }
  });

  it("requires authentication and trusted origins before completing onboarding", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });

    const unauthenticated = await app.inject({
      method: "POST",
      url: "/me/onboarding/complete",
      headers: { origin: "http://localhost:5173" },
    });
    expect(unauthenticated.statusCode).toBe(401);
    expect(unauthenticated.json()).toEqual({ error: "unauthenticated" });

    const untrusted = await app.inject({
      method: "POST",
      url: "/me/onboarding/complete",
      headers: { origin: "https://evil.example.com" },
      cookies: { luma_lingo_session: "not-a-real-session" },
    });
    expect(untrusted.statusCode).toBe(403);
    expect(untrusted.json()).toEqual({ error: "invalid_request_origin" });
  });

  it("rejects onboarding completion without a current Learning track or starting point", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });
    const login = await app.inject({ method: "GET", url: "/auth/login" });
    const state =
      login.cookies.find(
        (cookie) => cookie.name === "luma_lingo_session_oauth_state",
      )?.value ?? "";
    const callback = await app.inject({
      method: "GET",
      url: `/auth/callback?code=ok&state=${state}`,
      cookies: { luma_lingo_session_oauth_state: state },
    });
    const sessionCookie =
      callback.cookies.find((cookie) => cookie.name === "luma_lingo_session")
        ?.value ?? "";

    const withoutTrack = await app.inject({
      method: "POST",
      url: "/me/onboarding/complete",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
    });
    expect(withoutTrack.statusCode).toBe(409);
    expect(withoutTrack.json()).toEqual({ error: "learning_track_required" });

    await app.inject({
      method: "PUT",
      url: "/me/languages",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
      payload: { instructionLanguage: "pt", targetLanguage: "en" },
    });
    const withoutStartingPoint = await app.inject({
      method: "POST",
      url: "/me/onboarding/complete",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
    });
    expect(withoutStartingPoint.statusCode).toBe(409);
    expect(withoutStartingPoint.json()).toEqual({
      error: "onboarding_starting_point_required",
    });
  });

  it("completes Beginner path onboarding and exposes completion through /me", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });
    const login = await app.inject({ method: "GET", url: "/auth/login" });
    const state =
      login.cookies.find(
        (cookie) => cookie.name === "luma_lingo_session_oauth_state",
      )?.value ?? "";
    const callback = await app.inject({
      method: "GET",
      url: `/auth/callback?code=ok&state=${state}`,
      cookies: { luma_lingo_session_oauth_state: state },
    });
    const sessionCookie =
      callback.cookies.find((cookie) => cookie.name === "luma_lingo_session")
        ?.value ?? "";

    await app.inject({
      method: "PUT",
      url: "/me/languages",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
      payload: { instructionLanguage: "pt", targetLanguage: "en" },
    });
    await app.inject({
      method: "PUT",
      url: "/me/onboarding-starting-point",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
      payload: { onboardingStartingPoint: "beginner" },
    });

    const completed = await app.inject({
      method: "POST",
      url: "/me/onboarding/complete",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
    });

    expect(completed.statusCode).toBe(200);
    expect(completed.json()).toEqual({
      onboardingStatus: "completed",
      onboardingStep: null,
    });

    const me = await app.inject({
      method: "GET",
      url: "/me",
      cookies: { luma_lingo_session: sessionCookie },
    });
    expect(me.json()).toMatchObject({
      currentLearningTrack: {
        onboardingStartingPoint: "beginner",
        onboardingStatus: "completed",
        onboardingStep: null,
      },
    });
  });

  it("requires a completed Diagnostic attempt before completing Diagnostic path onboarding", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });
    const login = await app.inject({ method: "GET", url: "/auth/login" });
    const state =
      login.cookies.find(
        (cookie) => cookie.name === "luma_lingo_session_oauth_state",
      )?.value ?? "";
    const callback = await app.inject({
      method: "GET",
      url: `/auth/callback?code=ok&state=${state}`,
      cookies: { luma_lingo_session_oauth_state: state },
    });
    const sessionCookie =
      callback.cookies.find((cookie) => cookie.name === "luma_lingo_session")
        ?.value ?? "";

    await app.inject({
      method: "PUT",
      url: "/me/languages",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
      payload: { instructionLanguage: "pt", targetLanguage: "en" },
    });
    await app.inject({
      method: "PUT",
      url: "/me/onboarding-starting-point",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
      payload: { onboardingStartingPoint: "diagnostic" },
    });

    const response = await app.inject({
      method: "POST",
      url: "/me/onboarding/complete",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "completed_initial_diagnostic_required",
    });
  });

  it("completes Diagnostic path onboarding after a completed Diagnostic attempt", async () => {
    const deps = createMemoryDeps();
    const app = await createApp({ config: baseConfig, ...deps });
    const login = await app.inject({ method: "GET", url: "/auth/login" });
    const state =
      login.cookies.find(
        (cookie) => cookie.name === "luma_lingo_session_oauth_state",
      )?.value ?? "";
    const callback = await app.inject({
      method: "GET",
      url: `/auth/callback?code=ok&state=${state}`,
      cookies: { luma_lingo_session_oauth_state: state },
    });
    const sessionCookie =
      callback.cookies.find((cookie) => cookie.name === "luma_lingo_session")
        ?.value ?? "";

    await app.inject({
      method: "PUT",
      url: "/me/languages",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
      payload: { instructionLanguage: "pt", targetLanguage: "en" },
    });
    await app.inject({
      method: "PUT",
      url: "/me/onboarding-starting-point",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
      payload: { onboardingStartingPoint: "diagnostic" },
    });
    deps.completeDiagnosticAttempt();

    const completed = await app.inject({
      method: "POST",
      url: "/me/onboarding/complete",
      headers: { origin: "http://localhost:5173" },
      cookies: { luma_lingo_session: sessionCookie },
    });

    expect(completed.statusCode).toBe(200);
    expect(completed.json()).toEqual({
      onboardingStatus: "completed",
      onboardingStep: null,
    });
  });

  it("rejects language selection without an authenticated session", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });

    const response = await app.inject({
      method: "PUT",
      url: "/me/languages",
      headers: { origin: "http://localhost:5173" },
      payload: {
        instructionLanguage: "pt",
        targetLanguage: "en",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthenticated" });
  });

  it("rejects matching, unsupported, and untrusted language selections", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });
    const login = await app.inject({ method: "GET", url: "/auth/login" });
    const state =
      login.cookies.find(
        (cookie) => cookie.name === "luma_lingo_session_oauth_state",
      )?.value ?? "";
    const callback = await app.inject({
      method: "GET",
      url: `/auth/callback?code=ok&state=${state}`,
      cookies: { luma_lingo_session_oauth_state: state },
    });
    const sessionCookie =
      callback.cookies.find((cookie) => cookie.name === "luma_lingo_session")
        ?.value ?? "";

    for (const payload of [
      { instructionLanguage: "pt", targetLanguage: "pt" },
      { instructionLanguage: "pt", targetLanguage: "xx" },
    ]) {
      const response = await app.inject({
        method: "PUT",
        url: "/me/languages",
        cookies: { luma_lingo_session: sessionCookie },
        payload,
      });
      expect(response.statusCode).toBe(400);
    }

    const untrusted = await app.inject({
      method: "PUT",
      url: "/me/languages",
      headers: { origin: "https://evil.example.com" },
      cookies: { luma_lingo_session: sessionCookie },
      payload: { instructionLanguage: "pt", targetLanguage: "en" },
    });
    expect(untrusted.statusCode).toBe(403);
    expect(untrusted.json()).toEqual({ error: "invalid_request_origin" });
  });

  it("logs out a valid session, clears the session cookie, and redirects through Cognito logout", async () => {
    const deps = createMemoryDeps();
    const app = await createApp({ config: baseConfig, ...deps });
    const login = await app.inject({ method: "GET", url: "/auth/login" });
    const state =
      login.cookies.find(
        (cookie) => cookie.name === "luma_lingo_session_oauth_state",
      )?.value ?? "";
    const callback = await app.inject({
      method: "GET",
      url: `/auth/callback?code=ok&state=${state}`,
      cookies: { luma_lingo_session_oauth_state: state },
    });
    const sessionCookie =
      callback.cookies.find((cookie) => cookie.name === "luma_lingo_session")
        ?.value ?? "";

    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "http://localhost:5173",
      },
      payload: "",
      cookies: { luma_lingo_session: sessionCookie },
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      "https://auth.example.com/logout?logout_uri=http%3A%2F%2Flocalhost%3A5173%2Flogin",
    );
    expect(response.cookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "luma_lingo_session",
          value: "",
          sameSite: "Lax",
        }),
      ]),
    );
    expect(response.headers["set-cookie"]?.toString()).not.toContain("Secure");
    expect(deps.getSession()?.revokedAt).toBeInstanceOf(Date);
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/me",
          cookies: { luma_lingo_session: sessionCookie },
        })
      ).statusCode,
    ).toBe(401);
  });

  it("logs out safely when the session cookie is missing or already invalid", async () => {
    const missingApp = await createApp({
      config: baseConfig,
      ...createMemoryDeps(),
    });
    expect(
      (
        await missingApp.inject({
          method: "POST",
          url: "/auth/logout",
        })
      ).statusCode,
    ).toBe(302);

    const invalidApp = await createApp({
      config: baseConfig,
      ...createMemoryDeps(),
    });
    expect(
      (
        await invalidApp.inject({
          method: "POST",
          url: "/auth/logout",
          cookies: { luma_lingo_session: "not-a-real-session" },
        })
      ).statusCode,
    ).toBe(302);
  });

  it("rejects logout requests from untrusted browser origins", async () => {
    const app = await createApp({ config: baseConfig, ...createMemoryDeps() });

    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://evil.example.com",
      },
      payload: "",
      cookies: { luma_lingo_session: "not-a-real-session" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "invalid_request_origin" });
  });

  it("rejects missing, invalid, expired, and revoked sessions", async () => {
    const missingApp = await createApp({
      config: baseConfig,
      ...createMemoryDeps(),
    });
    expect(
      (await missingApp.inject({ method: "GET", url: "/me" })).statusCode,
    ).toBe(401);

    const invalidApp = await createApp({
      config: baseConfig,
      ...createMemoryDeps(),
    });
    expect(
      (
        await invalidApp.inject({
          method: "GET",
          url: "/me",
          cookies: { luma_lingo_session: "not-a-real-session" },
        })
      ).statusCode,
    ).toBe(401);

    const expiredApp = await createApp({
      config: { ...baseConfig, sessionTtlDays: -1 },
      ...createMemoryDeps(),
    });
    const expiredLogin = await expiredApp.inject({
      method: "GET",
      url: "/auth/login",
    });
    const expiredState =
      expiredLogin.cookies.find(
        (cookie) => cookie.name === "luma_lingo_session_oauth_state",
      )?.value ?? "";
    const expiredCallback = await expiredApp.inject({
      method: "GET",
      url: `/auth/callback?code=ok&state=${expiredState}`,
      cookies: { luma_lingo_session_oauth_state: expiredState },
    });
    const expiredCookie =
      expiredCallback.cookies.find(
        (cookie) => cookie.name === "luma_lingo_session",
      )?.value ?? "";
    expect(
      (
        await expiredApp.inject({
          method: "GET",
          url: "/me",
          cookies: { luma_lingo_session: expiredCookie },
        })
      ).statusCode,
    ).toBe(401);

    const revokedApp = await createApp({
      config: baseConfig,
      ...createMemoryDeps(),
    });
    const revokedLogin = await revokedApp.inject({
      method: "GET",
      url: "/auth/login",
    });
    const revokedState =
      revokedLogin.cookies.find(
        (cookie) => cookie.name === "luma_lingo_session_oauth_state",
      )?.value ?? "";
    const revokedCallback = await revokedApp.inject({
      method: "GET",
      url: `/auth/callback?code=ok&state=${revokedState}`,
      cookies: { luma_lingo_session_oauth_state: revokedState },
    });
    const revokedCookie =
      revokedCallback.cookies.find(
        (cookie) => cookie.name === "luma_lingo_session",
      )?.value ?? "";
    await revokedApp.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: { luma_lingo_session: revokedCookie },
    });
    expect(
      (
        await revokedApp.inject({
          method: "GET",
          url: "/me",
          cookies: { luma_lingo_session: revokedCookie },
        })
      ).statusCode,
    ).toBe(401);
  });

  it("reuses returning learners by auth provider subject instead of email", async () => {
    const deps = createMemoryDeps();
    const app = await createApp({ config: baseConfig, ...deps });

    for (const code of ["first", "second"]) {
      const login = await app.inject({ method: "GET", url: "/auth/login" });
      const state =
        login.cookies.find(
          (cookie) => cookie.name === "luma_lingo_session_oauth_state",
        )?.value ?? "";
      await app.inject({
        method: "GET",
        url: `/auth/callback?code=${code}&state=${state}`,
        cookies: { luma_lingo_session_oauth_state: state },
      });
    }

    expect(deps.getUserCount()).toBe(1);
  });
});
