import {
  diagnosticQuestionPromptSchema,
  diagnosticQuestionResponseFormatSchema,
  diagnosticQuestionResponseSchema,
  type DiagnosticQuestionResponse,
} from "@luma-lingo/shared";
import { z } from "zod";

import { normalizeApiOrigin } from "../config/api-origin.js";

const initialDiagnosticAttemptSchema = z.object({
  id: z.string(),
  status: z.enum(["in_progress", "completed", "abandoned"]),
  summary: z.record(z.string(), z.unknown()).optional(),
});

const initialDiagnosticItemSchema = z.object({
  attemptItemId: z.string(),
  position: z.number().int().positive(),
  diagnosticItemId: z.string(),
  key: z.string(),
  responseFormat: diagnosticQuestionResponseFormatSchema,
  prompt: diagnosticQuestionPromptSchema,
});

export const initialDiagnosticResultSchema = z.object({
  attempt: initialDiagnosticAttemptSchema,
  item: initialDiagnosticItemSchema.nullable(),
});
export type InitialDiagnosticResult = z.infer<
  typeof initialDiagnosticResultSchema
>;
export type InitialDiagnosticItem = z.infer<typeof initialDiagnosticItemSchema>;

export class UnauthorizedInitialDiagnosticError extends Error {}

export async function startInitialDiagnostic(
  apiOrigin: string,
): Promise<InitialDiagnosticResult> {
  const response = await fetch(
    `${normalizeApiOrigin(apiOrigin)}/me/initial-diagnostic/start`,
    {
      method: "POST",
      credentials: "include",
    },
  );

  return parseInitialDiagnosticResponse(response);
}

export async function submitInitialDiagnosticResponse(
  apiOrigin: string,
  diagnosticResponse: DiagnosticQuestionResponse,
): Promise<InitialDiagnosticResult> {
  const response = await fetch(
    `${normalizeApiOrigin(apiOrigin)}/me/initial-diagnostic/responses`,
    {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        diagnosticQuestionResponseSchema.parse(diagnosticResponse),
      ),
    },
  );

  return parseInitialDiagnosticResponse(response);
}

async function parseInitialDiagnosticResponse(
  response: Response,
): Promise<InitialDiagnosticResult> {
  if (response.status === 401) {
    throw new UnauthorizedInitialDiagnosticError("unauthenticated");
  }
  if (!response.ok) throw new Error("initial_diagnostic_request_failed");

  return initialDiagnosticResultSchema.parse(await response.json());
}
