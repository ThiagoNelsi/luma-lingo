import { z } from "zod";

import {
  contentModerationResultSchema,
  type ContentModerator,
} from "../lessons/content-moderator.js";
import {
  createSilentLogger,
  errorMetadata,
  type AppLogger,
} from "../observability/logger.js";

const moderationResponseSchema = z
  .object({
    id: z.string().min(1),
    model: z.string().min(1),
    results: z
      .array(
        z
          .object({
            flagged: z.boolean(),
            categories: z.record(z.string(), z.boolean()),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

export class OpenAiContentModeratorError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode?: number,
    readonly providerCode?: string,
  ) {
    super(code);
    this.name = "OpenAiContentModeratorError";
  }
}

export class OpenAiContentModerator implements ContentModerator {
  private readonly fetch: typeof globalThis.fetch;
  private readonly logger: AppLogger;

  constructor(
    private readonly config: {
      apiKey?: string;
      fetch?: typeof globalThis.fetch;
      model: string;
    },
    logger: AppLogger = createSilentLogger(),
  ) {
    this.fetch = config.fetch ?? globalThis.fetch;
    this.logger = logger;
  }

  async moderate(
    input: Parameters<ContentModerator["moderate"]>[0],
  ): Promise<Awaited<ReturnType<ContentModerator["moderate"]>>> {
    if (!this.config.apiKey) {
      throw new OpenAiContentModeratorError("openai_api_key_required");
    }
    const startedAt = performance.now();
    try {
      const response = await this.fetch(
        "https://api.openai.com/v1/moderations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: input.content,
            model: this.config.model,
          }),
        },
      );
      if (!response.ok) {
        const providerCode = await readProviderCode(response);
        throw new OpenAiContentModeratorError(
          "openai_moderation_failed",
          response.status,
          providerCode,
        );
      }
      const parsed = moderationResponseSchema.parse(await response.json());
      const result = parsed.results[0];
      if (!result) {
        throw new OpenAiContentModeratorError(
          "openai_moderation_result_missing",
        );
      }
      const flaggedCategories = Object.entries(result.categories)
        .filter(
          ([category, flagged]) =>
            flagged && /^[a-z-]+(?:\/[a-z-]+)?$/.test(category),
        )
        .map(([category]) => category);
      this.logger.info(
        {
          ...input.correlation,
          durationMs: Math.round(performance.now() - startedAt),
          event: "openai.moderation.completed",
          flagged: result.flagged,
          flaggedCategories,
          model: parsed.model,
          operation: "moderations.create",
          provider: "openai",
          purpose: input.purpose,
        },
        "OpenAI moderation operation completed",
      );
      return contentModerationResultSchema.parse({
        flagged: result.flagged,
        flaggedCategories,
        model: parsed.model,
        reference: parsed.id,
      });
    } catch (error) {
      this.logger.error(
        {
          ...input.correlation,
          durationMs: Math.round(performance.now() - startedAt),
          ...errorMetadata(error),
          event: "openai.moderation.failed",
          model: this.config.model,
          operation: "moderations.create",
          provider: "openai",
          providerCode:
            error instanceof OpenAiContentModeratorError
              ? error.providerCode
              : undefined,
          purpose: input.purpose,
          statusCode:
            error instanceof OpenAiContentModeratorError
              ? error.statusCode
              : undefined,
        },
        "OpenAI moderation operation failed",
      );
      throw error;
    }
  }
}

async function readProviderCode(
  response: Response,
): Promise<string | undefined> {
  try {
    const body = (await response.json()) as {
      error?: { code?: unknown };
    };
    return typeof body.error?.code === "string" &&
      /^[a-zA-Z0-9_.[\]-]{1,120}$/.test(body.error.code)
      ? body.error.code
      : undefined;
  } catch {
    return undefined;
  }
}
