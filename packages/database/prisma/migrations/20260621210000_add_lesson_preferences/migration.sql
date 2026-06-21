ALTER TABLE "learning_tracks"
ADD COLUMN "lesson_emphases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "study_pace" TEXT;
