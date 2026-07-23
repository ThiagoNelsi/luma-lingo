import {
  confirmedProfileSchema,
  profileIntroductionProgressSchema,
} from "@luma-lingo/shared";
import type { FastifyInstance } from "fastify";

import type { AppConfig } from "../../config.js";
import { ProfileIntroductionService } from "../../profile/profile-introduction-service.js";
import { AuthService } from "../../services/auth-service.js";
import { errorDtoSchema } from "../dtos/error-dto.js";
import { isTrustedOrigin } from "../trusted-origin.js";

const allowedAudioTypes = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
]);

const maxAudioBytes = 12 * 1024 * 1024;
const maxDurationMs = 90_000;

export function normalizeAudioMimeType(mimeType: string): string {
  return mimeType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function registerProfileIntroductionRoutes(
  app: FastifyInstance,
  deps: {
    auth: AuthService;
    config: AppConfig;
    profileIntroduction: ProfileIntroductionService;
  },
): void {
  app.get("/me/profile-introduction", async (request, reply) => {
    const session = await deps.auth.resolveSession(
      request.cookies[deps.config.sessionCookieName],
    );
    if (!session) return reply.code(401).send({ error: "unauthenticated" });
    return deps.profileIntroduction.get(session.learner.id);
  });

  app.post(
    "/me/profile-introduction/confirm",
    {
      schema: {
        body: confirmedProfileSchema,
        response: {
          200: profileIntroductionProgressSchema,
          400: errorDtoSchema,
          401: errorDtoSchema,
          403: errorDtoSchema,
        },
      },
    },
    async (request, reply) => {
      if (!isTrustedOrigin(request.headers.origin, deps.config))
        return reply.code(403).send({ error: "invalid_request_origin" });
      const session = await deps.auth.resolveSession(
        request.cookies[deps.config.sessionCookieName],
      );
      if (!session) return reply.code(401).send({ error: "unauthenticated" });
      return deps.profileIntroduction.confirm(
        session.learner.id,
        confirmedProfileSchema.parse(request.body),
      );
    },
  );

  app.post(
    "/me/profile-introduction/manual",
    {
      schema: {
        response: {
          200: profileIntroductionProgressSchema,
          401: errorDtoSchema,
          403: errorDtoSchema,
        },
      },
    },
    async (request, reply) => {
      if (!isTrustedOrigin(request.headers.origin, deps.config))
        return reply.code(403).send({ error: "invalid_request_origin" });
      const session = await deps.auth.resolveSession(
        request.cookies[deps.config.sessionCookieName],
      );
      if (!session) return reply.code(401).send({ error: "unauthenticated" });
      return deps.profileIntroduction.useManualFallback(session.learner.id);
    },
  );

  app.post(
    "/me/profile-introduction",
    {
      schema: {
        response: {
          202: profileIntroductionProgressSchema,
          400: errorDtoSchema,
          401: errorDtoSchema,
          403: errorDtoSchema,
        },
      },
    },
    async (request, reply) => {
      if (!isTrustedOrigin(request.headers.origin, deps.config))
        return reply.code(403).send({ error: "invalid_request_origin" });
      const session = await deps.auth.resolveSession(
        request.cookies[deps.config.sessionCookieName],
      );
      if (!session) return reply.code(401).send({ error: "unauthenticated" });
      if (session.learner.ageRange === "under_13")
        return reply.code(403).send({ error: "recording_not_allowed" });
      if (!session.learner.instructionLanguage)
        return reply.code(400).send({ error: "instruction_language_required" });

      let audio: Buffer | null = null;
      let mimeType = "";
      let declaredMimeType = "";
      let declaredBytes = Number.NaN;
      let durationMs = Number.NaN;
      try {
        for await (const part of request.parts({
          limits: { files: 1, fileSize: maxAudioBytes, fields: 3 },
        })) {
          if (part.type === "file") {
            mimeType = part.mimetype;
            audio = await part.toBuffer();
          } else if (part.fieldname === "durationMs")
            durationMs = Number(part.value);
          else if (part.fieldname === "mimeType")
            declaredMimeType = String(part.value);
          else if (part.fieldname === "byteSize")
            declaredBytes = Number(part.value);
        }
      } catch (error) {
        request.log.warn(
          {
            err: error,
            event: "profile_introduction.upload.rejected",
            reason: "multipart_processing_failed",
          },
          "Profile introduction upload rejected",
        );
        return reply.code(400).send({ error: "invalid_audio_upload" });
      }

      const normalizedMimeType = normalizeAudioMimeType(mimeType);
      const normalizedDeclaredMimeType =
        normalizeAudioMimeType(declaredMimeType);

      if (
        !audio ||
        audio.length === 0 ||
        audio.length > maxAudioBytes ||
        !allowedAudioTypes.has(normalizedMimeType) ||
        normalizedDeclaredMimeType !== normalizedMimeType ||
        declaredBytes !== audio.length ||
        !Number.isInteger(durationMs) ||
        durationMs < 1 ||
        durationMs > maxDurationMs
      ) {
        audio?.fill(0);
        request.log.warn(
          {
            audioBytes: audio?.length,
            declaredBytes,
            durationMs,
            event: "profile_introduction.upload.rejected",
            mimeType: normalizedMimeType,
            reason: "validation_failed",
          },
          "Profile introduction upload rejected",
        );
        return reply.code(400).send({ error: "invalid_audio_upload" });
      }
      const progress = await deps.profileIntroduction.submit(
        session.learner.id,
        session.learner.instructionLanguage,
        { audio, mimeType: normalizedMimeType },
      );
      return reply.code(202).send(progress);
    },
  );
}
