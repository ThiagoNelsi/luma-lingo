CREATE TABLE "pedagogical_policies" (
  "id" UUID NOT NULL,
  "catalog_id" UUID NOT NULL,
  "source_policy_id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "source_checksum" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "pedagogical_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pedagogical_policies_catalog_id_version_key"
ON "pedagogical_policies"("catalog_id", "version");

CREATE INDEX "pedagogical_policies_catalog_id_idx"
ON "pedagogical_policies"("catalog_id");

ALTER TABLE "pedagogical_policies"
ADD CONSTRAINT "pedagogical_policies_catalog_id_fkey"
FOREIGN KEY ("catalog_id") REFERENCES "competency_catalogs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "pedagogical_competency_weights" (
  "policy_id" UUID NOT NULL,
  "competency_id" UUID NOT NULL,
  "base_priority" INTEGER,
  "foundation_weight" INTEGER,

  CONSTRAINT "pedagogical_competency_weights_pkey"
    PRIMARY KEY ("policy_id", "competency_id"),
  CONSTRAINT "pedagogical_competency_weights_value_check"
    CHECK (
      ("base_priority" IS NULL OR ("base_priority" >= 0 AND "base_priority" <= 100))
      AND ("foundation_weight" IS NULL OR ("foundation_weight" >= 0 AND "foundation_weight" <= 100))
      AND ("base_priority" IS NOT NULL OR "foundation_weight" IS NOT NULL)
    )
);

CREATE INDEX "pedagogical_competency_weights_competency_id_idx"
ON "pedagogical_competency_weights"("competency_id");

ALTER TABLE "pedagogical_competency_weights"
ADD CONSTRAINT "pedagogical_competency_weights_policy_id_fkey"
FOREIGN KEY ("policy_id") REFERENCES "pedagogical_policies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pedagogical_competency_weights"
ADD CONSTRAINT "pedagogical_competency_weights_competency_id_fkey"
FOREIGN KEY ("competency_id") REFERENCES "competencies"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "pedagogical_competency_goal_weights" (
  "policy_id" UUID NOT NULL,
  "competency_id" UUID NOT NULL,
  "goal" TEXT NOT NULL,
  "weight" INTEGER NOT NULL,

  CONSTRAINT "pedagogical_competency_goal_weights_pkey"
    PRIMARY KEY ("policy_id", "competency_id", "goal"),
  CONSTRAINT "pedagogical_competency_goal_weights_goal_check"
    CHECK ("goal" IN ('everyday_conversation', 'work', 'travel', 'exam_prep', 'cefr_level')),
  CONSTRAINT "pedagogical_competency_goal_weights_weight_check"
    CHECK ("weight" >= 0 AND "weight" <= 100)
);

CREATE INDEX "pedagogical_competency_goal_weights_competency_id_goal_idx"
ON "pedagogical_competency_goal_weights"("competency_id", "goal");

ALTER TABLE "pedagogical_competency_goal_weights"
ADD CONSTRAINT "pedagogical_competency_goal_weights_policy_id_fkey"
FOREIGN KEY ("policy_id") REFERENCES "pedagogical_policies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pedagogical_competency_goal_weights"
ADD CONSTRAINT "pedagogical_competency_goal_weights_competency_id_fkey"
FOREIGN KEY ("competency_id") REFERENCES "competencies"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "pedagogical_concept_goal_weights" (
  "policy_id" UUID NOT NULL,
  "concept_id" UUID NOT NULL,
  "goal" TEXT NOT NULL,
  "weight" INTEGER NOT NULL,

  CONSTRAINT "pedagogical_concept_goal_weights_pkey"
    PRIMARY KEY ("policy_id", "concept_id", "goal"),
  CONSTRAINT "pedagogical_concept_goal_weights_goal_check"
    CHECK ("goal" IN ('everyday_conversation', 'work', 'travel', 'exam_prep', 'cefr_level')),
  CONSTRAINT "pedagogical_concept_goal_weights_weight_check"
    CHECK ("weight" >= 0 AND "weight" <= 100)
);

CREATE INDEX "pedagogical_concept_goal_weights_concept_id_goal_idx"
ON "pedagogical_concept_goal_weights"("concept_id", "goal");

ALTER TABLE "pedagogical_concept_goal_weights"
ADD CONSTRAINT "pedagogical_concept_goal_weights_policy_id_fkey"
FOREIGN KEY ("policy_id") REFERENCES "pedagogical_policies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pedagogical_concept_goal_weights"
ADD CONSTRAINT "pedagogical_concept_goal_weights_concept_id_fkey"
FOREIGN KEY ("concept_id") REFERENCES "concepts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
