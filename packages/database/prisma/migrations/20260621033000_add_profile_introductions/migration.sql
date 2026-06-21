CREATE TYPE "profile_introduction_status" AS ENUM (
  'not_started',
  'pending',
  'processing',
  'completed',
  'failed',
  'manual_required'
);

CREATE TABLE "profile_introductions" (
  "id" UUID NOT NULL,
  "learner_id" UUID NOT NULL,
  "status" "profile_introduction_status" NOT NULL DEFAULT 'not_started',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error_code" TEXT,
  "job_or_field" TEXT,
  "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "daily_routine" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "study_context" TEXT,
  "other" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "profile_introductions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "profile_introductions_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "learners"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "profile_introductions_learner_id_key" ON "profile_introductions"("learner_id");
