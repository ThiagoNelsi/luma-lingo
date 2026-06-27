-- CreateTable
CREATE TABLE "diagnostic_attempts" (
    "id" UUID NOT NULL,
    "learning_track_id" UUID NOT NULL,
    "catalog_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "selection_policy_version" TEXT NOT NULL,
    "scoring_policy_version" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "abandoned_at" TIMESTAMPTZ(6),
    "summary" JSONB NOT NULL DEFAULT '{}',
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "diagnostic_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_attempt_items" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "diagnostic_item_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "selected_for_role" TEXT NOT NULL,
    "selection_rule" TEXT NOT NULL,
    "selection_trace" JSONB NOT NULL DEFAULT '{}',
    "response" JSONB,
    "score" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "shown_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answered_at" TIMESTAMPTZ(6),
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "diagnostic_attempt_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "diagnostic_attempt_items_position_check" CHECK ("position" > 0),
    CONSTRAINT "diagnostic_attempt_items_score_check" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 1)),
    CONSTRAINT "diagnostic_attempt_items_confidence_check" CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1))
);

-- CreateIndex
CREATE INDEX "diagnostic_attempts_learning_track_id_status_idx" ON "diagnostic_attempts"("learning_track_id", "status");

-- CreateIndex
CREATE INDEX "diagnostic_attempts_learning_track_id_purpose_status_idx" ON "diagnostic_attempts"("learning_track_id", "purpose", "status");

-- CreateIndex
CREATE INDEX "diagnostic_attempts_catalog_id_idx" ON "diagnostic_attempts"("catalog_id");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_attempt_items_attempt_id_position_key" ON "diagnostic_attempt_items"("attempt_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_attempt_items_attempt_id_diagnostic_item_id_key" ON "diagnostic_attempt_items"("attempt_id", "diagnostic_item_id");

-- CreateIndex
CREATE INDEX "diagnostic_attempt_items_diagnostic_item_id_idx" ON "diagnostic_attempt_items"("diagnostic_item_id");

-- CreateIndex
CREATE INDEX "diagnostic_attempt_items_selected_for_role_idx" ON "diagnostic_attempt_items"("selected_for_role");

-- CreateIndex
CREATE INDEX "diagnostic_attempt_items_selection_rule_idx" ON "diagnostic_attempt_items"("selection_rule");

-- AddForeignKey
ALTER TABLE "diagnostic_attempts" ADD CONSTRAINT "diagnostic_attempts_learning_track_id_fkey" FOREIGN KEY ("learning_track_id") REFERENCES "learning_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_attempts" ADD CONSTRAINT "diagnostic_attempts_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "competency_catalogs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_attempt_items" ADD CONSTRAINT "diagnostic_attempt_items_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "diagnostic_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_attempt_items" ADD CONSTRAINT "diagnostic_attempt_items_diagnostic_item_id_fkey" FOREIGN KEY ("diagnostic_item_id") REFERENCES "diagnostic_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
