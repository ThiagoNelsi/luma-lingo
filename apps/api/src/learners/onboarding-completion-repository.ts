import type { OnboardingCompletion } from "./onboarding-completion.js";

export interface OnboardingCompletionRepository {
  completeBeginnerOnboarding(input: {
    learningTrackId: string;
    targetLanguage: string;
  }): Promise<OnboardingCompletion | null>;
  completeDiagnosticOnboarding(input: {
    learningTrackId: string;
    competencyCatalogId: string;
  }): Promise<OnboardingCompletion>;
}
