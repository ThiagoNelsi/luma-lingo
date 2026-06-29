import {
  authoredDiagnosticItemDetailsSchema,
  diagnosticQuestionPromptSchema,
  diagnosticQuestionResponseFormatSchema,
  diagnosticQuestionScoringRuleSchema,
  diagnosticQuestionStatusSchema,
  type DiagnosticQuestionPrompt,
  type DiagnosticQuestionScoringRule,
} from "@luma-lingo/shared";
import { z } from "zod";

export const diagnosticQuestionBankCatalogSchema = z.object({
  id: z.string(),
  targetLanguage: z.string(),
  version: z.string(),
  status: z.literal("published"),
  publishedAt: z.date().nullable(),
});
export type DiagnosticQuestionBankCatalog = z.infer<
  typeof diagnosticQuestionBankCatalogSchema
>;

export const diagnosticQuestionBankTargetSchema = z.object({
  competencyId: z.string(),
  competencyKey: z.string(),
  role: z.enum(["primary", "supporting"]),
  weight: z.number().int().min(0).max(100),
  details: z
    .object({
      schemaVersion: z.literal(1),
      scoringNotes: z.string().trim().min(1).max(500).optional(),
    })
    .default({ schemaVersion: 1 }),
});
export type DiagnosticQuestionBankTarget = z.infer<
  typeof diagnosticQuestionBankTargetSchema
>;

export const diagnosticQuestionBankItemSchema = z.object({
  id: z.string(),
  key: z.string(),
  primaryCompetencyId: z.string(),
  primaryCompetencyKey: z.string(),
  difficultyBand: z.string(),
  responseFormat: diagnosticQuestionResponseFormatSchema,
  status: diagnosticQuestionStatusSchema,
  prompt: diagnosticQuestionPromptSchema,
  scoringRule: diagnosticQuestionScoringRuleSchema,
  details: authoredDiagnosticItemDetailsSchema,
  reviewedAt: z.date().nullable(),
  publishedAt: z.date().nullable(),
  targets: z.array(diagnosticQuestionBankTargetSchema).min(1),
});
export type DiagnosticQuestionBankItem = Omit<
  z.infer<typeof diagnosticQuestionBankItemSchema>,
  "prompt" | "scoringRule"
> & {
  prompt: DiagnosticQuestionPrompt;
  scoringRule: DiagnosticQuestionScoringRule;
};

export const diagnosticQuestionBankSchema = z.object({
  catalog: diagnosticQuestionBankCatalogSchema,
  items: z.array(diagnosticQuestionBankItemSchema),
});
export type DiagnosticQuestionBank = Omit<
  z.infer<typeof diagnosticQuestionBankSchema>,
  "items"
> & {
  items: DiagnosticQuestionBankItem[];
};
