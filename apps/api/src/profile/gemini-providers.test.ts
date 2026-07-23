import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../observability/logger.js";
import {
  createGeminiGenerate,
  GeminiRequestError,
  GeminiProfileExtractionProvider,
  GeminiTranscriptionProvider,
  parseRetryAfterMilliseconds,
} from "./gemini-providers.js";

describe("Gemini profile providers", () => {
  it("calls Gemini generateContent with API-key authentication", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "resultado" }] } }],
          }),
          { status: 200 },
        ),
    );
    const generate = createGeminiGenerate({
      apiKey: "secret",
      model: "gemini-test",
      fetch: fetchMock as typeof fetch,
    });
    expect(await generate({ parts: [{ text: "prompt" }] })).toEqual({
      text: "resultado",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("gemini-test"),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-goog-api-key": "secret" }),
      }),
    );
  });

  it("transcribes inline audio without using the Files API", async () => {
    const request = vi.fn(async () => ({ text: "Olá, eu gosto de livros." }));
    const provider = new GeminiTranscriptionProvider(request);
    const transcript = await provider.transcribe({
      audio: Buffer.from("audio"),
      mimeType: "audio/webm",
      instructionLanguage: "pt-BR",
    });
    expect(transcript).toBe("Olá, eu gosto de livros.");
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        parts: expect.arrayContaining([
          expect.objectContaining({
            inlineData: expect.objectContaining({ mimeType: "audio/webm" }),
          }),
        ]),
      }),
    );
  });

  it("logs provider failures without including the generated request", async () => {
    const error = vi.fn();
    const logger = { error } as unknown as AppLogger;
    const generate = createGeminiGenerate(
      {
        apiKey: "secret",
        model: "gemini-test",
        fetch: vi.fn(
          async () => new Response("failure", { status: 429 }),
        ) as typeof fetch,
      },
      logger,
    );

    await expect(
      generate({
        parts: [{ text: "sensitive profile transcript" }],
      }),
    ).rejects.toThrow("gemini_request_failed:429");

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: "gemini_request_failed:429",
        event: "gemini.generate.failed",
        model: "gemini-test",
      }),
      "Gemini generation failed",
    );
    expect(error.mock.calls[0]?.[0]).not.toHaveProperty("request");
  });

  it("preserves Gemini retry guidance for failed requests", async () => {
    const generate = createGeminiGenerate({
      apiKey: "secret",
      model: "gemini-test",
      fetch: vi.fn(
        async () =>
          new Response("failure", {
            status: 503,
            headers: { "retry-after": "3" },
          }),
      ) as typeof fetch,
    });

    await expect(generate({ parts: [{ text: "prompt" }] })).rejects.toEqual(
      new GeminiRequestError(503, 3_000),
    );
  });

  it("parses both forms of Retry-After response headers", () => {
    expect(parseRetryAfterMilliseconds("1.5")).toBe(1_500);
    const now = Date.parse("Thu, 23 Jul 2026 19:00:00 GMT");
    expect(
      parseRetryAfterMilliseconds("Thu, 23 Jul 2026 19:00:01 GMT", now),
    ).toBe(1_000);
    expect(parseRetryAfterMilliseconds("invalid")).toBeUndefined();
  });

  it("returns only schema-validated explicit profile details", async () => {
    const request = vi.fn(async () => ({
      text: JSON.stringify({
        jobOrField: null,
        interests: ["livros"],
        dailyRoutine: [],
        studyContext: null,
        other: [],
      }),
    }));
    const provider = new GeminiProfileExtractionProvider(request);
    expect(await provider.extract("Gosto de livros.", "pt-BR")).toEqual(
      expect.objectContaining({ interests: ["livros"] }),
    );
  });
});
