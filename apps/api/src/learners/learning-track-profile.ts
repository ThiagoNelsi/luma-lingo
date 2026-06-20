import { languageCodeSchema } from "@luma-lingo/shared";
import { z } from "zod/v4";

export const learningTrackProfileSchema = z.object({
  id: z.uuid(),
  targetLanguage: languageCodeSchema,
  level: z.string().nullable(),
  learningGoal: z.string().nullable(),
  onboardingStatus: z.string(),
  onboardingStep: z.string().nullable(),
});

export type LearningTrackProfile = z.infer<typeof learningTrackProfileSchema>;
