import {
  additionalGoalSchema,
  cefrGoalLevelSchema,
  goalSchema,
  languageCodeSchema,
  learnerAgeRangeSchema,
} from "@luma-lingo/shared";
import { z } from "zod";

export const meResponseSchema = z.object({
  user: z.object({
    primaryEmail: z.string(),
  }),
  learner: z.object({
    displayName: z.string().nullable(),
    instructionLanguage: languageCodeSchema.nullable().optional(),
    ageRange: learnerAgeRangeSchema.nullable().optional(),
  }),
  currentLearningTrack: z
    .object({
      targetLanguage: languageCodeSchema,
      learningGoal: goalSchema.nullable().optional(),
      goalCefrLevel: cefrGoalLevelSchema.nullable().optional(),
      additionalGoals: z.array(additionalGoalSchema).optional(),
      onboardingStatus: z.string(),
      onboardingStep: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
