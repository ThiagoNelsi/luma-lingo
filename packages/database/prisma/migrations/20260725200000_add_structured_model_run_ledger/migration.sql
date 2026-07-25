CREATE TYPE "structured_model_run_status" AS ENUM ('queued', 'pending', 'completed', 'failed');

ALTER TABLE "lesson_production_runs" RENAME TO "structured_model_runs";
ALTER TABLE "structured_model_runs" RENAME CONSTRAINT "lesson_production_runs_pkey" TO "structured_model_runs_pkey";
ALTER TABLE "structured_model_runs" RENAME CONSTRAINT "lesson_production_runs_lesson_id_fkey" TO "structured_model_runs_lesson_id_fkey";
ALTER INDEX "lesson_production_runs_lesson_id_step_key" RENAME TO "structured_model_runs_lesson_id_step_key";

ALTER TABLE "structured_model_runs"
  ADD COLUMN "status" "structured_model_run_status" NOT NULL DEFAULT 'completed',
  ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "input_tokens" INTEGER,
  ADD COLUMN "output_tokens" INTEGER,
  ADD COLUMN "latency_ms" INTEGER,
  ADD COLUMN "error_code" TEXT,
  ADD COLUMN "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP INDEX "structured_model_runs_lesson_id_step_key";
CREATE UNIQUE INDEX "structured_model_runs_lesson_id_step_attempt_key" ON "structured_model_runs"("lesson_id", "step", "attempt");
CREATE INDEX "structured_model_runs_status_idx" ON "structured_model_runs"("status");
