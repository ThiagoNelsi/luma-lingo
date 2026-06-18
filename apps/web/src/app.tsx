import { useEffect, useState } from "react";

type RouteKind = "login" | "private" | "public" | "not-found";

interface MeResponse {
  user: { primaryEmail: string };
  learner: { displayName: string | null };
}

export function getRouteKind(pathname: string): RouteKind {
  if (pathname === "/login") return "login";
  if (pathname === "/private") return "private";
  if (pathname === "/public" || pathname === "/") return "public";
  return "not-found";
}

export function createLoginRedirect(apiOrigin: string): string {
  return `${apiOrigin.replace(/\/$/, "")}/auth/login`;
}

export function createLogoutAction(apiOrigin: string): string {
  return `${apiOrigin.replace(/\/$/, "")}/auth/logout`;
}

export function renderPublicRouteText(): string {
  return "public route";
}

export function renderPrivateRouteText(me: MeResponse): string {
  const displayName = me.learner.displayName ?? "learner";
  return `private route + ${displayName} ${me.user.primaryEmail}`;
}

export function App() {
  const route = getRouteKind(window.location.pathname);
  const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? "http://localhost:3000";

  if (route === "login") {
    window.location.replace(createLoginRedirect(apiOrigin));
    return null;
  }

  if (route === "private") {
    return <PrivateRoute apiOrigin={apiOrigin} />;
  }

  if (route === "public") {
    return <main>{renderPublicRouteText()}</main>;
  }

  return <main>not found</main>;
}

function PrivateRoute({ apiOrigin }: { apiOrigin: string }) {
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMe() {
      const response = await fetch(`${apiOrigin.replace(/\/$/, "")}/me`, {
        credentials: "include",
      });

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("me_request_failed");
      }

      const nextMe = (await response.json()) as MeResponse;
      if (active) {
        setMe(nextMe);
      }
    }

    void loadMe();

    return () => {
      active = false;
    };
  }, [apiOrigin]);

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
