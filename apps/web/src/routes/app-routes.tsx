import { Route, Routes } from "react-router";

import { LoginRedirectPage } from "../pages/login-redirect-page.js";
import { AgeAndGoalsOnboardingPage } from "../pages/age-and-goals-onboarding-page.js";
import { GoalsOnboardingPage } from "../pages/goals-onboarding-page.js";
import { InitialDiagnosticOnboardingPage } from "../pages/initial-diagnostic-onboarding-page.js";
import { InitialDiagnosticUiPrototypePage } from "../pages/initial-diagnostic-ui-prototype-page.js";
import { LanguageOnboardingPage } from "../pages/language-onboarding-page.js";
import { LessonPreferencesOnboardingPage } from "../pages/lesson-preferences-onboarding-page.js";
import { NotFoundPage } from "../pages/not-found-page.js";
import { OnboardingStartingPointPage } from "../pages/onboarding-starting-point-page.js";
import { PrivatePage } from "../pages/private-page.js";
import { ProfileIntroductionOnboardingPage } from "../pages/profile-introduction-onboarding-page.js";
import { ProfileReviewOnboardingPage } from "../pages/profile-review-onboarding-page.js";
import { PublicPage } from "../pages/public-page.js";
import { StudyPaceOnboardingPage } from "../pages/study-pace-onboarding-page.js";

interface AppRoutesProps {
  apiOrigin: string;
}

export function AppRoutes({ apiOrigin }: AppRoutesProps) {
  return (
    <Routes>
      <Route path="/" element={<PublicPage />} />
      <Route path="/public" element={<PublicPage />} />
      <Route path="/private" element={<PrivatePage apiOrigin={apiOrigin} />} />
      <Route
        path="/onboarding/languages"
        element={<LanguageOnboardingPage apiOrigin={apiOrigin} />}
      />
      <Route
        path="/onboarding/about-you"
        element={<AgeAndGoalsOnboardingPage apiOrigin={apiOrigin} />}
      />
      <Route
        path="/onboarding/goals"
        element={<GoalsOnboardingPage apiOrigin={apiOrigin} />}
      />
      <Route
        path="/onboarding/introduction"
        element={<ProfileIntroductionOnboardingPage apiOrigin={apiOrigin} />}
      />
      <Route
        path="/onboarding/preferences"
        element={<LessonPreferencesOnboardingPage apiOrigin={apiOrigin} />}
      />
      <Route
        path="/onboarding/pace"
        element={<StudyPaceOnboardingPage apiOrigin={apiOrigin} />}
      />
      <Route
        path="/onboarding/starting-point"
        element={<OnboardingStartingPointPage apiOrigin={apiOrigin} />}
      />
      <Route
        path="/onboarding/initial-diagnostic"
        element={<InitialDiagnosticOnboardingPage apiOrigin={apiOrigin} />}
      />
      <Route
        path="/onboarding/profile-review"
        element={<ProfileReviewOnboardingPage apiOrigin={apiOrigin} />}
      />
      <Route
        path="/prototype/initial-diagnostic-ui"
        element={<InitialDiagnosticUiPrototypePage />}
      />
      <Route
        path="/login"
        element={<LoginRedirectPage apiOrigin={apiOrigin} />}
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
