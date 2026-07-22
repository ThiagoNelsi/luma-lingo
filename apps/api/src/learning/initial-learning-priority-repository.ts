import type { InitialLearningPriority } from "./initial-learning-priority.js";

export interface InitialLearningPriorityRepository {
  findInitialLearningPriority(input: {
    learningTrackId: string;
    onboardingStartingPoint: "beginner" | "diagnostic";
  }): Promise<InitialLearningPriority | null>;
}
