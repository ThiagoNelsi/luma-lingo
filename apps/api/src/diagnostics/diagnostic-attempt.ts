import { z } from "zod";

export const diagnosticEvidenceDetailsSchemaVersion = 1;
export const learnerCompetencyStateDetailsSchemaVersion = 1;

export const diagnosticAttemptAbandonReasons = {
  resumeWindowExpired: "resume_window_expired",
} as const;

export const diagnosticJsonObjectSchema = z.record(z.string(), z.unknown());
export type DiagnosticJsonObject = z.infer<typeof diagnosticJsonObjectSchema>;

export const diagnosticAttemptStatusSchema = z.enum([
  "in_progress",
  "completed",
  "abandoned",
]);
export type DiagnosticAttemptStatus = z.infer<
  typeof diagnosticAttemptStatusSchema
>;

export const diagnosticAttemptAbandonReasonSchema = z.enum([
  diagnosticAttemptAbandonReasons.resumeWindowExpired,
]);
export type DiagnosticAttemptAbandonReason = z.infer<
  typeof diagnosticAttemptAbandonReasonSchema
>;

export const diagnosticAttemptSchema = z.object({
  id: z.string(),
  learningTrackId: z.string(),
  catalogId: z.string(),
  purpose: z.string(),
  status: diagnosticAttemptStatusSchema,
  selectionPolicyVersion: z.string(),
  scoringPolicyVersion: z.string(),
  startedAt: z.date(),
  completedAt: z.date().nullable(),
  abandonedAt: z.date().nullable(),
  summary: diagnosticJsonObjectSchema,
  details: diagnosticJsonObjectSchema,
});
export type DiagnosticAttempt = z.infer<typeof diagnosticAttemptSchema>;

export const diagnosticAttemptItemSchema = z.object({
  id: z.string(),
  attemptId: z.string(),
  diagnosticItemId: z.string(),
  position: z.number().int().positive(),
  selectedForRole: z.string(),
  selectionRule: z.string(),
  selectionTrace: diagnosticJsonObjectSchema,
  response: diagnosticJsonObjectSchema.nullable(),
  score: z.number().min(0).max(1).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  shownAt: z.date(),
  answeredAt: z.date().nullable(),
  details: diagnosticJsonObjectSchema,
});
export type DiagnosticAttemptItem = z.infer<typeof diagnosticAttemptItemSchema>;

export const createDiagnosticAttemptInputSchema = z.object({
  learningTrackId: z.string(),
  catalogId: z.string(),
  purpose: z.string(),
  selectionPolicyVersion: z.string(),
  scoringPolicyVersion: z.string(),
  startedAt: z.date(),
});
export type CreateDiagnosticAttemptInput = z.infer<
  typeof createDiagnosticAttemptInputSchema
>;

export const resumeOrCreateDiagnosticAttemptInputSchema =
  createDiagnosticAttemptInputSchema.omit({
    startedAt: true,
  });
export type ResumeOrCreateDiagnosticAttemptInput = z.infer<
  typeof resumeOrCreateDiagnosticAttemptInputSchema
>;

export const recordShownDiagnosticAttemptItemInputSchema = z.object({
  attemptId: z.string(),
  diagnosticItemId: z.string(),
  position: z.number().int().positive(),
  selectedForRole: z.string(),
  selectionRule: z.string(),
  selectionTrace: diagnosticJsonObjectSchema,
});
export type RecordShownDiagnosticAttemptItemInput = z.infer<
  typeof recordShownDiagnosticAttemptItemInputSchema
>;

export const answerDiagnosticAttemptItemInputSchema = z.object({
  attemptItemId: z.string(),
  response: diagnosticJsonObjectSchema,
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  details: diagnosticJsonObjectSchema,
});
export type AnswerDiagnosticAttemptItemInput = z.infer<
  typeof answerDiagnosticAttemptItemInputSchema
>;

export const completeDiagnosticAttemptInputSchema = z.object({
  attemptId: z.string(),
  summary: diagnosticJsonObjectSchema,
});
export type CompleteDiagnosticAttemptInput = z.infer<
  typeof completeDiagnosticAttemptInputSchema
>;
