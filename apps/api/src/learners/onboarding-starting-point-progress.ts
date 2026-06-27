import {
  onboardingStartingPointSelectionSchema,
  type OnboardingStartingPointSelection,
} from "@luma-lingo/shared";
import { z } from "zod/v4";

export const onboardingStartingPointProgressSchema =
  onboardingStartingPointSelectionSchema.and(
    z.object({
      onboardingStatus: z.literal("in_progress"),
      onboardingStep: z.literal("starting_point"),
    }),
  );

export type OnboardingStartingPointProgress = z.infer<
  typeof onboardingStartingPointProgressSchema
>;

export function toOnboardingStartingPointProgress(
  selection: OnboardingStartingPointSelection,
): OnboardingStartingPointProgress {
  return {
    ...selection,
    onboardingStatus: "in_progress",
    onboardingStep: "starting_point",
  };
}
