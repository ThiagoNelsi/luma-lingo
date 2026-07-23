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
import { createSilentLogger, type AppLogger } from "../observability/logger.js";
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
    private readonly logger: AppLogger = createSilentLogger(),
  ) {}

  async saveLanguageSelection(learnerId: string, selection: LanguageSelection) {
    const progress = await this.learners.saveLanguageSelection(
      learnerId,
      selection,
    );
    this.logger.info(
      { event: "onboarding.languages.saved", learnerId },
      "Onboarding languages saved",
    );
    return progress;
  }

  async saveAgeAndGoals(learnerId: string, selection: AgeAndGoalsSelection) {
    const progress = await this.learners.saveAgeAndGoals(learnerId, selection);
    this.logger.info(
      { event: "onboarding.age_and_goals.saved", learnerId },
      "Onboarding age and goals saved",
    );
    return progress;
  }

  async saveLessonPreferences(
    learnerId: string,
    selection: LessonPreferencesSelection,
  ) {
    const progress = await this.learners.saveLessonPreferences(
      learnerId,
      selection,
    );
    this.logger.info(
      { event: "onboarding.lesson_preferences.saved", learnerId },
      "Onboarding lesson preferences saved",
    );
    return progress;
  }

  async saveOnboardingStartingPoint(
    learnerId: string,
    selection: OnboardingStartingPointSelection,
  ) {
    const progress = await this.learners.saveOnboardingStartingPoint(
      learnerId,
      selection,
    );
    this.logger.info(
      { event: "onboarding.starting_point.saved", learnerId },
      "Onboarding starting point saved",
    );
    return progress;
  }

  async completeOnboarding(input: CompleteOnboardingInput, learnerId: string) {
    const parsedInput = completeOnboardingInputSchema.parse(input);

    if (!parsedInput.onboardingStartingPoint) {
      this.logger.warn(
        {
          event: "onboarding.completion.rejected",
          learnerId,
          reason: "onboarding_starting_point_required",
        },
        "Onboarding completion rejected",
      );
      throw new Error("onboarding_starting_point_required");
    }

    await this.requireConfirmedProfile(learnerId);

    if (parsedInput.onboardingStartingPoint === "beginner") {
      const completion = await this.completion.completeBeginnerOnboarding({
        learningTrackId: parsedInput.learningTrackId,
        targetLanguage: parsedInput.targetLanguage,
      });

      if (!completion) {
        this.logger.warn(
          {
            event: "onboarding.completion.rejected",
            learnerId,
            learningTrackId: parsedInput.learningTrackId,
            reason: "published_competency_catalog_required",
          },
          "Onboarding completion rejected",
        );
        throw new Error("published_competency_catalog_required");
      }

      const result = await this.withInitialLearningPriority(
        completion,
        parsedInput,
      );
      this.logger.info(
        {
          event: "onboarding.completed",
          learnerId,
          learningTrackId: parsedInput.learningTrackId,
          startingPoint: "beginner",
        },
        "Onboarding completed",
      );
      return result;
    }

    const completedAttempt = await this.diagnosticAttempts.findCompletedAttempt(
      parsedInput.learningTrackId,
      initialDiagnosticPurpose,
    );

    if (!completedAttempt) {
      this.logger.warn(
        {
          event: "onboarding.completion.rejected",
          learnerId,
          learningTrackId: parsedInput.learningTrackId,
          reason: "completed_initial_diagnostic_required",
        },
        "Onboarding completion rejected",
      );
      throw new Error("completed_initial_diagnostic_required");
    }

    const completion = await this.completion.completeDiagnosticOnboarding({
      learningTrackId: parsedInput.learningTrackId,
      competencyCatalogId: completedAttempt.catalogId,
    });

    const result = await this.withInitialLearningPriority(
      completion,
      parsedInput,
    );
    this.logger.info(
      {
        event: "onboarding.completed",
        learnerId,
        learningTrackId: parsedInput.learningTrackId,
        startingPoint: "diagnostic",
      },
      "Onboarding completed",
    );
    return result;
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
      this.logger.warn(
        {
          event: "onboarding.completion.rejected",
          learnerId,
          reason: "confirmed_user_profile_required",
        },
        "Onboarding completion rejected",
      );
      throw new Error("confirmed_user_profile_required");
    }
  }
}

const noInitialLearningPriorityRepository: InitialLearningPriorityRepository = {
  async findInitialLearningPriority() {
    return null;
  },
};
