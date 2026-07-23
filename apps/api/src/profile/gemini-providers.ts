import { extractedProfileSchema } from "@luma-lingo/shared";

import {
  createSilentLogger,
  errorMetadata,
  type AppLogger,
} from "../observability/logger.js";
import type {
  ProfileExtractionProvider,
  TranscriptionInput,
  TranscriptionProvider,
} from "./profile-providers.js";

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiRequest {
  parts: GeminiPart[];
  responseJsonSchema?: Record<string, unknown>;
}

interface GeminiResponse {
  text: string;
}

export type GeminiGenerate = (
  request: GeminiRequest,
) => Promise<GeminiResponse>;

export class GeminiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMilliseconds?: number,
  ) {
    super(`gemini_request_failed:${status}`);
    this.name = "GeminiRequestError";
  }
}

export class GeminiTranscriptionProvider implements TranscriptionProvider {
  constructor(private readonly generate: GeminiGenerate) {}

  async transcribe(input: TranscriptionInput): Promise<string> {
    const response = await this.generate({
      parts: [
        {
          text: `Transcreva fielmente este áudio no idioma ${input.instructionLanguage}. Retorne apenas a transcrição, sem comentários.`,
        },
        {
          inlineData: {
            mimeType: input.mimeType,
            data: input.audio.toString("base64"),
          },
        },
      ],
    });
    if (!response.text.trim()) throw new Error("empty_transcript");
    return response.text.trim();
  }
}

const profileJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "jobOrField",
    "interests",
    "dailyRoutine",
    "studyContext",
    "other",
  ],
  properties: {
    jobOrField: { type: ["string", "null"] },
    interests: { type: "array", items: { type: "string" }, maxItems: 10 },
    dailyRoutine: { type: "array", items: { type: "string" }, maxItems: 10 },
    studyContext: { type: ["string", "null"] },
    other: { type: "array", items: { type: "string" }, maxItems: 10 },
  },
};

export class GeminiProfileExtractionProvider implements ProfileExtractionProvider {
  constructor(private readonly generate: GeminiGenerate) {}

  async extract(transcript: string, instructionLanguage: string) {
    const response = await this.generate({
      parts: [
        {
          text: [
            `Extraia apenas fatos explicitamente ditos nesta transcrição em ${instructionLanguage}.`,
            "Campos permitidos: trabalho/área, interesses, rotina diária, contexto de estudo e outros fatos úteis.",
            "Nunca infira idade, objetivo, nível, ritmo, ênfase ou nome.",
            `Transcrição: ${transcript}`,
          ].join("\n"),
        },
      ],
      responseJsonSchema: profileJsonSchema,
    });
    return extractedProfileSchema.parse(JSON.parse(response.text));
  }
}

export function createGeminiGenerate(
  config: {
    apiKey: string;
    model: string;
    fetch?: typeof fetch;
  },
  logger: AppLogger = createSilentLogger(),
): GeminiGenerate {
  const fetchImpl = config.fetch ?? fetch;
  return async (request) => {
    const startedAt = performance.now();
    try {
      const response = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": config.apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: request.parts }],
            generationConfig: request.responseJsonSchema
              ? {
                  responseMimeType: "application/json",
                  responseJsonSchema: request.responseJsonSchema,
                }
              : undefined,
          }),
        },
      );
      if (!response.ok) {
        throw new GeminiRequestError(
          response.status,
          parseRetryAfterMilliseconds(response.headers.get("retry-after")),
        );
      }
      const body = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("gemini_empty_response");
      logger.info(
        {
          durationMs: Math.round(performance.now() - startedAt),
          event: "gemini.generate.completed",
          model: config.model,
        },
        "Gemini generation completed",
      );
      return { text };
    } catch (error) {
      logger.error(
        {
          durationMs: Math.round(performance.now() - startedAt),
          err: error,
          event: "gemini.generate.failed",
          model: config.model,
          ...errorMetadata(error),
        },
        "Gemini generation failed",
      );
      throw error;
    }
  };
}

export function parseRetryAfterMilliseconds(
  value: string | null,
  now: number = Date.now(),
): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1_000);
  }

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return undefined;
  return Math.max(0, retryAt - now);
}
