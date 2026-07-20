-- The authorial catalog uses different identities and semantics. The development
-- catalog, diagnostic, and competency evidence rows are intentionally disposable.
DELETE FROM "diagnostic_attempt_items";
DELETE FROM "diagnostic_attempts";
DELETE FROM "competency_evidence";
DELETE FROM "learner_competency_states";
DELETE FROM "diagnostic_item_competency_targets";
DELETE FROM "diagnostic_items";
UPDATE "learning_tracks" SET "competency_catalog_id" = NULL;
DELETE FROM "competency_prerequisites";
DELETE FROM "competency_goal_priorities";
DELETE FROM "competencies";
DELETE FROM "competency_catalogs";

DROP TABLE "competency_prerequisites";
DROP TABLE "competency_goal_priorities";

ALTER TABLE "competencies"
DROP COLUMN "mode",
DROP COLUMN "is_core",
ADD COLUMN "taxonomy_id" TEXT NOT NULL,
ADD COLUMN "estimated_difficulty_score" DOUBLE PRECISION,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft',
ADD CONSTRAINT "competencies_estimated_difficulty_score_check"
  CHECK (
    "estimated_difficulty_score" IS NULL
    OR ("estimated_difficulty_score" >= 0 AND "estimated_difficulty_score" <= 100)
  );

CREATE TABLE "concepts" (
  "id" UUID NOT NULL,
  "target_language" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'draft',
  "replaced_by_concept_id" UUID,
  "details" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "concepts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "concepts_replacement_not_self_check"
    CHECK ("replaced_by_concept_id" IS NULL OR "replaced_by_concept_id" <> "id")
);

CREATE TABLE "competency_concepts" (
  "competency_id" UUID NOT NULL,
  "concept_id" UUID NOT NULL,
  "role" TEXT NOT NULL,
  "required_capability" TEXT,
  "details" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "competency_concepts_pkey" PRIMARY KEY ("competency_id", "concept_id"),
  CONSTRAINT "competency_concepts_role_check"
    CHECK ("role" IN ('component', 'assumed', 'supporting')),
  CONSTRAINT "competency_concepts_capability_check"
    CHECK (
      "required_capability" IS NULL
      OR "required_capability" IN (
        'recognition',
        'controlled_production',
        'contextualized_use',
        'independent_use'
      )
    ),
  CONSTRAINT "competency_concepts_assumed_capability_check"
    CHECK (
      ("role" = 'assumed' AND "required_capability" IS NOT NULL)
      OR ("role" IN ('component', 'supporting') AND "required_capability" IS NULL)
    )
);

CREATE UNIQUE INDEX "concepts_target_language_key_key"
ON "concepts"("target_language", "key");

CREATE INDEX "concepts_target_language_status_idx"
ON "concepts"("target_language", "status");

CREATE INDEX "concepts_replaced_by_concept_id_idx"
ON "concepts"("replaced_by_concept_id");

CREATE INDEX "competencies_catalog_id_taxonomy_id_idx"
ON "competencies"("catalog_id", "taxonomy_id");

CREATE INDEX "competencies_catalog_id_status_idx"
ON "competencies"("catalog_id", "status");

CREATE INDEX "competency_concepts_concept_id_role_idx"
ON "competency_concepts"("concept_id", "role");

CREATE INDEX "competency_concepts_role_required_capability_idx"
ON "competency_concepts"("role", "required_capability");

ALTER TABLE "concepts"
ADD CONSTRAINT "concepts_replaced_by_concept_id_fkey"
FOREIGN KEY ("replaced_by_concept_id") REFERENCES "concepts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "competency_concepts"
ADD CONSTRAINT "competency_concepts_competency_id_fkey"
FOREIGN KEY ("competency_id") REFERENCES "competencies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "competency_concepts"
ADD CONSTRAINT "competency_concepts_concept_id_fkey"
FOREIGN KEY ("concept_id") REFERENCES "concepts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
