import {
  diagnosticQuestionPromptSchema,
  diagnosticQuestionResponseFormatSchema,
} from "@luma-lingo/shared";
import { z } from "zod";

export const initialDiagnosticAttemptDtoSchema = z.object({
  id: z.string(),
  status: z.enum(["in_progress", "completed", "abandoned"]),
  summary: z.record(z.string(), z.unknown()).optional(),
});
export type InitialDiagnosticAttemptDto = z.infer<
  typeof initialDiagnosticAttemptDtoSchema
>;

export const initialDiagnosticItemDtoSchema = z.object({
  attemptItemId: z.string(),
  position: z.number().int().positive(),
  diagnosticItemId: z.string(),
  key: z.string(),
  responseFormat: diagnosticQuestionResponseFormatSchema,
  prompt: diagnosticQuestionPromptSchema,
});
export type InitialDiagnosticItemDto = z.infer<
  typeof initialDiagnosticItemDtoSchema
>;

export const initialDiagnosticDtoSchema = z.object({
  attempt: initialDiagnosticAttemptDtoSchema,
  item: initialDiagnosticItemDtoSchema.nullable(),
});
export type InitialDiagnosticDto = z.infer<typeof initialDiagnosticDtoSchema>;
