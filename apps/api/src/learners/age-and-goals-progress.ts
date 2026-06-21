import {
  ageAndGoalsSelectionSchema,
  type AgeAndGoalsSelection,
} from "@luma-lingo/shared";
import { z } from "zod/v4";

export const ageAndGoalsProgressSchema = ageAndGoalsSelectionSchema.and(
  z.object({
    onboardingStatus: z.literal("in_progress"),
    onboardingStep: z.literal("age_and_goals"),
  }),
);

export type AgeAndGoalsProgress = z.infer<typeof ageAndGoalsProgressSchema>;

export function toAgeAndGoalsProgress(
  selection: AgeAndGoalsSelection,
): AgeAndGoalsProgress {
  return {
    ...selection,
    onboardingStatus: "in_progress",
    onboardingStep: "age_and_goals",
  };
}
