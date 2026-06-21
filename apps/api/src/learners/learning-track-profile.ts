import {
  additionalGoalSchema,
  cefrGoalLevelSchema,
  goalSchema,
  languageCodeSchema,
} from "@luma-lingo/shared";
import { z } from "zod/v4";

export const learningTrackProfileSchema = z.object({
  id: z.uuid(),
  targetLanguage: languageCodeSchema,
  level: z.string().nullable(),
  learningGoal: goalSchema.nullable(),
  goalCefrLevel: cefrGoalLevelSchema.nullable(),
  additionalGoals: z.array(additionalGoalSchema),
  onboardingStatus: z.string(),
  onboardingStep: z.string().nullable(),
});

export type LearningTrackProfile = z.infer<typeof learningTrackProfileSchema>;
