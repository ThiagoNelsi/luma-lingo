import { Route, Routes } from "react-router";

import { LoginRedirectPage } from "../pages/login-redirect-page.js";
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
        path="/login"
        element={<LoginRedirectPage apiOrigin={apiOrigin} />}
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
