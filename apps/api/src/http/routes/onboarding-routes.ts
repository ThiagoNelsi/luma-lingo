import {
  ageAndGoalsSelectionSchema,
  languageSelectionSchema,
  lessonPreferencesSelectionSchema,
  onboardingStartingPointSelectionSchema,
} from "@luma-lingo/shared";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import type { AppConfig } from "../../config.js";
import { ageAndGoalsProgressSchema } from "../../learners/age-and-goals-progress.js";
import { languageSelectionProgressSchema } from "../../learners/language-selection-progress.js";
import { lessonPreferencesProgressSchema } from "../../learners/lesson-preferences-progress.js";
import { onboardingStartingPointProgressSchema } from "../../learners/onboarding-starting-point-progress.js";
import { AuthService } from "../../services/auth-service.js";
import { OnboardingService } from "../../services/onboarding-service.js";
import { errorDtoSchema } from "../dtos/error-dto.js";
import { onboardingCompletionDtoSchema } from "../dtos/onboarding-completion-dto.js";
import { toOnboardingCompletionDto } from "../dtos/onboarding-completion-dto-mapper.js";
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

  app.withTypeProvider<ZodTypeProvider>().put(
    "/me/age-and-goals",
    {
      schema: {
        tags: ["Learner"],
        summary: "Save onboarding age and goals",
        body: ageAndGoalsSelectionSchema,
        response: {
          200: ageAndGoalsProgressSchema,
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

      return deps.onboarding.saveAgeAndGoals(session.learner.id, request.body);
    },
  );

  app.withTypeProvider<ZodTypeProvider>().put(
    "/me/lesson-preferences",
    {
      schema: {
        tags: ["Learner"],
        summary: "Save onboarding Lesson emphasis and Study pace",
        body: lessonPreferencesSelectionSchema,
        response: {
          200: lessonPreferencesProgressSchema,
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

      return deps.onboarding.saveLessonPreferences(
        session.learner.id,
        request.body,
      );
    },
  );

  app.withTypeProvider<ZodTypeProvider>().put(
    "/me/onboarding-starting-point",
    {
      schema: {
        tags: ["Learner"],
        summary: "Save Onboarding starting point",
        body: onboardingStartingPointSelectionSchema,
        response: {
          200: onboardingStartingPointProgressSchema,
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

      return deps.onboarding.saveOnboardingStartingPoint(
        session.learner.id,
        request.body,
      );
    },
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    "/me/onboarding/complete",
    {
      schema: {
        tags: ["Learner"],
        summary: "Complete onboarding for the current Learning track",
        response: {
          200: onboardingCompletionDtoSchema,
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

      try {
        const result = await deps.onboarding.completeOnboarding(
          {
            learningTrackId: session.currentLearningTrack.id,
            targetLanguage: session.currentLearningTrack.targetLanguage,
            onboardingStartingPoint:
              session.currentLearningTrack.onboardingStartingPoint,
          },
          session.learner.id,
        );
        return toOnboardingCompletionDto({
          completion: result,
          initialLearningPriority: result.initialLearningPriority,
        });
      } catch (error) {
        if (error instanceof Error && isCompleteOnboardingConflict(error)) {
          return reply.code(409).send({ error: error.message });
        }

        throw error;
      }
    },
  );
}

function isCompleteOnboardingConflict(error: Error): boolean {
  return (
    error.message === "onboarding_starting_point_required" ||
    error.message === "completed_initial_diagnostic_required" ||
    error.message === "published_competency_catalog_required" ||
    error.message === "confirmed_user_profile_required"
  );
}
