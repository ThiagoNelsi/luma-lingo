import { onboardingStartingPointSchema } from "@luma-lingo/shared";
import { z } from "zod";

export const onboardingCompletionSchema = z.object({
  onboardingStatus: z.literal("completed"),
  onboardingStep: z.null(),
});
export type OnboardingCompletion = z.infer<typeof onboardingCompletionSchema>;

export const completeOnboardingInputSchema = z.object({
  learningTrackId: z.string(),
  targetLanguage: z.string(),
  onboardingStartingPoint: onboardingStartingPointSchema.nullable(),
});
export type CompleteOnboardingInput = z.infer<
  typeof completeOnboardingInputSchema
>;

export function toOnboardingCompletion(): OnboardingCompletion {
  return {
    onboardingStatus: "completed",
    onboardingStep: null,
  };
}
