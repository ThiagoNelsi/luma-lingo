-- The legacy question-target table distributed one score across competencies.
-- Diagnostic rows are disposable and were already retired during the catalog cutover.
DELETE FROM "diagnostic_attempt_items";
DELETE FROM "diagnostic_attempts";
DELETE FROM "diagnostic_item_competency_targets";
DELETE FROM "diagnostic_items";

DROP TABLE "diagnostic_item_competency_targets";

ALTER TABLE "diagnostic_items"
  ALTER COLUMN "primary_competency_id" DROP NOT NULL,
  ADD COLUMN "primary_concept_id" UUID,
  ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'reading',
  ADD CONSTRAINT "diagnostic_items_exactly_one_primary_target_check"
    CHECK (
      ("primary_competency_id" IS NOT NULL AND "primary_concept_id" IS NULL)
      OR ("primary_competency_id" IS NULL AND "primary_concept_id" IS NOT NULL)
    ),
  ADD CONSTRAINT "diagnostic_items_mode_check"
    CHECK ("mode" IN ('reading', 'writing', 'listening', 'speaking'));

ALTER TABLE "diagnostic_items" ALTER COLUMN "mode" DROP DEFAULT;

CREATE INDEX "diagnostic_items_primary_concept_id_idx"
ON "diagnostic_items"("primary_concept_id");

ALTER TABLE "diagnostic_items"
ADD CONSTRAINT "diagnostic_items_primary_concept_id_fkey"
FOREIGN KEY ("primary_concept_id") REFERENCES "concepts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "diagnostic_item_concept_evidence_mappings" (
  "diagnostic_item_id" UUID NOT NULL,
  "concept_id" UUID NOT NULL,
  "capability" TEXT NOT NULL,
  "strength" INTEGER NOT NULL,

  CONSTRAINT "diagnostic_item_concept_evidence_mappings_pkey"
    PRIMARY KEY ("diagnostic_item_id", "concept_id", "capability"),
  CONSTRAINT "diagnostic_item_concept_evidence_mappings_capability_check"
    CHECK ("capability" IN ('recognition', 'controlled_production', 'contextualized_use', 'independent_use')),
  CONSTRAINT "diagnostic_item_concept_evidence_mappings_strength_check"
    CHECK ("strength" >= 1 AND "strength" <= 100)
);

CREATE INDEX "diagnostic_item_concept_evidence_mappings_concept_id_capability_idx"
ON "diagnostic_item_concept_evidence_mappings"("concept_id", "capability");

ALTER TABLE "diagnostic_item_concept_evidence_mappings"
ADD CONSTRAINT "diagnostic_item_concept_evidence_mappings_diagnostic_item_id_fkey"
FOREIGN KEY ("diagnostic_item_id") REFERENCES "diagnostic_items"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "diagnostic_item_concept_evidence_mappings"
ADD CONSTRAINT "diagnostic_item_concept_evidence_mappings_concept_id_fkey"
FOREIGN KEY ("concept_id") REFERENCES "concepts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "learner_concept_states" (
  "id" UUID NOT NULL,
  "learning_track_id" UUID NOT NULL,
  "concept_id" UUID NOT NULL,
  "capability" TEXT NOT NULL,
  "mastery" DOUBLE PRECISION,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "direct_evidence_count" INTEGER NOT NULL DEFAULT 0,
  "inferred_evidence_count" INTEGER NOT NULL DEFAULT 0,
  "last_evidence_at" TIMESTAMPTZ(6),
  "details" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "learner_concept_states_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "learner_concept_states_capability_check"
    CHECK ("capability" IN ('recognition', 'controlled_production', 'contextualized_use', 'independent_use')),
  CONSTRAINT "learner_concept_states_mastery_check"
    CHECK ("mastery" IS NULL OR ("mastery" >= 0 AND "mastery" <= 1)),
  CONSTRAINT "learner_concept_states_confidence_check"
    CHECK ("confidence" >= 0 AND "confidence" <= 1),
  CONSTRAINT "learner_concept_states_evidence_counts_check"
    CHECK ("direct_evidence_count" >= 0 AND "inferred_evidence_count" >= 0)
);

CREATE UNIQUE INDEX "learner_concept_states_learning_track_id_concept_id_capability_key"
ON "learner_concept_states"("learning_track_id", "concept_id", "capability");

CREATE INDEX "learner_concept_states_concept_id_capability_idx"
ON "learner_concept_states"("concept_id", "capability");

ALTER TABLE "learner_concept_states"
ADD CONSTRAINT "learner_concept_states_learning_track_id_fkey"
FOREIGN KEY ("learning_track_id") REFERENCES "learning_tracks"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learner_concept_states"
ADD CONSTRAINT "learner_concept_states_concept_id_fkey"
FOREIGN KEY ("concept_id") REFERENCES "concepts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "concept_evidence" (
  "id" UUID NOT NULL,
  "learning_track_id" UUID NOT NULL,
  "concept_id" UUID NOT NULL,
  "capability" TEXT NOT NULL,
  "evidence_kind" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_id" TEXT,
  "observed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "score" DOUBLE PRECISION,
  "confidence" DOUBLE PRECISION,
  "strength" INTEGER NOT NULL,
  "details" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "concept_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "concept_evidence_capability_check"
    CHECK ("capability" IN ('recognition', 'controlled_production', 'contextualized_use', 'independent_use')),
  CONSTRAINT "concept_evidence_kind_check"
    CHECK ("evidence_kind" IN ('direct', 'inferred')),
  CONSTRAINT "concept_evidence_score_check"
    CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 1)),
  CONSTRAINT "concept_evidence_confidence_check"
    CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)),
  CONSTRAINT "concept_evidence_strength_check"
    CHECK ("strength" >= 1 AND "strength" <= 100)
);

CREATE INDEX "concept_evidence_learning_track_id_observed_at_idx"
ON "concept_evidence"("learning_track_id", "observed_at");

CREATE INDEX "concept_evidence_concept_id_capability_idx"
ON "concept_evidence"("concept_id", "capability");

CREATE INDEX "concept_evidence_source_type_source_id_idx"
ON "concept_evidence"("source_type", "source_id");

ALTER TABLE "concept_evidence"
ADD CONSTRAINT "concept_evidence_learning_track_id_fkey"
FOREIGN KEY ("learning_track_id") REFERENCES "learning_tracks"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "concept_evidence"
ADD CONSTRAINT "concept_evidence_concept_id_fkey"
FOREIGN KEY ("concept_id") REFERENCES "concepts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "reject_concept_evidence_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'concept_evidence is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "concept_evidence_append_only"
BEFORE UPDATE OR DELETE ON "concept_evidence"
FOR EACH ROW EXECUTE FUNCTION "reject_concept_evidence_mutation"();
