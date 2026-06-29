import { diagnosticQuestionResponseSchema } from "@luma-lingo/shared";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import type { AppConfig } from "../../config.js";
import type { InitialDiagnosticRuntimeService } from "../../diagnostics/initial-diagnostic-runtime-service.js";
import type { AuthService } from "../../services/auth-service.js";
import { errorDtoSchema } from "../dtos/error-dto.js";
import { initialDiagnosticDtoSchema } from "../dtos/initial-diagnostic-dto.js";
import { isTrustedOrigin } from "../trusted-origin.js";

export interface InitialDiagnosticRoutesDependencies {
  auth: AuthService;
  config: AppConfig;
  initialDiagnostic: InitialDiagnosticRuntimeService;
}

export function registerInitialDiagnosticRoutes(
  app: FastifyInstance,
  deps: InitialDiagnosticRoutesDependencies,
): void {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/me/initial-diagnostic/start",
    {
      schema: {
        tags: ["Learner"],
        summary: "Start or resume the onboarding Initial diagnostic",
        response: {
          200: initialDiagnosticDtoSchema,
          401: errorDtoSchema,
          403: errorDtoSchema,
          409: errorDtoSchema,
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
      if (!session.currentLearningTrack) {
        return reply.code(409).send({ error: "learning_track_required" });
      }

      return deps.initialDiagnostic.startInitialDiagnostic({
        learningTrackId: session.currentLearningTrack.id,
        targetLanguage: session.currentLearningTrack.targetLanguage,
        goals: currentTrackGoals(session.currentLearningTrack),
      });
    },
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    "/me/initial-diagnostic/responses",
    {
      schema: {
        tags: ["Learner"],
        summary: "Submit an onboarding Initial diagnostic response",
        body: diagnosticQuestionResponseSchema,
        response: {
          200: initialDiagnosticDtoSchema,
          401: errorDtoSchema,
          403: errorDtoSchema,
          409: errorDtoSchema,
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
      if (!session.currentLearningTrack) {
        return reply.code(409).send({ error: "learning_track_required" });
      }

      return deps.initialDiagnostic.answerInitialDiagnosticItem({
        learningTrackId: session.currentLearningTrack.id,
        targetLanguage: session.currentLearningTrack.targetLanguage,
        goals: currentTrackGoals(session.currentLearningTrack),
        response: request.body,
      });
    },
  );
}

function currentTrackGoals(track: {
  learningGoal: string | null;
  additionalGoals: string[];
}): string[] {
  return [
    ...(track.learningGoal ? [track.learningGoal] : []),
    ...track.additionalGoals,
  ];
}
