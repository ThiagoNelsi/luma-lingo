import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { createLogoutAction } from "../auth/auth-routes.js";
import { fetchMe, UnauthorizedSessionError } from "../auth/me-client.js";
import type { MeResponse } from "../auth/me.js";

interface PrivatePageProps {
  apiOrigin: string;
}

export function renderPrivateRouteText(me: MeResponse): string {
  const displayName = me.learner.displayName ?? "learner";
  return `private route + ${displayName} ${me.user.primaryEmail}`;
}

export function PrivatePage({ apiOrigin }: PrivatePageProps) {
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMe() {
      try {
        const nextMe = await fetchMe(apiOrigin);
        if (active) {
          setMe(nextMe);
        }
      } catch (error) {
        if (error instanceof UnauthorizedSessionError) {
          navigate("/login", { replace: true });
          return;
        }

        throw error;
      }
    }

    void loadMe();

    return () => {
      active = false;
    };
  }, [apiOrigin, navigate]);

  return (
    <main>
      {me ? (
        <>
          <p>{renderPrivateRouteText(me)}</p>
          <form method="post" action={createLogoutAction(apiOrigin)}>
            <button type="submit">Log out</button>
          </form>
        </>
      ) : (
        ""
      )}
    </main>
  );
}
