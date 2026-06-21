import { randomUUID } from "node:crypto";

import type {
  AgeAndGoalsSelection,
  LanguageSelection,
} from "@luma-lingo/shared";
import { describe, expect, it } from "vitest";

import type { AuthIdentity } from "../auth/auth-identity.js";
import type { AuthProvider } from "../auth/auth-provider.js";
import type { AppConfig } from "../config.js";
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
  };

  return {
    authProvider,
    learners,
    users,
    sessions,
    getUserCount: () => usersByIdentity.size,
    getSession: () => session,
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
