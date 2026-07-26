import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../observability/logger.js";
import { OpenAiContentModerator } from "./openai-content-moderator.js";

describe("OpenAiContentModerator", () => {
  it("classifies generated text with the configured OpenAI moderation model", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      Response.json({
        id: "modr-1",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: true,
            categories: {
              harassment: false,
              "harassment/threatening": false,
              hate: true,
              "hate/threatening": false,
              illicit: false,
              "illicit/violent": false,
              "self-harm": false,
              "self-harm/intent": false,
              "self-harm/instructions": false,
              sexual: false,
              "sexual/minors": false,
              violence: false,
              "violence/graphic": false,
            },
          },
        ],
      }),
    );
    const moderator = new OpenAiContentModerator({
      apiKey: "secret",
      fetch,
      model: "omni-moderation-latest",
    });

    await expect(
      moderator.moderate({
        content: "generated lesson",
        correlation: {
          attempt: 2,
          lessonId: "lesson-1",
          requestId: "request-1",
        },
        purpose: "lesson_plan",
      }),
    ).resolves.toEqual({
      flagged: true,
      flaggedCategories: ["hate"],
      model: "omni-moderation-latest",
      reference: "modr-1",
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/moderations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer secret" }),
      }),
    );
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      input: "generated lesson",
      model: "omni-moderation-latest",
    });
  });

  it("logs moderation metadata without logging generated content", async () => {
    const info = vi.fn();
    const moderator = new OpenAiContentModerator(
      {
        apiKey: "secret",
        fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(
          Response.json({
            id: "modr-2",
            model: "omni-moderation-latest",
            results: [{ flagged: false, categories: { violence: false } }],
          }),
        ),
        model: "omni-moderation-latest",
      },
      { info } as unknown as AppLogger,
    );

    await moderator.moderate({
      content: "sensitive generated lesson content",
      correlation: { attempt: 1, lessonId: "lesson-1" },
      purpose: "lesson_block",
    });

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        durationMs: expect.any(Number),
        event: "openai.moderation.completed",
        flagged: false,
        lessonId: "lesson-1",
        model: "omni-moderation-latest",
        operation: "moderations.create",
        provider: "openai",
        purpose: "lesson_block",
      }),
      "OpenAI moderation operation completed",
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain(
      "sensitive generated lesson content",
    );
  });

  it("fails closed when OpenAI moderation cannot classify the content", async () => {
    const error = vi.fn();
    const moderator = new OpenAiContentModerator(
      {
        apiKey: "secret",
        fetch: vi
          .fn<typeof globalThis.fetch>()
          .mockResolvedValue(
            Response.json(
              { error: { code: "rate_limit_exceeded" } },
              { status: 429 },
            ),
          ),
        model: "omni-moderation-latest",
      },
      { error } as unknown as AppLogger,
    );

    await expect(
      moderator.moderate({
        content: "generated lesson",
        purpose: "lesson_block",
      }),
    ).rejects.toMatchObject({
      code: "openai_moderation_failed",
      providerCode: "rate_limit_exceeded",
      statusCode: 429,
    });
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: "openai_moderation_failed",
        event: "openai.moderation.failed",
        statusCode: 429,
      }),
      "OpenAI moderation operation failed",
    );
  });
});
