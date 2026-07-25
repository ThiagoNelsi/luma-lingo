CREATE TYPE "lesson_status" AS ENUM ('preparing', 'ready', 'failed');

CREATE TABLE "learning_modules" (
    "id" UUID NOT NULL,
    "learning_track_id" UUID NOT NULL,
    "objective_competency_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "learning_modules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "learning_track_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "priority_competency_id" UUID NOT NULL,
    "status" "lesson_status" NOT NULL DEFAULT 'preparing',
    "plan" JSONB,
    "plan_adapter" TEXT,
    "plan_model" TEXT,
    "plan_prompt_version" TEXT,
    "plan_contract_version" TEXT,
    "block_adapter" TEXT,
    "block_model" TEXT,
    "block_prompt_version" TEXT,
    "block_contract_version" TEXT,
    "failure_code" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lesson_blocks" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "lesson_blocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lesson_production_runs" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "step" TEXT NOT NULL,
    "adapter" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "contract_version" TEXT NOT NULL,
    "provider_reference" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lesson_production_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "learning_modules_learning_track_id_objective_competency_id_key" ON "learning_modules"("learning_track_id", "objective_competency_id");
CREATE INDEX "learning_modules_objective_competency_id_idx" ON "learning_modules"("objective_competency_id");
CREATE UNIQUE INDEX "lessons_learning_track_id_priority_competency_id_key" ON "lessons"("learning_track_id", "priority_competency_id");
CREATE INDEX "lessons_module_id_idx" ON "lessons"("module_id");
CREATE INDEX "lessons_learning_track_id_status_idx" ON "lessons"("learning_track_id", "status");
CREATE UNIQUE INDEX "lesson_blocks_lesson_id_position_key" ON "lesson_blocks"("lesson_id", "position");
CREATE UNIQUE INDEX "lesson_production_runs_lesson_id_step_key" ON "lesson_production_runs"("lesson_id", "step");

ALTER TABLE "learning_modules" ADD CONSTRAINT "learning_modules_learning_track_id_fkey" FOREIGN KEY ("learning_track_id") REFERENCES "learning_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_modules" ADD CONSTRAINT "learning_modules_objective_competency_id_fkey" FOREIGN KEY ("objective_competency_id") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_learning_track_id_fkey" FOREIGN KEY ("learning_track_id") REFERENCES "learning_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "learning_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_priority_competency_id_fkey" FOREIGN KEY ("priority_competency_id") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_blocks" ADD CONSTRAINT "lesson_blocks_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_production_runs" ADD CONSTRAINT "lesson_production_runs_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
