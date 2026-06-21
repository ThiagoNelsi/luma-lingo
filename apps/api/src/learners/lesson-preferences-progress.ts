import {
  lessonPreferencesSelectionSchema,
  type LessonPreferencesSelection,
} from "@luma-lingo/shared";
import { z } from "zod/v4";

export const lessonPreferencesProgressSchema =
  lessonPreferencesSelectionSchema.and(
    z.object({
      onboardingStatus: z.literal("in_progress"),
      onboardingStep: z.literal("lesson_preferences"),
    }),
  );

export type LessonPreferencesProgress = z.infer<
  typeof lessonPreferencesProgressSchema
>;

export function toLessonPreferencesProgress(
  selection: LessonPreferencesSelection,
): LessonPreferencesProgress {
  return {
    ...selection,
    onboardingStatus: "in_progress",
    onboardingStep: "lesson_preferences",
  };
}
