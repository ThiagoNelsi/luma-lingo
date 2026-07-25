import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../observability/logger.js";
import { OpenAiStructuredModel } from "./openai-structured-model.js";

describe("OpenAiStructuredModel", () => {
  it("reports missing credentials as a degraded capability without making a request", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const model = new OpenAiStructuredModel({
      apiKey: undefined,
      model: "gpt-5.6-terra",
      fetch,
    });

    expect(model.readiness()).toEqual({
      status: "degraded",
      reason: "missing_credentials",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses the Responses API structured-output format and keeps the response reference private", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "resp_123",
          status: "completed",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: '{"title":"Hi"}' }],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const model = new OpenAiStructuredModel({
      apiKey: "secret",
      model: "gpt-5.6-terra",
      fetch,
    });

    const run = await model.start({
      workload: "lesson_plan",
      instructions: "Return JSON.",
      input: "A learner context",
      contract: {
        name: "lesson_plan",
        version: "v1",
        schema: {} as never,
        jsonSchema: { type: "object" },
      },
    });

    expect(run).toEqual({
      adapter: "openai",
      model: "gpt-5.6-terra",
      status: "completed",
      reference: "resp_123",
      output: '{"title":"Hi"}',
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer secret" }),
      }),
    );
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      model: "gpt-5.6-terra",
      store: true,
      text: {
        format: {
          type: "json_schema",
          name: "lesson_plan",
          strict: true,
          schema: { type: "object" },
        },
      },
    });
  });

  it("keeps an automatic retry pinned to the original model", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      Response.json({
        id: "resp_retry",
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: '{"title":"Hi"}' }],
          },
        ],
      }),
    );
    const model = new OpenAiStructuredModel({
      apiKey: "secret",
      models: {
        lesson_plan: "current-plan-model",
        lesson_block: "current-block-model",
      },
      fetch,
    });

    await model.retry(
      {
        workload: "lesson_block",
        instructions: "Return JSON.",
        input: "context",
        contract: {
          name: "lesson_block",
          version: "v1",
          schema: {} as never,
          jsonSchema: { type: "object" },
        },
      },
      { adapter: "openai", model: "original-pinned-model" },
    );

    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe("original-pinned-model");
  });

  it("inspects a pinned provider run even when the current workload model changed", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      Response.json({
        id: "resp_pending",
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: '{"title":"Recovered"}' }],
          },
        ],
      }),
    );
    const model = new OpenAiStructuredModel({
      apiKey: "secret",
      model: "current-model",
      fetch,
    });

    await expect(
      model.inspect("resp_pending", undefined, "lesson_plan", {
        adapter: "openai",
        model: "original-pinned-model",
      }),
    ).resolves.toMatchObject({
      model: "original-pinned-model",
      reference: "resp_pending",
      status: "completed",
    });
  });

  it("logs provider operation, latency, and safe HTTP failure metadata", async () => {
    const error = vi.fn();
    const model = new OpenAiStructuredModel(
      {
        apiKey: "secret",
        model: "gpt-5.6-terra",
        fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(
          Response.json(
            {
              error: {
                code: "invalid_json_schema",
                param: "text.format.schema",
                type: "invalid_request_error",
              },
            },
            { status: 400 },
          ),
        ),
      },
      { error } as unknown as AppLogger,
    );

    await expect(
      model.start({
        correlation: {
          attempt: 2,
          lessonId: "lesson-1",
          requestId: "request-1",
        },
        workload: "lesson_plan",
        instructions: "sensitive instructions",
        input: "sensitive learner context",
        contract: {
          name: "lesson_plan",
          version: "v1",
          schema: {} as never,
          jsonSchema: { type: "object" },
        },
      }),
    ).rejects.toMatchObject({
      code: "openai_request_failed",
      providerCode: "invalid_json_schema",
      providerParam: "text.format.schema",
      providerType: "invalid_request_error",
      statusCode: 400,
    });

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: expect.any(Number),
        errorMessage: "openai_request_failed",
        event: "openai.structured_output.failed",
        lessonId: "lesson-1",
        model: "gpt-5.6-terra",
        operation: "responses.create",
        provider: "openai",
        providerCode: "invalid_json_schema",
        providerParam: "text.format.schema",
        providerType: "invalid_request_error",
        requestId: "request-1",
        statusCode: 400,
        workload: "lesson_plan",
      }),
      "OpenAI structured-output operation failed",
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain(
      "sensitive learner context",
    );
  });

  it("logs normalized purpose, attempt, latency, and usage without generated content", async () => {
    const info = vi.fn();
    const model = new OpenAiStructuredModel(
      {
        apiKey: "secret",
        model: "gpt-5.6-terra",
        fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(
          Response.json({
            id: "resp_123",
            model: "gpt-5.6-terra",
            status: "completed",
            usage: { input_tokens: 120, output_tokens: 45 },
            output: [
              {
                type: "message",
                content: [
                  {
                    type: "output_text",
                    text: '{"sensitive":"generated lesson content"}',
                  },
                ],
              },
            ],
          }),
        ),
      },
      { info } as unknown as AppLogger,
    );

    await model.start({
      correlation: { attempt: 2, lessonId: "lesson-1" },
      workload: "lesson_block",
      instructions: "sensitive instructions",
      input: "sensitive profile data",
      contract: {
        name: "lesson_block",
        version: "v1",
        schema: {} as never,
        jsonSchema: { type: "object" },
      },
    });

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 2,
        durationMs: expect.any(Number),
        inputTokens: 120,
        lessonId: "lesson-1",
        model: "gpt-5.6-terra",
        outputTokens: 45,
        provider: "openai",
        purpose: "lesson_block",
      }),
      "OpenAI structured-output operation completed",
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain("sensitive");
  });
});
