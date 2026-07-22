import { capabilityValues } from "@luma-lingo/shared";
import { z } from "zod";

const capabilityRank = new Map(
  capabilityValues.map((capability, index) => [capability, index]),
);

export const knowledgeInferencePolicyVersion = "knowledge-inference-v1";

export const knowledgeInferencePolicyConfigSchema = z.object({
  strongPositiveMinScore: z.number().min(0).max(1),
  strongPositiveMinConfidence: z.number().min(0).max(1),
  inferredMasteryMultiplier: z.number().min(0).max(1),
  inferredConfidenceMultiplier: z.number().min(0).max(1),
  knownConfidenceThreshold: z.number().min(0).max(1),
  requiredMasteryThreshold: z.number().min(0).max(1),
  unknownReadinessPenalty: z.number().min(0).max(1),
});
export type KnowledgeInferencePolicyConfig = z.infer<
  typeof knowledgeInferencePolicyConfigSchema
>;

export const defaultKnowledgeInferencePolicyConfig: KnowledgeInferencePolicyConfig =
  {
    strongPositiveMinScore: 0.9,
    strongPositiveMinConfidence: 0.75,
    inferredMasteryMultiplier: 0.8,
    inferredConfidenceMultiplier: 0.75,
    knownConfidenceThreshold: 0.5,
    requiredMasteryThreshold: 0.5,
    unknownReadinessPenalty: 0.25,
  };

export const assumedConceptRequirementSchema = z.object({
  conceptId: z.string().min(1),
  requiredCapability: z.enum(capabilityValues),
});
export type AssumedConceptRequirement = z.infer<
  typeof assumedConceptRequirementSchema
>;

export const directConceptEvidenceSchema = z.object({
  conceptId: z.string().min(1),
  capability: z.enum(capabilityValues),
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  isExplicitUnknown: z.boolean().default(false),
  hasExactResponse: z.boolean().default(true),
});
export type DirectConceptEvidence = z.infer<typeof directConceptEvidenceSchema>;
export type DirectConceptEvidenceInput = z.input<
  typeof directConceptEvidenceSchema
>;

export const inferredConceptEvidenceSchema = directConceptEvidenceSchema
  .pick({
    conceptId: true,
    capability: true,
    score: true,
    confidence: true,
  })
  .extend({
    evidenceKind: z.literal("inferred"),
  });
export type InferredConceptEvidence = z.infer<
  typeof inferredConceptEvidenceSchema
>;

export function inferAssumedConceptEvidence(input: {
  directEvidence: DirectConceptEvidenceInput;
  assumedRequirements: AssumedConceptRequirement[];
  policy?: Partial<KnowledgeInferencePolicyConfig>;
}): InferredConceptEvidence[] {
  const directEvidence = directConceptEvidenceSchema.parse(
    input.directEvidence,
  );
  const policy = resolveKnowledgeInferencePolicy(input.policy);
  const assumedRequirements = uniqueAssumedRequirements(
    input.assumedRequirements,
  );

  if (!isStrongPositiveDirectEvidence({ directEvidence, policy })) return [];

  return assumedRequirements.map((requirement) =>
    inferredConceptEvidenceSchema.parse({
      conceptId: requirement.conceptId,
      capability: requirement.requiredCapability,
      score: round01(directEvidence.score * policy.inferredMasteryMultiplier),
      confidence: round01(
        directEvidence.confidence * policy.inferredConfidenceMultiplier,
      ),
      evidenceKind: "inferred",
    }),
  );
}

export function isStrongPositiveDirectEvidence(input: {
  directEvidence: DirectConceptEvidenceInput;
  policy?: Partial<KnowledgeInferencePolicyConfig>;
}): boolean {
  const directEvidence = directConceptEvidenceSchema.parse(
    input.directEvidence,
  );
  const policy = resolveKnowledgeInferencePolicy(input.policy);

  return (
    !directEvidence.isExplicitUnknown &&
    directEvidence.hasExactResponse &&
    directEvidence.score >= policy.strongPositiveMinScore &&
    directEvidence.confidence >= policy.strongPositiveMinConfidence
  );
}

export const conceptMasteryStateSchema = z.object({
  conceptId: z.string().min(1),
  capability: z.enum(capabilityValues).optional(),
  mastery: z.number().min(0).max(1).nullable(),
  confidence: z.number().min(0).max(1),
});
export type ConceptMasteryState = z.infer<typeof conceptMasteryStateSchema>;

type KnownConceptMasteryState = ConceptMasteryState & { mastery: number };

export const competencyMasteryProjectionSchema = z.object({
  kind: z.literal("projection"),
  projectedMastery: z.number().min(0).max(1).nullable(),
  coverage: z.number().min(0).max(1),
  projectedConfidence: z.number().min(0).max(1),
  knownComponentCount: z.number().int().nonnegative(),
  componentCount: z.number().int().nonnegative(),
});
export type CompetencyMasteryProjection = z.infer<
  typeof competencyMasteryProjectionSchema
>;

export function projectCompetencyMastery(input: {
  componentConceptIds: string[];
  conceptStates: ConceptMasteryState[];
}): CompetencyMasteryProjection {
  const componentConceptIds = unique(input.componentConceptIds);
  const conceptStates = input.conceptStates.map((state) =>
    conceptMasteryStateSchema.parse(state),
  );
  const knownStates = componentConceptIds
    .map((conceptId) => highestKnownProjectionState(conceptId, conceptStates))
    .filter(isKnownConceptState);
  const coverage =
    componentConceptIds.length === 0
      ? 0
      : knownStates.length / componentConceptIds.length;
  const aggregateConfidence = average(
    knownStates.map((state) => state.confidence),
  );

  return competencyMasteryProjectionSchema.parse({
    kind: "projection",
    projectedMastery:
      knownStates.length === 0
        ? null
        : round01(average(knownStates.map((state) => state.mastery))),
    coverage: round01(coverage),
    projectedConfidence: round01(aggregateConfidence * coverage),
    knownComponentCount: knownStates.length,
    componentCount: componentConceptIds.length,
  });
}

export const directIntegratedCompetencyStateSchema = z.object({
  mastery: z.number().min(0).max(1).nullable(),
  confidence: z.number().min(0).max(1),
});
export type DirectIntegratedCompetencyState = z.infer<
  typeof directIntegratedCompetencyStateSchema
>;

export const competencyMasterySchema = z.discriminatedUnion("kind", [
  competencyMasteryProjectionSchema,
  z.object({
    kind: z.literal("direct"),
    mastery: z.number().min(0).max(1).nullable(),
    confidence: z.number().min(0).max(1),
  }),
]);
export type CompetencyMastery = z.infer<typeof competencyMasterySchema>;

export function resolveCompetencyMastery(input: {
  componentConceptIds: string[];
  conceptStates: ConceptMasteryState[];
  directIntegratedState?: DirectIntegratedCompetencyState;
}): CompetencyMastery {
  if (input.componentConceptIds.length > 0) {
    return projectCompetencyMastery(input);
  }

  return competencyMasterySchema.parse({
    kind: "direct",
    mastery: input.directIntegratedState?.mastery ?? null,
    confidence: input.directIntegratedState?.confidence ?? 0,
  });
}

export const activityConceptRequirementSchema = assumedConceptRequirementSchema;
export type ActivityConceptRequirement = z.infer<
  typeof activityConceptRequirementSchema
>;

export const activityConceptStateSchema = conceptMasteryStateSchema.extend({
  capability: z.enum(capabilityValues),
});
export type ActivityConceptState = z.infer<typeof activityConceptStateSchema>;

type KnownActivityConceptState = ActivityConceptState & { mastery: number };

export const activityReadinessRequirementSchema = z.object({
  conceptId: z.string().min(1),
  requiredCapability: z.enum(capabilityValues),
  status: z.enum(["satisfied", "unknown", "blocked"]),
  satisfiedByCapability: z.enum(capabilityValues).nullable(),
});
export type ActivityReadinessRequirement = z.infer<
  typeof activityReadinessRequirementSchema
>;

export const activityReadinessSchema = z.object({
  canAttempt: z.boolean(),
  isBlocked: z.boolean(),
  readinessScore: z.number().min(0).max(1),
  requirements: z.array(activityReadinessRequirementSchema),
});
export type ActivityReadiness = z.infer<typeof activityReadinessSchema>;

export function evaluateActivityReadiness(input: {
  requirements: ActivityConceptRequirement[];
  conceptStates: ActivityConceptState[];
  policy?: Partial<KnowledgeInferencePolicyConfig>;
}): ActivityReadiness {
  const policy = resolveKnowledgeInferencePolicy(input.policy);
  const conceptStates = input.conceptStates.map((state) =>
    activityConceptStateSchema.parse(state),
  );
  const requirements = uniqueAssumedRequirements(input.requirements);
  const evaluatedRequirements = requirements.map((requirement) =>
    evaluateRequirement({ requirement, conceptStates, policy }),
  );
  const isBlocked = evaluatedRequirements.some(
    (requirement) => requirement.status === "blocked",
  );
  const satisfiedMasteries = evaluatedRequirements
    .filter((requirement) => requirement.status === "satisfied")
    .map((requirement) => requirement.mastery);
  const unknownCount = evaluatedRequirements.filter(
    (requirement) => requirement.status === "unknown",
  ).length;

  return activityReadinessSchema.parse({
    canAttempt: !isBlocked,
    isBlocked,
    readinessScore: isBlocked
      ? 0
      : round01(
          (satisfiedMasteries.length === 0 ? 1 : average(satisfiedMasteries)) *
            policy.unknownReadinessPenalty ** unknownCount,
        ),
    requirements: evaluatedRequirements.map(
      ({ mastery: _, ...requirement }) => requirement,
    ),
  });
}

function evaluateRequirement(input: {
  requirement: ActivityConceptRequirement;
  conceptStates: ActivityConceptState[];
  policy: KnowledgeInferencePolicyConfig;
}): ActivityReadinessRequirement & { mastery: number } {
  const candidateStates = input.conceptStates.filter(
    (state): state is KnownActivityConceptState =>
      state.conceptId === input.requirement.conceptId &&
      state.mastery !== null &&
      state.confidence >= input.policy.knownConfidenceThreshold,
  );
  const satisfyingStates = candidateStates.filter(
    (state) =>
      capabilitySatisfies(
        state.capability,
        input.requirement.requiredCapability,
      ) && state.mastery >= input.policy.requiredMasteryThreshold,
  );
  const satisfyingState = highestCapabilityState(satisfyingStates);

  if (satisfyingState) {
    return {
      conceptId: input.requirement.conceptId,
      requiredCapability: input.requirement.requiredCapability,
      status: "satisfied",
      satisfiedByCapability: satisfyingState.capability,
      mastery: satisfyingState.mastery,
    };
  }

  if (candidateStates.length > 0) {
    return {
      conceptId: input.requirement.conceptId,
      requiredCapability: input.requirement.requiredCapability,
      status: "blocked",
      satisfiedByCapability: null,
      mastery: 0,
    };
  }

  return {
    conceptId: input.requirement.conceptId,
    requiredCapability: input.requirement.requiredCapability,
    status: "unknown",
    satisfiedByCapability: null,
    mastery: 0,
  };
}

function resolveKnowledgeInferencePolicy(
  policy: Partial<KnowledgeInferencePolicyConfig> | undefined,
): KnowledgeInferencePolicyConfig {
  return knowledgeInferencePolicyConfigSchema.parse({
    ...defaultKnowledgeInferencePolicyConfig,
    ...policy,
  });
}

function uniqueAssumedRequirements(
  requirements: AssumedConceptRequirement[],
): AssumedConceptRequirement[] {
  const uniqueRequirements = new Map<string, AssumedConceptRequirement>();
  for (const requirement of requirements) {
    const parsedRequirement =
      assumedConceptRequirementSchema.parse(requirement);
    uniqueRequirements.set(
      `${parsedRequirement.conceptId}:${parsedRequirement.requiredCapability}`,
      parsedRequirement,
    );
  }
  return [...uniqueRequirements.values()];
}

function isKnownConceptState(
  state: ConceptMasteryState | null | undefined,
): state is KnownConceptMasteryState {
  return state !== null && state !== undefined && state.mastery !== null;
}

function highestKnownProjectionState(
  conceptId: string,
  conceptStates: ConceptMasteryState[],
): KnownConceptMasteryState | null {
  return (
    conceptStates
      .filter(
        (state): state is KnownConceptMasteryState =>
          state.conceptId === conceptId && state.mastery !== null,
      )
      .sort(
        (left, right) =>
          capabilityRankForProjection(right) -
            capabilityRankForProjection(left) ||
          right.confidence - left.confidence ||
          right.mastery - left.mastery,
      )[0] ?? null
  );
}

function capabilityRankForProjection(state: ConceptMasteryState): number {
  return state.capability ? capabilityRank.get(state.capability)! : -1;
}

function capabilitySatisfies(
  demonstratedCapability: (typeof capabilityValues)[number] | undefined,
  requiredCapability: (typeof capabilityValues)[number],
): boolean {
  if (!demonstratedCapability) return false;
  return (
    capabilityRank.get(demonstratedCapability)! >=
    capabilityRank.get(requiredCapability)!
  );
}

function highestCapabilityState(
  states: KnownActivityConceptState[],
): KnownActivityConceptState | null {
  return (
    [...states].sort(
      (left, right) =>
        capabilityRank.get(right.capability)! -
          capabilityRank.get(left.capability)! ||
        right.mastery - left.mastery ||
        right.confidence - left.confidence,
    )[0] ?? null
  );
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round01(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 1_000_000) / 1_000_000;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
