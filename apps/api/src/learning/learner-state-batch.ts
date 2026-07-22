import { createId } from "@luma-lingo/database";
import { capabilityValues } from "@luma-lingo/shared";
import { z } from "zod";

import { learnerCompetencyStateDetailsSchemaVersion } from "../diagnostics/diagnostic-attempt.js";
import { knowledgeInferencePolicyVersion } from "./knowledge-inference.js";

type CompetencyEvidenceForState = {
  learningTrackId: string;
  competencyId: string;
  sourceType: string;
  observedAt: Date;
  score: number;
  confidence: number;
};

type ConceptEvidenceForState = {
  learningTrackId: string;
  conceptId: string;
  capability: string;
  evidenceKind: string;
  sourceType: string;
  observedAt: Date;
  score: number;
  confidence: number;
};

const learnerStateDetailsSchema = z.record(z.string(), z.unknown());
const learnerCapabilitySchema = z.enum(capabilityValues);
const conceptEvidenceKindSchema = z.enum(["direct", "inferred"]);

export const learnerCompetencyStateBatchRowSchema = z.object({
  id: z.string(),
  learningTrackId: z.string(),
  competencyId: z.string(),
  abilityEstimate: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  evidenceCount: z.number().int().nonnegative(),
  lastEvidenceAt: z.date(),
  details: learnerStateDetailsSchema,
});

export type LearnerCompetencyStateBatchRow = z.infer<
  typeof learnerCompetencyStateBatchRowSchema
>;

export const learnerConceptStateBatchRowSchema = z.object({
  id: z.string(),
  learningTrackId: z.string(),
  conceptId: z.string(),
  capability: learnerCapabilitySchema,
  mastery: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  directEvidenceCount: z.number().int().nonnegative(),
  inferredEvidenceCount: z.number().int().nonnegative(),
  lastEvidenceAt: z.date(),
  details: learnerStateDetailsSchema,
});

export type LearnerConceptStateBatchRow = z.infer<
  typeof learnerConceptStateBatchRowSchema
>;

export const learnerStateBatchSchema = z.object({
  competencyStates: z.array(learnerCompetencyStateBatchRowSchema),
  conceptStates: z.array(learnerConceptStateBatchRowSchema),
});

export type LearnerStateBatch = z.infer<typeof learnerStateBatchSchema>;

export function buildLearnerStateBatch(input: {
  scoringPolicyVersion: string;
  competencyEvidence: readonly CompetencyEvidenceForState[];
  conceptEvidence: readonly ConceptEvidenceForState[];
}): LearnerStateBatch {
  const competencyStatesByKey = new Map<
    string,
    LearnerCompetencyStateBatchRow
  >();
  const conceptStatesByKey = new Map<string, LearnerConceptStateBatchRow>();

  for (const evidence of input.competencyEvidence) {
    const key = `${evidence.learningTrackId}:${evidence.competencyId}`;
    const existingState = competencyStatesByKey.get(key);
    competencyStatesByKey.set(key, {
      id: existingState?.id ?? createId(),
      learningTrackId: evidence.learningTrackId,
      competencyId: evidence.competencyId,
      abilityEstimate: evidence.score,
      confidence: evidence.confidence,
      evidenceCount: (existingState?.evidenceCount ?? 0) + 1,
      lastEvidenceAt: evidence.observedAt,
      details: {
        schemaVersion: learnerCompetencyStateDetailsSchemaVersion,
        lastUpdateReason: evidence.sourceType,
        scoringPolicyVersion: input.scoringPolicyVersion,
      },
    });
  }

  for (const evidence of input.conceptEvidence) {
    const capability = learnerCapabilitySchema.parse(evidence.capability);
    const evidenceKind = conceptEvidenceKindSchema.parse(evidence.evidenceKind);
    const key = `${evidence.learningTrackId}:${evidence.conceptId}:${capability}`;
    const existingState = conceptStatesByKey.get(key);
    const isDirectEvidence = evidenceKind === "direct";
    const shouldReplaceMastery = !existingState || isDirectEvidence;

    conceptStatesByKey.set(key, {
      id: existingState?.id ?? createId(),
      learningTrackId: evidence.learningTrackId,
      conceptId: evidence.conceptId,
      capability,
      mastery: shouldReplaceMastery ? evidence.score : existingState.mastery,
      confidence: shouldReplaceMastery
        ? evidence.confidence
        : existingState.confidence,
      directEvidenceCount:
        (existingState?.directEvidenceCount ?? 0) + (isDirectEvidence ? 1 : 0),
      inferredEvidenceCount:
        (existingState?.inferredEvidenceCount ?? 0) +
        (isDirectEvidence ? 0 : 1),
      lastEvidenceAt: evidence.observedAt,
      details: {
        schemaVersion: learnerCompetencyStateDetailsSchemaVersion,
        lastUpdateReason: isDirectEvidence
          ? evidence.sourceType
          : knowledgeInferencePolicyVersion,
        scoringPolicyVersion: input.scoringPolicyVersion,
      },
    });
  }

  return {
    competencyStates: [...competencyStatesByKey.values()],
    conceptStates: [...conceptStatesByKey.values()],
  };
}
