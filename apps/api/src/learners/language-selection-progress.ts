import { languageCodeSchema, type LanguageSelection } from "@luma-lingo/shared";
import { z } from "zod/v4";

export const languageSelectionProgressSchema = z.object({
  instructionLanguage: languageCodeSchema,
  targetLanguage: languageCodeSchema,
  onboardingStatus: z.literal("in_progress"),
  onboardingStep: z.literal("languages"),
});

export type LanguageSelectionProgress = z.infer<
  typeof languageSelectionProgressSchema
>;

export function toLanguageSelectionProgress(
  selection: LanguageSelection,
): LanguageSelectionProgress {
  return {
    ...selection,
    onboardingStatus: "in_progress",
    onboardingStep: "languages",
  };
}
