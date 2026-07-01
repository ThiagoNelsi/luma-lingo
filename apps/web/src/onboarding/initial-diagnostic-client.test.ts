import { afterEach, describe, expect, it, vi } from "vitest";

import {
  startInitialDiagnostic,
  submitInitialDiagnosticResponse,
  UnauthorizedInitialDiagnosticError,
} from "./initial-diagnostic-client.js";

describe("Initial diagnostic client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("starts the Initial diagnostic with credentials and parses the current item", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          attempt: {
            id: "attempt-1",
            status: "in_progress",
          },
          item: {
            attemptItemId: "attempt-item-1",
            position: 1,
            diagnosticItemId: "item-1",
            key: "en.diag.pre-a1.subject-pronouns.001",
            responseFormat: "multiple_choice",
            prompt: {
              schemaVersion: 1,
              kind: "multiple_choice",
              instructionLocalizations: {
                pt: "Escolha a melhor resposta.",
              },
              contentLanguage: "en",
              stem: "Maria is a teacher. ___ is from Brazil.",
              options: [
                { id: "option_she", text: "She" },
                { id: "option_he", text: "He" },
              ],
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      startInitialDiagnostic("http://localhost:3000/"),
    ).resolves.toMatchObject({
      attempt: {
        status: "in_progress",
      },
      item: {
        position: 1,
        responseFormat: "multiple_choice",
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/me/initial-diagnostic/start",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
  });

  it("submits a structured response with credentials and parses completion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          attempt: {
            id: "attempt-1",
            status: "completed",
            summary: {
              schemaVersion: 1,
              answeredItemCount: 2,
            },
          },
          item: null,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitInitialDiagnosticResponse("http://localhost:3000/", {
        schemaVersion: 1,
        kind: "multiple_choice",
        selectedOptionIds: ["option_she"],
      }),
    ).resolves.toMatchObject({
      attempt: {
        status: "completed",
      },
      item: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/me/initial-diagnostic/responses",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          schemaVersion: 1,
          kind: "multiple_choice",
          selectedOptionIds: ["option_she"],
        }),
      }),
    );
  });

  it("throws a specific unauthorized error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 401 })),
    );

    await expect(
      startInitialDiagnostic("http://localhost:3000"),
    ).rejects.toBeInstanceOf(UnauthorizedInitialDiagnosticError);
  });
});
