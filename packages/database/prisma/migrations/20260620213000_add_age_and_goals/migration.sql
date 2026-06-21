ALTER TABLE "learning_tracks"
ADD COLUMN "goal_cefr_level" TEXT,
ADD COLUMN "additional_goals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
