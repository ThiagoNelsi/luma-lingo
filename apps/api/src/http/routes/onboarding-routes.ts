import { languageSelectionSchema } from "@luma-lingo/shared";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import type { AppConfig } from "../../config.js";
import { languageSelectionProgressSchema } from "../../learners/language-selection-progress.js";
import { AuthService } from "../../services/auth-service.js";
import { OnboardingService } from "../../services/onboarding-service.js";
import { errorDtoSchema } from "../dtos/error-dto.js";
import { isTrustedOrigin } from "../trusted-origin.js";

export interface OnboardingRoutesDependencies {
  auth: AuthService;
  config: AppConfig;
  onboarding: OnboardingService;
}

export function registerOnboardingRoutes(
  app: FastifyInstance,
  deps: OnboardingRoutesDependencies,
): void {
  app.withTypeProvider<ZodTypeProvider>().put(
    "/me/languages",
    {
      schema: {
        tags: ["Learner"],
        summary: "Save onboarding languages",
        body: languageSelectionSchema,
        response: {
          200: languageSelectionProgressSchema,
          401: errorDtoSchema,
          403: errorDtoSchema,
        },
      },
    },
    async (request, reply) => {
      if (!isTrustedOrigin(request.headers.origin, deps.config)) {
        return reply.code(403).send({ error: "invalid_request_origin" });
      }

      const session = await deps.auth.resolveSession(
        request.cookies[deps.config.sessionCookieName],
      );
      if (!session) {
        return reply.code(401).send({ error: "unauthenticated" });
      }

      return deps.onboarding.saveLanguageSelection(
        session.learner.id,
        request.body,
      );
    },
  );
}
