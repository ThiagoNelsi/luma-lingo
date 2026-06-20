import { languageCodeSchema } from "@luma-lingo/shared";
import { z } from "zod";

export const meResponseSchema = z.object({
  user: z.object({
    primaryEmail: z.string(),
  }),
  learner: z.object({
    displayName: z.string().nullable(),
    instructionLanguage: languageCodeSchema.nullable().optional(),
  }),
  currentLearningTrack: z
    .object({
      targetLanguage: languageCodeSchema,
      onboardingStatus: z.string(),
      onboardingStep: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
