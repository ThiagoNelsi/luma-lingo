import type {
  AgeAndGoalsSelection,
  LanguageSelection,
  LessonPreferencesSelection,
  OnboardingStartingPointSelection,
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

  saveLessonPreferences(
    learnerId: string,
    selection: LessonPreferencesSelection,
  ) {
    return this.learners.saveLessonPreferences(learnerId, selection);
  }

  saveOnboardingStartingPoint(
    learnerId: string,
    selection: OnboardingStartingPointSelection,
  ) {
    return this.learners.saveOnboardingStartingPoint(learnerId, selection);
  }
}
