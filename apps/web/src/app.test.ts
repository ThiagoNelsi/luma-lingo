import { describe, expect, it } from "vitest";

import { createLogoutAction, createLoginRedirect } from "./auth/auth-routes.js";
import { normalizeApiOrigin, readApiOrigin } from "./config/api-origin.js";
import { renderPrivateRouteText } from "./pages/private-page.js";
import { renderPublicRouteText } from "./pages/public-page.js";

describe("web routes", () => {
  it("renders the public route text", () => {
    expect(renderPublicRouteText()).toBe(
      "Aulas de idiomas personalizadas para seus objetivos, interesses e ritmo.",
    );
  });

  it("renders private route text with learner data", () => {
    expect(
      renderPrivateRouteText({
        user: { primaryEmail: "learner@example.com" },
        learner: { displayName: "Thiago" },
      }),
    ).toBe("Boas-vindas, Thiago!");
  });

  it("redirects /login to the backend-managed Cognito login start", () => {
    expect(createLoginRedirect("http://localhost:3000")).toBe(
      "http://localhost:3000/auth/login",
    );
  });

  it("posts logout to the backend-managed Cognito logout route", () => {
    expect(createLogoutAction("http://localhost:3000/")).toBe(
      "http://localhost:3000/auth/logout",
    );
  });

  it("normalizes the API origin used by route actions", () => {
    expect(normalizeApiOrigin("http://localhost:3000///")).toBe(
      "http://localhost:3000",
    );
  });

  it("uses the local API origin by default", () => {
    expect(readApiOrigin(undefined)).toBe("http://localhost:3000");
  });
});
