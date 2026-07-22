import { Prisma } from "@luma-lingo/database";

import type { LearnerStateBatch } from "../learning/learner-state-batch.js";

type LearnerStateBatchTransaction = Pick<
  Prisma.TransactionClient,
  "$executeRaw"
>;

export async function writeLearnerStateBatch(
  transaction: LearnerStateBatchTransaction,
  batch: LearnerStateBatch,
): Promise<void> {
  if (batch.competencyStates.length > 0) {
    const values = batch.competencyStates.map(
      (state) => Prisma.sql`(
        ${state.id}::uuid,
        ${state.learningTrackId}::uuid,
        ${state.competencyId}::uuid,
        ${state.abilityEstimate},
        ${state.confidence},
        ${state.evidenceCount},
        ${state.lastEvidenceAt},
        ${JSON.stringify(state.details)}::jsonb,
        CURRENT_TIMESTAMP
      )`,
    );
    await transaction.$executeRaw`
      INSERT INTO "learner_competency_states" AS "current_state" (
        "id",
        "learning_track_id",
        "competency_id",
        "ability_estimate",
        "confidence",
        "evidence_count",
        "last_evidence_at",
        "details",
        "updated_at"
      )
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("learning_track_id", "competency_id") DO UPDATE SET
        "ability_estimate" = EXCLUDED."ability_estimate",
        "confidence" = EXCLUDED."confidence",
        "evidence_count" = "current_state"."evidence_count" + EXCLUDED."evidence_count",
        "last_evidence_at" = EXCLUDED."last_evidence_at",
        "details" = EXCLUDED."details",
        "updated_at" = CURRENT_TIMESTAMP
    `;
  }

  if (batch.conceptStates.length > 0) {
    const values = batch.conceptStates.map(
      (state) => Prisma.sql`(
        ${state.id}::uuid,
        ${state.learningTrackId}::uuid,
        ${state.conceptId}::uuid,
        ${state.capability},
        ${state.mastery},
        ${state.confidence},
        ${state.directEvidenceCount},
        ${state.inferredEvidenceCount},
        ${state.lastEvidenceAt},
        ${JSON.stringify(state.details)}::jsonb,
        CURRENT_TIMESTAMP
      )`,
    );
    await transaction.$executeRaw`
      INSERT INTO "learner_concept_states" AS "current_state" (
        "id",
        "learning_track_id",
        "concept_id",
        "capability",
        "mastery",
        "confidence",
        "direct_evidence_count",
        "inferred_evidence_count",
        "last_evidence_at",
        "details",
        "updated_at"
      )
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("learning_track_id", "concept_id", "capability") DO UPDATE SET
        "mastery" = CASE
          WHEN EXCLUDED."direct_evidence_count" > 0 THEN EXCLUDED."mastery"
          ELSE "current_state"."mastery"
        END,
        "confidence" = CASE
          WHEN EXCLUDED."direct_evidence_count" > 0 THEN EXCLUDED."confidence"
          ELSE "current_state"."confidence"
        END,
        "direct_evidence_count" = "current_state"."direct_evidence_count" + EXCLUDED."direct_evidence_count",
        "inferred_evidence_count" = "current_state"."inferred_evidence_count" + EXCLUDED."inferred_evidence_count",
        "last_evidence_at" = EXCLUDED."last_evidence_at",
        "details" = EXCLUDED."details",
        "updated_at" = CURRENT_TIMESTAMP
    `;
  }
}
