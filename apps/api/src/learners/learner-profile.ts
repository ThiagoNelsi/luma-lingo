import { z } from "zod/v4";

export const learnerProfileSchema = z.object({
  id: z.uuid(),
  displayName: z.string().nullable(),
  nativeLanguage: z.string().nullable(),
  ageRange: z.string().nullable(),
  currentLearningTrackId: z.uuid().nullable(),
});

export type LearnerProfile = z.infer<typeof learnerProfileSchema>;
