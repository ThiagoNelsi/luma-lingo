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

export const diagnosticQuestionBankPrerequisiteSchema = z.object({
  competencyId: z.string(),
  competencyKey: z.string(),
  strength: z.number().int().min(0).max(100).nullable(),
});
export type DiagnosticQuestionBankPrerequisite = z.infer<
  typeof diagnosticQuestionBankPrerequisiteSchema
>;

export const diagnosticQuestionBankGoalPrioritySchema = z.object({
  goal: z.string(),
  priority: z.number().int().min(0).max(100),
});
export type DiagnosticQuestionBankGoalPriority = z.infer<
  typeof diagnosticQuestionBankGoalPrioritySchema
>;

export const diagnosticQuestionBankCompetencySchema = z.object({
  id: z.string(),
  key: z.string(),
  family: z.string(),
  mode: z.string().nullable(),
  difficultyBand: z.string().nullable(),
  isCore: z.boolean(),
  prerequisites: z.array(diagnosticQuestionBankPrerequisiteSchema).default([]),
  goalPriorities: z.array(diagnosticQuestionBankGoalPrioritySchema).default([]),
});
export type DiagnosticQuestionBankCompetency = z.infer<
  typeof diagnosticQuestionBankCompetencySchema
>;

export const diagnosticQuestionBankItemSchema = z.object({
  id: z.string(),
  key: z.string(),
  primaryCompetencyId: z.string(),
  primaryCompetencyKey: z.string(),
  primaryCompetency: diagnosticQuestionBankCompetencySchema.optional(),
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
