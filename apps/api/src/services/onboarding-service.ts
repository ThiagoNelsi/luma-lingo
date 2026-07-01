import type {
  AgeAndGoalsSelection,
  LanguageSelection,
  LessonPreferencesSelection,
  OnboardingStartingPointSelection,
} from "@luma-lingo/shared";

import type { DiagnosticAttemptRepository } from "../diagnostics/diagnostic-attempt-repository.js";
import type { LearnerRepository } from "../learners/learner-repository.js";
import {
  completeOnboardingInputSchema,
  type CompleteOnboardingInput,
} from "../learners/onboarding-completion.js";
import type { OnboardingCompletionRepository } from "../learners/onboarding-completion-repository.js";

const initialDiagnosticPurpose = "onboarding_initial";

export class OnboardingService {
  constructor(
    private readonly learners: LearnerRepository,
    private readonly completion: OnboardingCompletionRepository,
    private readonly diagnosticAttempts: DiagnosticAttemptRepository,
  ) {}

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

  async completeOnboarding(input: CompleteOnboardingInput) {
    const parsedInput = completeOnboardingInputSchema.parse(input);

    if (!parsedInput.onboardingStartingPoint) {
      throw new Error("onboarding_starting_point_required");
    }

    if (parsedInput.onboardingStartingPoint === "beginner") {
      const completion = await this.completion.completeBeginnerOnboarding({
        learningTrackId: parsedInput.learningTrackId,
        targetLanguage: parsedInput.targetLanguage,
      });

      if (!completion) {
        throw new Error("published_competency_catalog_required");
      }

      return completion;
    }

    const completedAttempt = await this.diagnosticAttempts.findCompletedAttempt(
      parsedInput.learningTrackId,
      initialDiagnosticPurpose,
    );

    if (!completedAttempt) {
      throw new Error("completed_initial_diagnostic_required");
    }

    return this.completion.completeDiagnosticOnboarding({
      learningTrackId: parsedInput.learningTrackId,
      competencyCatalogId: completedAttempt.catalogId,
    });
  }
}
