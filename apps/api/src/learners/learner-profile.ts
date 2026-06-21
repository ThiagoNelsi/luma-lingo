import { languageCodeSchema, learnerAgeRangeSchema } from "@luma-lingo/shared";
import { z } from "zod/v4";

export const learnerProfileSchema = z.object({
  id: z.uuid(),
  displayName: z.string().nullable(),
  instructionLanguage: languageCodeSchema.nullable(),
  ageRange: learnerAgeRangeSchema.nullable(),
  currentLearningTrackId: z.uuid().nullable(),
});

export type LearnerProfile = z.infer<typeof learnerProfileSchema>;
