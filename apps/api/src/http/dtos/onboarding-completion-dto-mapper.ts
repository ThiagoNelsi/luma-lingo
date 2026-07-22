import type { InitialLearningPriority } from "../../learning/initial-learning-priority.js";
import type { OnboardingCompletion } from "../../learners/onboarding-completion.js";

import type { OnboardingCompletionDto } from "./onboarding-completion-dto.js";

export function toOnboardingCompletionDto(input: {
  completion: OnboardingCompletion;
  initialLearningPriority: InitialLearningPriority | null;
}): OnboardingCompletionDto {
  return {
    ...input.completion,
    initialLearningPriority: input.initialLearningPriority
      ? {
          competencyId: input.initialLearningPriority.competencyId,
          competencyKey: input.initialLearningPriority.competencyKey,
        }
      : null,
  };
}
