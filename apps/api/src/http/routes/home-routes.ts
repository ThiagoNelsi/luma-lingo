import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import type { AppConfig } from "../../config.js";
import { HomeService } from "../../lessons/home-service.js";
import { AuthService } from "../../services/auth-service.js";
import { errorDtoSchema } from "../dtos/error-dto.js";
import { homeDtoSchema, toHomeDto } from "../dtos/home-dto.js";
import { lessonDtoSchema, toLessonDto } from "../dtos/lesson-dto.js";

export interface HomeRoutesDependencies {
  auth: AuthService;
  config: AppConfig;
  home: HomeService;
}

export function registerHomeRoutes(
  app: FastifyInstance,
  deps: HomeRoutesDependencies,
): void {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/me/home",
    {
      schema: {
        tags: ["Lesson"],
        summary: "Get the authenticated learner's first Lesson home state",
        response: { 200: homeDtoSchema, 401: errorDtoSchema },
      },
    },
    async (request, reply) => {
      const session = await deps.auth.resolveSession(
        request.cookies[deps.config.sessionCookieName],
      );
      if (!session) {
        return reply.code(401).send({ error: "unauthenticated" });
      }
      return toHomeDto(
        await deps.home.getHome({
          correlationId: request.id,
          learnerId: session.learner.id,
          instructionLanguage: session.learner.instructionLanguage,
          learningTrack: session.currentLearningTrack,
        }),
      );
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    "/me/lessons/:lessonId",
    {
      schema: {
        tags: ["Lesson"],
        summary: "Get the first visible Lesson block",
        params: z.object({ lessonId: z.uuid() }),
        response: {
          200: lessonDtoSchema,
          401: errorDtoSchema,
          404: errorDtoSchema,
        },
      },
    },
    async (request, reply) => {
      const session = await deps.auth.resolveSession(
        request.cookies[deps.config.sessionCookieName],
      );
      if (!session) {
        return reply.code(401).send({ error: "unauthenticated" });
      }
      const lesson = await deps.home.getLesson(
        session.learner.id,
        request.params.lessonId,
      );
      if (!lesson) return reply.code(404).send({ error: "lesson_not_found" });
      return toLessonDto(lesson);
    },
  );
}
