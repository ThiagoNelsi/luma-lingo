import type { Goal, PedagogicalRankingConfig } from "@luma-lingo/shared";
import { z } from "zod";

import {
  evaluateActivityReadiness,
  resolveCompetencyMastery,
  type ActivityConceptState,
  type AssumedConceptRequirement,
  type ConceptMasteryState,
} from "./knowledge-inference.js";

export const defaultInitialLearningPriorityRanking: PedagogicalRankingConfig = {
  readiness: 100,
  foundation: 30,
  basePriority: 20,
  goalFit: 25,
  knowledgeGap: 40,
  uncertainty: 15,
  reviewNeed: 10,
  recentRepetition: 20,
  recentRepetitionWindowDays: 7,
};

export type InitialLearningPriorityPolicy = {
  version: string;
  competencyWeights: readonly {
    competencyId: string;
    basePriority?: number;
    foundationWeight?: number;
  }[];
  competencyGoalWeights: readonly {
    competencyId: string;
    goal: Goal;
    weight: number;
  }[];
  conceptGoalWeights: readonly {
    conceptId: string;
    goal: Goal;
    weight: number;
  }[];
  ranking?: PedagogicalRankingConfig;
};

export const initialLearningPrioritySchema = z.object({
  competencyId: z.string(),
  competencyKey: z.string(),
  score: z.number(),
  readiness: z.number().min(0).max(1),
  foundationWeight: z.number().int().min(0).max(100),
  basePriority: z.number().int().min(0).max(100),
  goalFit: z.number().min(0).max(100),
  knowledgeGap: z.number().min(0).max(1),
  uncertainty: z.number().min(0).max(1),
  reviewNeed: z.number().min(0).max(1),
  recentRepetition: z.number().int().min(0).max(1),
  selectionReason: z.enum([
    "beginner_pre_a1_foundation",
    "beginner_a1_fallback",
    "diagnostic_ranking",
  ]),
});
export type InitialLearningPriority = z.infer<
  typeof initialLearningPrioritySchema
>;

type PriorityCompetency = {
  id: string;
  key: string;
  difficultyBand: string | null;
  componentConceptIds: string[];
  assumedConcepts: AssumedConceptRequirement[];
};

type PriorityConceptState = ActivityConceptState & {
  lastEvidenceAt: Date | null;
};

type PriorityCompetencyState = {
  competencyId: string;
  abilityEstimate: number | null;
  confidence: number;
  lastEvidenceAt: Date | null;
};

export function rankInitialLearningPriorities(input: {
  onboardingStartingPoint: "beginner" | "diagnostic";
  primaryGoal: Goal;
  additionalGoals: Goal[];
  policy: InitialLearningPriorityPolicy;
  competencies: PriorityCompetency[];
  conceptStates: PriorityConceptState[];
  competencyStates: PriorityCompetencyState[];
  now: Date;
}): InitialLearningPriority[] {
  const ranking = {
    ...defaultInitialLearningPriorityRanking,
    ...input.policy.ranking,
  };
  const policyIndexes = indexPolicy(input.policy);
  const eligibleCandidates = input.competencies.filter(
    (competency) =>
      evaluateActivityReadiness({
        requirements: competency.assumedConcepts,
        conceptStates: input.conceptStates,
      }).canAttempt,
  );
  const { candidates, selectionReason } = selectCandidates({
    onboardingStartingPoint: input.onboardingStartingPoint,
    candidates: eligibleCandidates,
    foundationWeightByCompetencyId:
      policyIndexes.foundationWeightByCompetencyId,
  });

  return candidates
    .map((competency) =>
      scoreCandidate({
        competency,
        primaryGoal: input.primaryGoal,
        additionalGoals: input.additionalGoals,
        indexes: policyIndexes,
        ranking,
        conceptStates: input.conceptStates,
        competencyStates: input.competencyStates,
        now: input.now,
        selectionReason,
      }),
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.competencyKey.localeCompare(right.competencyKey) ||
        left.competencyId.localeCompare(right.competencyId),
    );
}

function selectCandidates(input: {
  onboardingStartingPoint: "beginner" | "diagnostic";
  candidates: PriorityCompetency[];
  foundationWeightByCompetencyId: Map<string, number>;
}): {
  candidates: PriorityCompetency[];
  selectionReason: InitialLearningPriority["selectionReason"];
} {
  if (input.onboardingStartingPoint === "diagnostic") {
    return {
      candidates: input.candidates,
      selectionReason: "diagnostic_ranking",
    };
  }

  const preA1Foundations = input.candidates.filter(
    (competency) =>
      normalizeDifficultyBand(competency.difficultyBand) === "pre_a1" &&
      (input.foundationWeightByCompetencyId.get(competency.id) ?? 0) > 0,
  );
  if (preA1Foundations.length > 0) {
    return {
      candidates: preA1Foundations,
      selectionReason: "beginner_pre_a1_foundation",
    };
  }

  return {
    candidates: input.candidates.filter(
      (competency) =>
        normalizeDifficultyBand(competency.difficultyBand) === "a1" &&
        (input.foundationWeightByCompetencyId.get(competency.id) ?? 0) > 0,
    ),
    selectionReason: "beginner_a1_fallback",
  };
}

function scoreCandidate(input: {
  competency: PriorityCompetency;
  primaryGoal: Goal;
  additionalGoals: Goal[];
  indexes: PolicyIndexes;
  ranking: PedagogicalRankingConfig;
  conceptStates: PriorityConceptState[];
  competencyStates: PriorityCompetencyState[];
  now: Date;
  selectionReason: InitialLearningPriority["selectionReason"];
}): InitialLearningPriority {
  const readiness = evaluateActivityReadiness({
    requirements: input.competency.assumedConcepts,
    conceptStates: input.conceptStates,
  }).readinessScore;
  const mastery = resolveCompetencyMastery({
    componentConceptIds: input.competency.componentConceptIds,
    conceptStates: input.conceptStates,
    directIntegratedState: directStateForCompetency(
      input.competency.id,
      input.competencyStates,
    ),
  });
  const masteryValue =
    mastery.kind === "projection" ? mastery.projectedMastery : mastery.mastery;
  const confidence =
    mastery.kind === "projection"
      ? mastery.projectedConfidence
      : mastery.confidence;
  const knowledgeGap = masteryValue === null ? 1 : 1 - masteryValue;
  const uncertainty = 1 - confidence;
  const latestEvidenceAt = latestEvidenceForCompetency(
    input.competency,
    input.conceptStates,
    input.competencyStates,
  );
  const evidenceAgeDays = latestEvidenceAt
    ? Math.max(
        0,
        (input.now.getTime() - latestEvidenceAt.getTime()) / 86_400_000,
      )
    : null;
  const reviewNeed =
    evidenceAgeDays === null ? 0 : Math.min(1, evidenceAgeDays / 30);
  const recentRepetition =
    evidenceAgeDays !== null &&
    evidenceAgeDays <= input.ranking.recentRepetitionWindowDays
      ? 1
      : 0;
  const foundationWeight =
    input.indexes.foundationWeightByCompetencyId.get(input.competency.id) ?? 0;
  const basePriority =
    input.indexes.basePriorityByCompetencyId.get(input.competency.id) ?? 0;
  const goalFit = goalFitForCompetency({
    competency: input.competency,
    primaryGoal: input.primaryGoal,
    additionalGoals: input.additionalGoals,
    indexes: input.indexes,
  });
  const score =
    readiness * input.ranking.readiness +
    (foundationWeight / 100) * input.ranking.foundation +
    (basePriority / 100) * input.ranking.basePriority +
    (goalFit / 100) * input.ranking.goalFit +
    knowledgeGap * input.ranking.knowledgeGap +
    uncertainty * input.ranking.uncertainty +
    reviewNeed * input.ranking.reviewNeed -
    recentRepetition * input.ranking.recentRepetition;

  return {
    competencyId: input.competency.id,
    competencyKey: input.competency.key,
    score: round(score),
    readiness: round(readiness),
    foundationWeight,
    basePriority,
    goalFit,
    knowledgeGap: round(knowledgeGap),
    uncertainty: round(uncertainty),
    reviewNeed: round(reviewNeed),
    recentRepetition,
    selectionReason: input.selectionReason,
  };
}

type PolicyIndexes = {
  basePriorityByCompetencyId: Map<string, number>;
  foundationWeightByCompetencyId: Map<string, number>;
  competencyGoalWeightByKey: Map<string, number>;
  conceptGoalWeightByKey: Map<string, number>;
};

function indexPolicy(policy: InitialLearningPriorityPolicy): PolicyIndexes {
  return {
    basePriorityByCompetencyId: new Map(
      policy.competencyWeights
        .filter((weight) => weight.basePriority !== undefined)
        .map((weight) => [weight.competencyId, weight.basePriority!]),
    ),
    foundationWeightByCompetencyId: new Map(
      policy.competencyWeights
        .filter((weight) => weight.foundationWeight !== undefined)
        .map((weight) => [weight.competencyId, weight.foundationWeight!]),
    ),
    competencyGoalWeightByKey: new Map(
      policy.competencyGoalWeights.map((weight) => [
        `${weight.competencyId}:${weight.goal}`,
        weight.weight,
      ]),
    ),
    conceptGoalWeightByKey: new Map(
      policy.conceptGoalWeights.map((weight) => [
        `${weight.conceptId}:${weight.goal}`,
        weight.weight,
      ]),
    ),
  };
}

function goalFitForCompetency(input: {
  competency: PriorityCompetency;
  primaryGoal: Goal;
  additionalGoals: Goal[];
  indexes: PolicyIndexes;
}): number {
  const primaryFit = relevanceForGoal(
    input.competency,
    input.primaryGoal,
    input.indexes,
  );
  const additionalFit = Math.max(
    0,
    ...input.additionalGoals.map(
      (goal) => relevanceForGoal(input.competency, goal, input.indexes) * 0.5,
    ),
  );

  return Math.max(primaryFit, additionalFit);
}

function relevanceForGoal(
  competency: PriorityCompetency,
  goal: Goal,
  indexes: PolicyIndexes,
): number {
  const explicitKey = `${competency.id}:${goal}`;
  const explicitWeight = indexes.competencyGoalWeightByKey.get(explicitKey);
  if (explicitWeight !== undefined) return explicitWeight;

  const componentWeights = competency.componentConceptIds.map(
    (conceptId) =>
      indexes.conceptGoalWeightByKey.get(`${conceptId}:${goal}`) ?? 0,
  );
  if (componentWeights.length === 0) return 0;

  const maximum = Math.max(...componentWeights);
  const average =
    componentWeights.reduce((total, weight) => total + weight, 0) /
    componentWeights.length;
  return round(0.7 * maximum + 0.3 * average);
}

function directStateForCompetency(
  competencyId: string,
  states: PriorityCompetencyState[],
) {
  const state = states.find(
    (candidate) => candidate.competencyId === competencyId,
  );
  return state
    ? { mastery: state.abilityEstimate, confidence: state.confidence }
    : undefined;
}

function latestEvidenceForCompetency(
  competency: PriorityCompetency,
  conceptStates: PriorityConceptState[],
  competencyStates: PriorityCompetencyState[],
): Date | null {
  const dates = [
    competencyStates.find((state) => state.competencyId === competency.id)
      ?.lastEvidenceAt,
    ...conceptStates
      .filter((state) =>
        competency.componentConceptIds.includes(state.conceptId),
      )
      .map((state) => state.lastEvidenceAt),
  ].filter((date): date is Date => date !== null && date !== undefined);
  return (
    dates.sort((left, right) => right.getTime() - left.getTime())[0] ?? null
  );
}

function normalizeDifficultyBand(value: string | null): string {
  return value?.toLowerCase().replace("-", "_") ?? "";
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
