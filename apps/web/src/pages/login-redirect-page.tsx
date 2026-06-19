import { useEffect } from "react";

import { createLoginRedirect } from "../auth/auth-routes.js";

interface LoginRedirectPageProps {
  apiOrigin: string;
}

export function LoginRedirectPage({ apiOrigin }: LoginRedirectPageProps) {
  useEffect(() => {
    window.location.replace(createLoginRedirect(apiOrigin));
  }, [apiOrigin]);

  return null;
}
