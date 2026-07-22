import { z } from "zod";

import { goalSchema } from "./age-and-goals.js";

const semanticVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const languageSchema = z.string().regex(/^[a-z]{2,3}$/);
const policyWeightSchema = z.number().int().min(0).max(100);

export const pedagogicalCompetencyWeightSchema = z
  .object({
    competencyId: z.string().trim().min(1),
    basePriority: policyWeightSchema.optional(),
    foundationWeight: policyWeightSchema.optional(),
  })
  .refine(
    (weight) =>
      weight.basePriority !== undefined ||
      weight.foundationWeight !== undefined,
    { message: "competency_weight_requires_a_value" },
  );

export const pedagogicalCompetencyGoalWeightSchema = z.object({
  competencyId: z.string().trim().min(1),
  goal: goalSchema,
  weight: policyWeightSchema,
});

export const pedagogicalConceptGoalWeightSchema = z.object({
  conceptId: z.string().trim().min(1),
  goal: goalSchema,
  weight: policyWeightSchema,
});

export const pedagogicalRankingConfigSchema = z.object({
  readiness: policyWeightSchema,
  foundation: policyWeightSchema,
  basePriority: policyWeightSchema,
  goalFit: policyWeightSchema,
  knowledgeGap: policyWeightSchema,
  uncertainty: policyWeightSchema,
  reviewNeed: policyWeightSchema,
  recentRepetition: policyWeightSchema,
  recentRepetitionWindowDays: z.number().int().min(1).max(365),
});

export const pedagogicalPolicySchema = z
  .object({
    id: z.string().trim().min(1),
    language: languageSchema,
    version: semanticVersionSchema,
    catalogVersion: semanticVersionSchema,
    competencyWeights: z.array(pedagogicalCompetencyWeightSchema),
    competencyGoalWeights: z.array(pedagogicalCompetencyGoalWeightSchema),
    conceptGoalWeights: z.array(pedagogicalConceptGoalWeightSchema),
    ranking: pedagogicalRankingConfigSchema.optional(),
  })
  .superRefine((policy, context) => {
    const duplicateCompetencyWeight = findDuplicate(
      policy.competencyWeights.map((weight) => weight.competencyId),
    );
    if (duplicateCompetencyWeight) {
      context.addIssue({
        code: "custom",
        message: "duplicate_competency_weight",
        path: ["competencyWeights"],
      });
    }

    const duplicateCompetencyGoalWeight = findDuplicate(
      policy.competencyGoalWeights.map(
        (weight) => `${weight.competencyId}:${weight.goal}`,
      ),
    );
    if (duplicateCompetencyGoalWeight) {
      context.addIssue({
        code: "custom",
        message: "duplicate_competency_goal_weight",
        path: ["competencyGoalWeights"],
      });
    }

    const duplicateConceptGoalWeight = findDuplicate(
      policy.conceptGoalWeights.map(
        (weight) => `${weight.conceptId}:${weight.goal}`,
      ),
    );
    if (duplicateConceptGoalWeight) {
      context.addIssue({
        code: "custom",
        message: "duplicate_concept_goal_weight",
        path: ["conceptGoalWeights"],
      });
    }
  });

export type PedagogicalPolicy = z.infer<typeof pedagogicalPolicySchema>;
export type PedagogicalRankingConfig = z.infer<
  typeof pedagogicalRankingConfigSchema
>;

function findDuplicate(values: string[]): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}
