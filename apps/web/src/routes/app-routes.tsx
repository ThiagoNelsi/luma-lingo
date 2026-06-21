import { Route, Routes } from "react-router";

import { LoginRedirectPage } from "../pages/login-redirect-page.js";
import { AgeAndGoalsOnboardingPage } from "../pages/age-and-goals-onboarding-page.js";
import { GoalsOnboardingPage } from "../pages/goals-onboarding-page.js";
import { LanguageOnboardingPage } from "../pages/language-onboarding-page.js";
import { NotFoundPage } from "../pages/not-found-page.js";
import { PrivatePage } from "../pages/private-page.js";
import { PublicPage } from "../pages/public-page.js";

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
        path="/login"
        element={<LoginRedirectPage apiOrigin={apiOrigin} />}
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
