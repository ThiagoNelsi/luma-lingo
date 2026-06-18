import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import type { AppConfig } from "../../config.js";
import { AuthService } from "../../services/auth-service.js";
import { errorDtoSchema } from "../dtos/error-dto.js";
import { meDtoSchema, toMeDto } from "../dtos/me-dto.js";

export interface MeRoutesDependencies {
  auth: AuthService;
  config: AppConfig;
}

export function registerMeRoutes(
  app: FastifyInstance,
  deps: MeRoutesDependencies,
): void {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/me",
    {
      schema: {
        tags: ["Learner"],
        summary: "Get the current authenticated learner",
        description:
          "Returns the authenticated user, learner, current learning track, and app session metadata resolved from the session cookie.",
        response: {
          200: meDtoSchema,
          401: errorDtoSchema,
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

      return toMeDto(session);
    },
  );
}
