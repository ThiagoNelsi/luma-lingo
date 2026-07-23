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
import type { InitialLearningPriorityRepository } from "../learning/initial-learning-priority-repository.js";
import type { ProfileIntroductionService } from "../profile/profile-introduction-service.js";

const initialDiagnosticPurpose = "onboarding_initial";

export class OnboardingService {
  constructor(
    private readonly learners: LearnerRepository,
    private readonly completion: OnboardingCompletionRepository,
    private readonly diagnosticAttempts: DiagnosticAttemptRepository,
    private readonly initialLearningPriorities: InitialLearningPriorityRepository = noInitialLearningPriorityRepository,
    private readonly profileIntroduction?: Pick<
      ProfileIntroductionService,
      "get"
    >,
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

  async completeOnboarding(input: CompleteOnboardingInput, learnerId: string) {
    const parsedInput = completeOnboardingInputSchema.parse(input);

    if (!parsedInput.onboardingStartingPoint) {
      throw new Error("onboarding_starting_point_required");
    }

    await this.requireConfirmedProfile(learnerId);

    if (parsedInput.onboardingStartingPoint === "beginner") {
      const completion = await this.completion.completeBeginnerOnboarding({
        learningTrackId: parsedInput.learningTrackId,
        targetLanguage: parsedInput.targetLanguage,
      });

      if (!completion) {
        throw new Error("published_competency_catalog_required");
      }

      return this.withInitialLearningPriority(completion, parsedInput);
    }

    const completedAttempt = await this.diagnosticAttempts.findCompletedAttempt(
      parsedInput.learningTrackId,
      initialDiagnosticPurpose,
    );

    if (!completedAttempt) {
      throw new Error("completed_initial_diagnostic_required");
    }

    const completion = await this.completion.completeDiagnosticOnboarding({
      learningTrackId: parsedInput.learningTrackId,
      competencyCatalogId: completedAttempt.catalogId,
    });

    return this.withInitialLearningPriority(completion, parsedInput);
  }

  private async withInitialLearningPriority(
    completion: Awaited<
      ReturnType<OnboardingCompletionRepository["completeDiagnosticOnboarding"]>
    >,
    input: CompleteOnboardingInput,
  ) {
    return {
      ...completion,
      initialLearningPriority:
        await this.initialLearningPriorities.findInitialLearningPriority({
          learningTrackId: input.learningTrackId,
          onboardingStartingPoint: input.onboardingStartingPoint!,
        }),
    };
  }

  private async requireConfirmedProfile(learnerId: string): Promise<void> {
    if (!this.profileIntroduction) return;
    const progress = await this.profileIntroduction.get(learnerId);
    if (
      progress.status !== "completed" ||
      !progress.confirmed ||
      !progress.profile?.jobOrField ||
      progress.profile.interests.length === 0
    ) {
      throw new Error("confirmed_user_profile_required");
    }
  }
}

const noInitialLearningPriorityRepository: InitialLearningPriorityRepository = {
  async findInitialLearningPriority() {
    return null;
  },
};
