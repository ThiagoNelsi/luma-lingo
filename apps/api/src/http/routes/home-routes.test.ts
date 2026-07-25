import cookie from "@fastify/cookie";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { describe, expect, it, vi } from "vitest";

import type { AppConfig } from "../../config.js";
import type { HomeService } from "../../lessons/home-service.js";
import type { AuthService } from "../../services/auth-service.js";
import { registerHomeRoutes } from "./home-routes.js";

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

describe("home routes", () => {
  it("returns only the public ready Lesson state for the authenticated learner", async () => {
    const getHome = vi.fn(async () => ({
      status: "ready" as const,
      lessonId: "f7e1918b-78b8-47e3-b0d9-2d6597542c00",
      block: {
        title: "Hello",
        objective: "Greet someone.",
        explanation: "Say Hello.",
        examples: [{ target: "Hello!", instruction: "Olá!" }],
        activities: [
          {
            type: "multiple_choice" as const,
            prompt: "Choose a greeting.",
            options: ["Hello", "Thanks"],
            correctOptionIndex: 0,
            explanation: "Hello is a greeting.",
          },
        ],
      },
    }));
    const app = await buildApp({ getHome });

    const response = await app.inject({
      method: "GET",
      url: "/me/home",
      cookies: { luma_lingo_session: "session-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ready",
      lessonId: "f7e1918b-78b8-47e3-b0d9-2d6597542c00",
    });
    expect(JSON.stringify(response.json())).not.toContain("provider");
    expect(getHome).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: expect.any(String),
        learnerId: "learner-1",
      }),
    );
  });

  it("requires an authenticated session", async () => {
    const getHome = vi.fn();
    const app = await buildApp({
      getHome,
      resolveSession: vi.fn(async () => null),
    });

    const response = await app.inject({ method: "GET", url: "/me/home" });

    expect(response.statusCode).toBe(401);
    expect(getHome).not.toHaveBeenCalled();
  });

  it("exposes only the contiguous approved Lesson prefix", async () => {
    const app = await buildApp({
      getHome: vi.fn(),
      getLesson: vi.fn(async () => ({
        lessonId: "f7e1918b-78b8-47e3-b0d9-2d6597542c00",
        blocks: [
          {
            title: "Hello",
            objective: "Greet someone.",
            explanation: "Say Hello.",
            examples: [{ target: "Hello!", instruction: "Olá!" }],
            activities: [
              {
                type: "multiple_choice" as const,
                prompt: "Choose a greeting.",
                options: ["Hello", "Thanks"],
                correctOptionIndex: 0,
                explanation: "Hello is a greeting.",
              },
            ],
          },
        ],
        nextBlockStatus: "preparing" as const,
      })),
    });

    const response = await app.inject({
      method: "GET",
      url: "/me/lessons/f7e1918b-78b8-47e3-b0d9-2d6597542c00",
      cookies: { luma_lingo_session: "session-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      blocks: [expect.objectContaining({ title: "Hello" })],
      nextBlockStatus: "preparing",
    });
  });

  it("accepts an explicit retry for recoverable missing Lesson work", async () => {
    const retryLesson = vi.fn(async () => true);
    const app = await buildApp({
      getHome: vi.fn(),
      retryLesson,
    });

    const response = await app.inject({
      method: "POST",
      url: "/me/lessons/f7e1918b-78b8-47e3-b0d9-2d6597542c00/retry",
      cookies: { luma_lingo_session: "session-token" },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ accepted: true });
    expect(retryLesson).toHaveBeenCalledWith(
      "learner-1",
      "f7e1918b-78b8-47e3-b0d9-2d6597542c00",
      expect.any(String),
    );
  });
});

async function buildApp(input: {
  getHome: ReturnType<typeof vi.fn>;
  getLesson?: ReturnType<typeof vi.fn>;
  retryLesson?: ReturnType<typeof vi.fn>;
  resolveSession?: ReturnType<typeof vi.fn>;
}) {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(cookie);
  registerHomeRoutes(app, {
    config,
    auth: {
      resolveSession:
        input.resolveSession ??
        vi.fn(async () => ({
          learner: {
            id: "learner-1",
            instructionLanguage: "pt-BR",
          },
          currentLearningTrack: null,
        })),
    } as unknown as AuthService,
    home: {
      getHome: input.getHome,
      getLesson: input.getLesson,
      retryLesson: input.retryLesson,
    } as unknown as HomeService,
  });
  return app;
}
