import cookie from "@fastify/cookie";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { describe, expect, it, vi } from "vitest";

import type { AppConfig } from "../../config.js";
import type { InitialDiagnosticRuntimeService } from "../../diagnostics/initial-diagnostic-runtime-service.js";
import type { AuthService } from "../../services/auth-service.js";
import { registerInitialDiagnosticRoutes } from "./initial-diagnostic-routes.js";

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

describe("initial diagnostic routes", () => {
  it("requires authentication before starting the initial diagnostic", async () => {
    const startInitialDiagnostic = vi.fn();
    const app = await buildApp({
      initialDiagnostic: {
        startInitialDiagnostic,
      } as unknown as InitialDiagnosticRuntimeService,
      resolveSession: vi.fn(async () => null),
    });

    const response = await app.inject({
      method: "POST",
      url: "/me/initial-diagnostic/start",
      headers: {
        origin: "http://localhost:5173",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthenticated" });
    expect(startInitialDiagnostic).not.toHaveBeenCalled();
  });

  it("rejects untrusted origins before starting the initial diagnostic", async () => {
    const startInitialDiagnostic = vi.fn();
    const app = await buildApp({
      initialDiagnostic: {
        startInitialDiagnostic,
      } as unknown as InitialDiagnosticRuntimeService,
    });

    const response = await app.inject({
      method: "POST",
      url: "/me/initial-diagnostic/start",
      headers: {
        origin: "https://evil.example.com",
      },
      cookies: {
        luma_lingo_session: "session-token",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "invalid_request_origin" });
    expect(startInitialDiagnostic).not.toHaveBeenCalled();
  });

  it("starts the initial diagnostic for the authenticated learner's current track", async () => {
    const startInitialDiagnostic = vi.fn(async () => ({
      attempt: {
        id: "attempt-1",
        status: "in_progress" as const,
      },
      item: {
        attemptItemId: "attempt-item-1",
        position: 1,
        diagnosticItemId: "item-1",
        key: "en.diag.a1.subject-pronouns.001",
        responseFormat: "multiple_choice",
        prompt: {
          schemaVersion: 1,
          kind: "multiple_choice",
          instructionLocalizations: {
            en: "Choose the best answer.",
          },
          contentLanguage: "en",
          stem: "Maria is a teacher. ___ is from Brazil.",
          options: [
            { id: "option_she", text: "She" },
            { id: "option_he", text: "He" },
          ],
        },
      },
    }));
    const app = await buildApp({
      initialDiagnostic: {
        startInitialDiagnostic,
      } as unknown as InitialDiagnosticRuntimeService,
    });

    const response = await app.inject({
      method: "POST",
      url: "/me/initial-diagnostic/start",
      headers: {
        origin: "http://localhost:5173",
      },
      cookies: {
        luma_lingo_session: "session-token",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      attempt: {
        id: "attempt-1",
        status: "in_progress",
      },
      item: {
        attemptItemId: "attempt-item-1",
        key: "en.diag.a1.subject-pronouns.001",
      },
    });
    expect(startInitialDiagnostic).toHaveBeenCalledWith({
      learningTrackId: "track-1",
      targetLanguage: "en",
      goals: ["travel", "work"],
    });
  });

  it("requires authentication before submitting an initial diagnostic response", async () => {
    const answerInitialDiagnosticItem = vi.fn();
    const app = await buildApp({
      initialDiagnostic: {
        answerInitialDiagnosticItem,
      } as unknown as InitialDiagnosticRuntimeService,
      resolveSession: vi.fn(async () => null),
    });

    const response = await app.inject({
      method: "POST",
      url: "/me/initial-diagnostic/responses",
      headers: {
        origin: "http://localhost:5173",
      },
      payload: {
        schemaVersion: 1,
        kind: "multiple_choice",
        selectedOptionIds: ["option_she"],
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthenticated" });
    expect(answerInitialDiagnosticItem).not.toHaveBeenCalled();
  });

  it("validates structured diagnostic responses before submitting them", async () => {
    const answerInitialDiagnosticItem = vi.fn();
    const app = await buildApp({
      initialDiagnostic: {
        answerInitialDiagnosticItem,
      } as unknown as InitialDiagnosticRuntimeService,
    });

    const response = await app.inject({
      method: "POST",
      url: "/me/initial-diagnostic/responses",
      headers: {
        origin: "http://localhost:5173",
      },
      cookies: {
        luma_lingo_session: "session-token",
      },
      payload: {
        schemaVersion: 1,
        kind: "multiple_choice",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(answerInitialDiagnosticItem).not.toHaveBeenCalled();
  });

  it("submits a structured response for the authenticated learner's current track", async () => {
    const answerInitialDiagnosticItem = vi.fn(async () => ({
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
    }));
    const app = await buildApp({
      initialDiagnostic: {
        answerInitialDiagnosticItem,
      } as unknown as InitialDiagnosticRuntimeService,
    });

    const response = await app.inject({
      method: "POST",
      url: "/me/initial-diagnostic/responses",
      headers: {
        origin: "http://localhost:5173",
      },
      cookies: {
        luma_lingo_session: "session-token",
      },
      payload: {
        schemaVersion: 1,
        kind: "multiple_choice",
        selectedOptionIds: ["option_she"],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      attempt: {
        id: "attempt-1",
        status: "completed",
        summary: {
          answeredItemCount: 1,
        },
      },
      item: null,
    });
    expect(answerInitialDiagnosticItem).toHaveBeenCalledWith({
      learningTrackId: "track-1",
      targetLanguage: "en",
      goals: ["travel", "work"],
      response: {
        schemaVersion: 1,
        kind: "multiple_choice",
        selectedOptionIds: ["option_she"],
      },
    });
  });

  it("returns the next item when response submission keeps the attempt in progress", async () => {
    const answerInitialDiagnosticItem = vi.fn(async () => ({
      attempt: {
        id: "attempt-1",
        status: "in_progress" as const,
        summary: {},
      },
      item: {
        attemptItemId: "attempt-item-2",
        position: 2,
        diagnosticItemId: "item-2",
        key: "en.diag.a1.be-present.001",
        responseFormat: "fill_blank_choice",
        prompt: {
          schemaVersion: 1,
          kind: "fill_blank_choice",
          instructionLocalizations: {
            en: "Choose the best answer.",
          },
          contentLanguage: "en",
          text: "She ___ tired.",
          blankId: "blank_1",
          options: [
            { id: "option_is", text: "is" },
            { id: "option_are", text: "are" },
          ],
        },
      },
    }));
    const app = await buildApp({
      initialDiagnostic: {
        answerInitialDiagnosticItem,
      } as unknown as InitialDiagnosticRuntimeService,
    });

    const response = await app.inject({
      method: "POST",
      url: "/me/initial-diagnostic/responses",
      headers: {
        origin: "http://localhost:5173",
      },
      cookies: {
        luma_lingo_session: "session-token",
      },
      payload: {
        schemaVersion: 1,
        kind: "multiple_choice",
        selectedOptionIds: ["option_she"],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      attempt: {
        id: "attempt-1",
        status: "in_progress",
      },
      item: {
        attemptItemId: "attempt-item-2",
        position: 2,
        key: "en.diag.a1.be-present.001",
      },
    });
  });
});

async function buildApp(input: {
  initialDiagnostic: InitialDiagnosticRuntimeService;
  resolveSession?: AuthService["resolveSession"];
}) {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(cookie);
  registerInitialDiagnosticRoutes(app, {
    auth: {
      resolveSession:
        input.resolveSession ??
        vi.fn(async () => ({
          user: {
            id: "user-1",
            primaryEmail: "learner@example.com",
            emailVerifiedAt: new Date("2026-06-18T12:00:00.000Z"),
            lastLoginAt: null,
          },
          learner: {
            id: "learner-1",
            displayName: "Learner",
            instructionLanguage: "pt",
            ageRange: "25-39",
            currentLearningTrackId: "track-1",
          },
          currentLearningTrack: {
            id: "track-1",
            targetLanguage: "en",
            level: null,
            learningGoal: "travel",
            goalCefrLevel: null,
            additionalGoals: ["work"],
            lessonEmphases: [],
            studyPace: null,
            onboardingStartingPoint: "diagnostic",
            onboardingStatus: "in_progress",
            onboardingStep: "starting_point",
          },
          session: {
            id: "session-1",
            userId: "user-1",
            tokenHash: "hash",
            expiresAt: new Date("2026-06-30T12:00:00.000Z"),
            lastSeenAt: new Date("2026-06-28T12:00:00.000Z"),
            revokedAt: null,
          },
        })),
    } as unknown as AuthService,
    config,
    initialDiagnostic: input.initialDiagnostic,
  });
  return app;
}
