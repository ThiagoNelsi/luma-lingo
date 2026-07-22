import { z } from "zod";

export const initialLearningPriorityDtoSchema = z.object({
  competencyId: z.string(),
  competencyKey: z.string(),
});
export type InitialLearningPriorityDto = z.infer<
  typeof initialLearningPriorityDtoSchema
>;

export const onboardingCompletionDtoSchema = z.object({
  onboardingStatus: z.literal("completed"),
  onboardingStep: z.null(),
  initialLearningPriority: initialLearningPriorityDtoSchema.nullable(),
});
export type OnboardingCompletionDto = z.infer<
  typeof onboardingCompletionDtoSchema
>;
