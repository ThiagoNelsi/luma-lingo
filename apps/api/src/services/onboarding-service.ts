import type {
  AgeAndGoalsSelection,
  LanguageSelection,
} from "@luma-lingo/shared";

import type { LearnerRepository } from "../learners/learner-repository.js";

export class OnboardingService {
  constructor(private readonly learners: LearnerRepository) {}

  saveLanguageSelection(learnerId: string, selection: LanguageSelection) {
    return this.learners.saveLanguageSelection(learnerId, selection);
  }

  saveAgeAndGoals(learnerId: string, selection: AgeAndGoalsSelection) {
    return this.learners.saveAgeAndGoals(learnerId, selection);
  }
}
