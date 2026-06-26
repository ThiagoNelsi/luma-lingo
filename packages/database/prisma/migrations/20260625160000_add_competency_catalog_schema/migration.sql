-- CreateTable
CREATE TABLE "competency_catalogs" (
    "id" UUID NOT NULL,
    "target_language" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ(6),
    "source_checksum" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "competency_catalogs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "learning_tracks"
ADD COLUMN "competency_catalog_id" UUID;

-- CreateTable
CREATE TABLE "competencies" (
    "id" UUID NOT NULL,
    "catalog_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "family" TEXT NOT NULL,
    "mode" TEXT,
    "difficulty_band" TEXT,
    "is_core" BOOLEAN NOT NULL DEFAULT false,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_prerequisites" (
    "competency_id" UUID NOT NULL,
    "prerequisite_id" UUID NOT NULL,
    "strength" INTEGER,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_prerequisites_pkey" PRIMARY KEY ("competency_id", "prerequisite_id"),
    CONSTRAINT "competency_prerequisites_not_self_check" CHECK ("competency_id" <> "prerequisite_id"),
    CONSTRAINT "competency_prerequisites_strength_check" CHECK ("strength" IS NULL OR ("strength" >= 0 AND "strength" <= 100))
);

-- CreateTable
CREATE TABLE "competency_goal_priorities" (
    "id" UUID NOT NULL,
    "competency_id" UUID NOT NULL,
    "goal" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "competency_goal_priorities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "competency_goal_priorities_priority_check" CHECK ("priority" >= 0 AND "priority" <= 100)
);

-- CreateTable
CREATE TABLE "diagnostic_items" (
    "id" UUID NOT NULL,
    "catalog_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "primary_competency_id" UUID NOT NULL,
    "difficulty_band" TEXT NOT NULL,
    "response_format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "prompt" JSONB NOT NULL,
    "scoring_rule" JSONB NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "reviewed_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "diagnostic_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_item_competency_targets" (
    "diagnostic_item_id" UUID NOT NULL,
    "competency_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "weight" INTEGER,
    "details" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "diagnostic_item_competency_targets_pkey" PRIMARY KEY ("diagnostic_item_id", "competency_id"),
    CONSTRAINT "diagnostic_item_competency_targets_weight_check" CHECK ("weight" IS NULL OR ("weight" >= 0 AND "weight" <= 100))
);

-- CreateTable
CREATE TABLE "learner_competency_states" (
    "id" UUID NOT NULL,
    "learning_track_id" UUID NOT NULL,
    "competency_id" UUID NOT NULL,
    "ability_estimate" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidence_count" INTEGER NOT NULL DEFAULT 0,
    "last_evidence_at" TIMESTAMPTZ(6),
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "learner_competency_states_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "learner_competency_states_ability_estimate_check" CHECK ("ability_estimate" IS NULL OR ("ability_estimate" >= 0 AND "ability_estimate" <= 1)),
    CONSTRAINT "learner_competency_states_confidence_check" CHECK ("confidence" >= 0 AND "confidence" <= 1),
    CONSTRAINT "learner_competency_states_evidence_count_check" CHECK ("evidence_count" >= 0)
);

-- CreateTable
CREATE TABLE "competency_evidence" (
    "id" UUID NOT NULL,
    "learning_track_id" UUID NOT NULL,
    "competency_id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "observed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_evidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "competency_evidence_score_check" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 1)),
    CONSTRAINT "competency_evidence_confidence_check" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1))
);

-- CreateIndex
CREATE UNIQUE INDEX "competency_catalogs_target_language_version_key" ON "competency_catalogs"("target_language", "version");

-- CreateIndex
CREATE INDEX "competency_catalogs_target_language_status_idx" ON "competency_catalogs"("target_language", "status");

-- CreateIndex
CREATE INDEX "learning_tracks_competency_catalog_id_idx" ON "learning_tracks"("competency_catalog_id");

-- CreateIndex
CREATE UNIQUE INDEX "competencies_catalog_id_key_key" ON "competencies"("catalog_id", "key");

-- CreateIndex
CREATE INDEX "competencies_catalog_id_family_idx" ON "competencies"("catalog_id", "family");

-- CreateIndex
CREATE INDEX "competencies_catalog_id_difficulty_band_idx" ON "competencies"("catalog_id", "difficulty_band");

-- CreateIndex
CREATE INDEX "competency_prerequisites_prerequisite_id_idx" ON "competency_prerequisites"("prerequisite_id");

-- CreateIndex
CREATE UNIQUE INDEX "competency_goal_priorities_competency_id_goal_key" ON "competency_goal_priorities"("competency_id", "goal");

-- CreateIndex
CREATE INDEX "competency_goal_priorities_goal_priority_idx" ON "competency_goal_priorities"("goal", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_items_catalog_id_key_key" ON "diagnostic_items"("catalog_id", "key");

-- CreateIndex
CREATE INDEX "diagnostic_items_catalog_id_status_difficulty_band_idx" ON "diagnostic_items"("catalog_id", "status", "difficulty_band");

-- CreateIndex
CREATE INDEX "diagnostic_items_primary_competency_id_idx" ON "diagnostic_items"("primary_competency_id");

-- CreateIndex
CREATE INDEX "diagnostic_item_competency_targets_competency_id_idx" ON "diagnostic_item_competency_targets"("competency_id");

-- CreateIndex
CREATE UNIQUE INDEX "learner_competency_states_learning_track_id_competency_id_key" ON "learner_competency_states"("learning_track_id", "competency_id");

-- CreateIndex
CREATE INDEX "learner_competency_states_competency_id_idx" ON "learner_competency_states"("competency_id");

-- CreateIndex
CREATE INDEX "competency_evidence_learning_track_id_observed_at_idx" ON "competency_evidence"("learning_track_id", "observed_at");

-- CreateIndex
CREATE INDEX "competency_evidence_competency_id_idx" ON "competency_evidence"("competency_id");

-- CreateIndex
CREATE INDEX "competency_evidence_source_type_source_id_idx" ON "competency_evidence"("source_type", "source_id");

-- AddForeignKey
ALTER TABLE "learning_tracks" ADD CONSTRAINT "learning_tracks_competency_catalog_id_fkey" FOREIGN KEY ("competency_catalog_id") REFERENCES "competency_catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "competency_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_prerequisites" ADD CONSTRAINT "competency_prerequisites_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_prerequisites" ADD CONSTRAINT "competency_prerequisites_prerequisite_id_fkey" FOREIGN KEY ("prerequisite_id") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_goal_priorities" ADD CONSTRAINT "competency_goal_priorities_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_items" ADD CONSTRAINT "diagnostic_items_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "competency_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_items" ADD CONSTRAINT "diagnostic_items_primary_competency_id_fkey" FOREIGN KEY ("primary_competency_id") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_item_competency_targets" ADD CONSTRAINT "diagnostic_item_competency_targets_diagnostic_item_id_fkey" FOREIGN KEY ("diagnostic_item_id") REFERENCES "diagnostic_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_item_competency_targets" ADD CONSTRAINT "diagnostic_item_competency_targets_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_competency_states" ADD CONSTRAINT "learner_competency_states_learning_track_id_fkey" FOREIGN KEY ("learning_track_id") REFERENCES "learning_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_competency_states" ADD CONSTRAINT "learner_competency_states_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_evidence" ADD CONSTRAINT "competency_evidence_learning_track_id_fkey" FOREIGN KEY ("learning_track_id") REFERENCES "learning_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_evidence" ADD CONSTRAINT "competency_evidence_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
