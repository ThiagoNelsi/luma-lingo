import { z } from "zod";

export const initialDiagnosticSelectionPolicyVersion =
  "initial-diagnostic-selection-v1";
export const initialDiagnosticScoringPolicyVersion =
  "initial-diagnostic-scoring-v1";

export const initialDiagnosticPolicyConfigSchema = z.object({
  maxItems: z.number().int().positive(),
  explorationItems: z.number().int().positive(),
  finalValidationItems: z.number().int().nonnegative(),
  maxItemsPerCompetency: z.number().int().positive(),
  maxRepairItems: z.number().int().nonnegative(),
  maxRepairItemsPerCompetency: z.number().int().nonnegative(),
  prerequisiteSpreadMaxDepth: z.number().int().nonnegative(),
  strongCorrectMinScore: z.number().min(0).max(1),
  strongCorrectMinConfidence: z.number().min(0).max(1),
  requireExactWordBankSequenceForSpread: z.boolean(),
  levelAdvanceThresholds: z.object({
    "Pre-A1": z.number().int().positive(),
    A1: z.number().int().positive(),
    A2: z.number().int().positive(),
    B1: z.number().int().positive(),
  }),
  levelRegressionThreshold: z.number().int().negative(),
});
export type InitialDiagnosticPolicyConfig = z.infer<
  typeof initialDiagnosticPolicyConfigSchema
>;

export const defaultInitialDiagnosticPolicyConfig = {
  maxItems: 16,
  explorationItems: 14,
  finalValidationItems: 2,
  maxItemsPerCompetency: 2,
  maxRepairItems: 1,
  maxRepairItemsPerCompetency: 1,
  prerequisiteSpreadMaxDepth: 2,
  strongCorrectMinScore: 0.9,
  strongCorrectMinConfidence: 0.7,
  requireExactWordBankSequenceForSpread: true,
  levelAdvanceThresholds: {
    "Pre-A1": 2,
    A1: 3,
    A2: 3,
    B1: 3,
  },
  levelRegressionThreshold: -2,
} satisfies InitialDiagnosticPolicyConfig;

export interface InitialDiagnosticSelectionPolicy {
  version: string;
  config: InitialDiagnosticPolicyConfig;
}

export interface InitialDiagnosticScoringPolicy {
  version: string;
  config: InitialDiagnosticPolicyConfig;
}

export const initialDiagnosticSelectionPolicy: InitialDiagnosticSelectionPolicy =
  {
    version: initialDiagnosticSelectionPolicyVersion,
    config: defaultInitialDiagnosticPolicyConfig,
  };

export const initialDiagnosticScoringPolicy: InitialDiagnosticScoringPolicy = {
  version: initialDiagnosticScoringPolicyVersion,
  config: defaultInitialDiagnosticPolicyConfig,
};

export function toInitialDiagnosticAttemptDetails(input: {
  selectionPolicy?: InitialDiagnosticSelectionPolicy;
  scoringPolicy?: InitialDiagnosticScoringPolicy;
}): Record<string, unknown> {
  const selectionPolicy =
    input.selectionPolicy ?? initialDiagnosticSelectionPolicy;
  const scoringPolicy = input.scoringPolicy ?? initialDiagnosticScoringPolicy;

  return {
    schemaVersion: 1,
    selectionPolicy: {
      version: selectionPolicy.version,
      config: selectionPolicy.config,
    },
    scoringPolicy: {
      version: scoringPolicy.version,
      config: scoringPolicy.config,
    },
  };
}
