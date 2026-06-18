import { describe, expect, it } from "vitest";

import {
  createLogoutAction,
  createLoginRedirect,
  getRouteKind,
  renderPrivateRouteText,
  renderPublicRouteText,
} from "./app.js";

describe("web routes", () => {
  it("renders the public route text", () => {
    expect(renderPublicRouteText()).toBe("public route");
  });

  it("renders private route text with learner data", () => {
    expect(
      renderPrivateRouteText({
        user: { primaryEmail: "learner@example.com" },
        learner: { displayName: "Thiago" },
      }),
    ).toBe("private route + Thiago learner@example.com");
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

  it("recognizes public, private, and login routes", () => {
    expect(getRouteKind("/public")).toBe("public");
    expect(getRouteKind("/private")).toBe("private");
    expect(getRouteKind("/login")).toBe("login");
  });
});
