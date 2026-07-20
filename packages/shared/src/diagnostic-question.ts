import { z } from "zod";

import { capabilityValues } from "./competency-catalog.js";
import { languageCodeSchema, languageCodes } from "./languages.js";

export const diagnosticQuestionResponseFormatValues = [
  "multiple_choice",
  "fill_blank_choice",
  "word_bank_sequence",
] as const;

export const diagnosticQuestionModeValues = [
  "reading",
  "writing",
  "listening",
  "speaking",
] as const;

export const diagnosticQuestionRoleValues = [
  "foundation",
  "ceiling",
  "repair",
  "confidence",
  "goal_probe",
] as const;

export const diagnosticQuestionStatusValues = [
  "draft",
  "reviewed",
  "published",
] as const;

export const diagnosticDifficultyBandValues = [
  "Pre-A1",
  "A1",
  "A2",
  "B1",
  "B2",
] as const;

export const diagnosticQuestionResponseFormatSchema = z.enum(
  diagnosticQuestionResponseFormatValues,
);
export const diagnosticQuestionModeSchema = z.enum(
  diagnosticQuestionModeValues,
);
export const diagnosticQuestionRoleSchema = z.enum(
  diagnosticQuestionRoleValues,
);
export const diagnosticQuestionStatusSchema = z.enum(
  diagnosticQuestionStatusValues,
);
export const diagnosticDifficultyBandSchema = z.enum(
  diagnosticDifficultyBandValues,
);

const itemKeySchema = z.string().trim().min(1).max(160);
const componentIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9_]*$/);
const localizedTextSchema = z.string().trim().min(1).max(500);
const promptTextSchema = z.string().trim().min(1).max(1000);
const notesSchema = z.array(z.string().trim().min(1).max(500)).max(20);
const mistakeCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);

const supportedLanguageCodes = new Set<string>(languageCodes);

export const diagnosticInstructionLocalizationsSchema = z
  .record(z.string(), localizedTextSchema)
  .superRefine((localizations, context) => {
    const localizationLanguages = Object.keys(localizations);

    if (localizationLanguages.length === 0) {
      context.addIssue({
        code: "custom",
        message: "instruction_localizations_required",
      });
    }

    for (const language of localizationLanguages) {
      if (!supportedLanguageCodes.has(language)) {
        context.addIssue({
          code: "custom",
          message: "unsupported_instruction_language",
          path: [language],
        });
      }
    }
  });

const diagnosticPromptBaseSchema = z.object({
  schemaVersion: z.literal(1),
  instructionLocalizations: diagnosticInstructionLocalizationsSchema,
  contentLanguage: languageCodeSchema,
});

export const diagnosticPromptOptionSchema = z.object({
  id: componentIdSchema,
  text: promptTextSchema,
});

export const diagnosticPromptTokenSchema = z.object({
  id: componentIdSchema,
  text: promptTextSchema,
});

export const multipleChoiceDiagnosticPromptSchema =
  diagnosticPromptBaseSchema.extend({
    kind: z.literal("multiple_choice"),
    stem: promptTextSchema,
    options: z.array(diagnosticPromptOptionSchema).min(2).max(6),
  });

export const fillBlankChoiceDiagnosticPromptSchema =
  diagnosticPromptBaseSchema.extend({
    kind: z.literal("fill_blank_choice"),
    text: promptTextSchema,
    blankId: componentIdSchema,
    options: z.array(diagnosticPromptOptionSchema).min(2).max(6),
  });

export const wordBankSequenceDiagnosticPromptSchema =
  diagnosticPromptBaseSchema.extend({
    kind: z.literal("word_bank_sequence"),
    tokens: z.array(diagnosticPromptTokenSchema).min(2).max(12),
  });

export const diagnosticQuestionPromptSchema = z.discriminatedUnion("kind", [
  multipleChoiceDiagnosticPromptSchema,
  fillBlankChoiceDiagnosticPromptSchema,
  wordBankSequenceDiagnosticPromptSchema,
]);

const distractorSchema = z.object({
  mistakeCode: mistakeCodeSchema,
  rationale: z.string().trim().min(1).max(500),
});

const diagnosticScoringRuleBaseSchema = z.object({
  schemaVersion: z.literal(1),
  maxScore: z.literal(1),
  passingScore: z.number().min(0).max(1),
  evidenceConfidence: z.number().min(0).max(1),
});

const choiceScoringFields = {
  correctOptionIds: z.array(componentIdSchema).min(1).max(6),
  distractors: z.record(componentIdSchema, distractorSchema).default({}),
};

export const multipleChoiceDiagnosticScoringRuleSchema =
  diagnosticScoringRuleBaseSchema.extend({
    kind: z.literal("multiple_choice"),
    ...choiceScoringFields,
  });

export const fillBlankChoiceDiagnosticScoringRuleSchema =
  diagnosticScoringRuleBaseSchema.extend({
    kind: z.literal("fill_blank_choice"),
    blankId: componentIdSchema,
    ...choiceScoringFields,
  });

const wordBankCriterionBaseSchema = z.object({
  id: componentIdSchema,
  score: z.number().min(0).max(1),
  mistakeCodeOnFail: mistakeCodeSchema,
  rationale: z.string().trim().min(1).max(500),
});

export const allRequiredTokensUsedCriterionSchema =
  wordBankCriterionBaseSchema.extend({
    type: z.literal("all_required_tokens_used"),
    requiredTokens: z.array(componentIdSchema).min(1).max(12).optional(),
  });

export const noExtraTokensCriterionSchema = wordBankCriterionBaseSchema.extend({
  type: z.literal("no_extra_tokens"),
  allowedTokens: z.array(componentIdSchema).min(1).max(12).optional(),
});

export const relativeOrderCriterionSchema = wordBankCriterionBaseSchema.extend({
  type: z.literal("relative_order"),
  left: z.array(componentIdSchema).min(1).max(12),
  right: z.array(componentIdSchema).min(1).max(12),
});

export const adjacencyCriterionSchema = wordBankCriterionBaseSchema.extend({
  type: z.literal("adjacency"),
  tokens: z.array(componentIdSchema).min(2).max(12),
});

export const tokenAtPositionCriterionSchema =
  wordBankCriterionBaseSchema.extend({
    type: z.literal("token_at_position"),
    token: componentIdSchema,
    position: z.number().int().min(1).max(12),
  });

export const tokenBeforeGroupCriterionSchema =
  wordBankCriterionBaseSchema.extend({
    type: z.literal("token_before_group"),
    token: componentIdSchema,
    group: componentIdSchema,
  });

export const tokenAfterGroupCriterionSchema =
  wordBankCriterionBaseSchema.extend({
    type: z.literal("token_after_group"),
    token: componentIdSchema,
    group: componentIdSchema,
  });

export const wordBankSequenceCriterionSchema = z.discriminatedUnion("type", [
  allRequiredTokensUsedCriterionSchema,
  noExtraTokensCriterionSchema,
  relativeOrderCriterionSchema,
  adjacencyCriterionSchema,
  tokenAtPositionCriterionSchema,
  tokenBeforeGroupCriterionSchema,
  tokenAfterGroupCriterionSchema,
]);

export const wordBankSequenceDiagnosticScoringRuleSchema =
  diagnosticScoringRuleBaseSchema
    .extend({
      kind: z.literal("word_bank_sequence"),
      correctTokenSequences: z
        .array(z.array(componentIdSchema).min(2).max(12))
        .min(1)
        .max(5),
      tokenGroups: z
        .record(componentIdSchema, z.array(componentIdSchema).min(1).max(12))
        .default({}),
      criteria: z
        .array(wordBankSequenceCriterionSchema)
        .min(1)
        .max(20)
        .optional(),
      fallbackMistakeCode: mistakeCodeSchema.optional(),
    })
    .superRefine((rule, context) => {
      for (const [index, criterion] of rule.criteria?.entries() ?? []) {
        if (
          (criterion.type === "token_before_group" ||
            criterion.type === "token_after_group") &&
          !rule.tokenGroups[criterion.group]
        ) {
          context.addIssue({
            code: "custom",
            message: "criterion_group_must_exist_in_token_groups",
            path: ["criteria", index, "group"],
          });
        }
      }
    });

export const diagnosticQuestionScoringRuleSchema = z.discriminatedUnion(
  "kind",
  [
    multipleChoiceDiagnosticScoringRuleSchema,
    fillBlankChoiceDiagnosticScoringRuleSchema,
    wordBankSequenceDiagnosticScoringRuleSchema,
  ],
);

export const dontKnowDiagnosticResponseSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("dont_know"),
});

export const multipleChoiceDiagnosticResponseSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("multiple_choice"),
  selectedOptionIds: z.array(componentIdSchema).min(1).max(6),
});

export const fillBlankChoiceDiagnosticResponseSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("fill_blank_choice"),
  blankId: componentIdSchema,
  selectedOptionId: componentIdSchema,
});

export const wordBankSequenceDiagnosticResponseSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("word_bank_sequence"),
  selectedTokenIds: z.array(componentIdSchema).min(2).max(12),
});

export const diagnosticQuestionResponseSchema = z.discriminatedUnion("kind", [
  dontKnowDiagnosticResponseSchema,
  multipleChoiceDiagnosticResponseSchema,
  fillBlankChoiceDiagnosticResponseSchema,
  wordBankSequenceDiagnosticResponseSchema,
]);

export const authoredDiagnosticItemDetailsSchema = z.object({
  schemaVersion: z.literal(1),
  diagnosticRoles: z.array(diagnosticQuestionRoleSchema).min(1).max(5),
  rationale: z.string().trim().min(1).max(1000),
  safetyNotes: notesSchema,
  localizationNotes: notesSchema,
  distractorRationale: z
    .record(componentIdSchema, z.string().trim().min(1).max(500))
    .default({}),
  authoringSource: z
    .object({
      plan: z.string().trim().min(1).max(120),
      variant: diagnosticQuestionRoleSchema,
    })
    .optional(),
});

export const authoredDiagnosticPrimaryTargetSchema = z.discriminatedUnion(
  "kind",
  [
    z.object({
      kind: z.literal("competency"),
      competencyKey: itemKeySchema,
    }),
    z.object({
      kind: z.literal("concept"),
      conceptKey: itemKeySchema,
    }),
  ],
);

export const authoredDiagnosticEvidenceMappingSchema = z.object({
  conceptKey: itemKeySchema,
  capability: z.enum(capabilityValues),
  strength: z.number().int().min(1).max(100),
});

export const authoredDiagnosticQuestionSchema = z
  .object({
    key: itemKeySchema,
    status: diagnosticQuestionStatusSchema,
    primaryTarget: authoredDiagnosticPrimaryTargetSchema,
    difficultyBand: diagnosticDifficultyBandSchema,
    mode: diagnosticQuestionModeSchema,
    responseFormat: diagnosticQuestionResponseFormatSchema,
    prompt: diagnosticQuestionPromptSchema,
    scoringRule: diagnosticQuestionScoringRuleSchema,
    evidenceMappings: z
      .array(authoredDiagnosticEvidenceMappingSchema)
      // Componentless integrated competencies (for example greetings) can
      // produce direct competency evidence without a defensible concept row.
      // The catalog-aware importer enforces that empty mappings are limited to
      // those primary competency targets.
      .min(0)
      .max(12),
    details: authoredDiagnosticItemDetailsSchema,
  })
  .superRefine((item, context) => {
    if (item.responseFormat !== item.prompt.kind) {
      context.addIssue({
        code: "custom",
        message: "response_format_must_match_prompt_kind",
        path: ["prompt", "kind"],
      });
    }

    if (item.responseFormat !== item.scoringRule.kind) {
      context.addIssue({
        code: "custom",
        message: "response_format_must_match_scoring_rule_kind",
        path: ["scoringRule", "kind"],
      });
    }

    const duplicateMappings = new Set<string>();
    for (const mapping of item.evidenceMappings) {
      const mappingKey = `${mapping.conceptKey}:${mapping.capability}`;
      if (duplicateMappings.has(mappingKey)) {
        context.addIssue({
          code: "custom",
          message: "evidence_mappings_must_be_unique_per_concept_capability",
          path: ["evidenceMappings"],
        });
      }
      duplicateMappings.add(mappingKey);
    }
  });

export const authoredDiagnosticQuestionBankSchema = z.object({
  schemaVersion: z.literal(1),
  targetLanguage: languageCodeSchema,
  catalogVersion: z.string().trim().min(1).max(80),
  purpose: z.literal("onboarding_initial"),
  items: z.array(authoredDiagnosticQuestionSchema),
});

export type DiagnosticQuestionResponseFormat = z.infer<
  typeof diagnosticQuestionResponseFormatSchema
>;
export type DiagnosticQuestionMode = z.infer<
  typeof diagnosticQuestionModeSchema
>;
export type DiagnosticQuestionRole = z.infer<
  typeof diagnosticQuestionRoleSchema
>;
export type DiagnosticQuestionStatus = z.infer<
  typeof diagnosticQuestionStatusSchema
>;
export type DiagnosticDifficultyBand = z.infer<
  typeof diagnosticDifficultyBandSchema
>;
export type DiagnosticQuestionPrompt = z.infer<
  typeof diagnosticQuestionPromptSchema
>;
export type DiagnosticQuestionScoringRule = z.infer<
  typeof diagnosticQuestionScoringRuleSchema
>;
export type WordBankSequenceCriterion = z.infer<
  typeof wordBankSequenceCriterionSchema
>;
export type DiagnosticQuestionResponse = z.infer<
  typeof diagnosticQuestionResponseSchema
>;
export type AuthoredDiagnosticQuestion = z.infer<
  typeof authoredDiagnosticQuestionSchema
>;
export type AuthoredDiagnosticPrimaryTarget = z.infer<
  typeof authoredDiagnosticPrimaryTargetSchema
>;
export type AuthoredDiagnosticEvidenceMapping = z.infer<
  typeof authoredDiagnosticEvidenceMappingSchema
>;
export type AuthoredDiagnosticQuestionBank = z.infer<
  typeof authoredDiagnosticQuestionBankSchema
>;
