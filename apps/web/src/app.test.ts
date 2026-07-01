import { describe, expect, it } from "vitest";

import { createLogoutAction, createLoginRedirect } from "./auth/auth-routes.js";
import { normalizeApiOrigin, readApiOrigin } from "./config/api-origin.js";
import { getInitialDiagnosticRedirect } from "./pages/initial-diagnostic-onboarding-page.js";
import {
  getNextOnboardingRoute,
  renderPrivateRouteText,
} from "./pages/private-page.js";
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

  it("resumes onboarding at the correct next step", () => {
    expect(
      getNextOnboardingRoute({
        user: { primaryEmail: "learner@example.com" },
        learner: { displayName: "Thiago", instructionLanguage: null },
        currentLearningTrack: null,
      }),
    ).toBe("/onboarding/languages");
    expect(
      getNextOnboardingRoute({
        user: { primaryEmail: "learner@example.com" },
        learner: {
          displayName: "Thiago",
          instructionLanguage: "pt",
          ageRange: "25_39",
        },
        currentLearningTrack: {
          targetLanguage: "en",
          learningGoal: "travel",
          additionalGoals: [],
          lessonEmphases: ["reading"],
          studyPace: null,
          onboardingStartingPoint: null,
          onboardingStatus: "in_progress",
          onboardingStep: "lesson_preferences",
        },
      }),
    ).toBe("/onboarding/starting-point");
    expect(
      getNextOnboardingRoute({
        user: { primaryEmail: "learner@example.com" },
        learner: {
          displayName: "Thiago",
          instructionLanguage: "pt",
          ageRange: "25_39",
        },
        currentLearningTrack: {
          targetLanguage: "en",
          learningGoal: "travel",
          additionalGoals: [],
          lessonEmphases: ["reading"],
          studyPace: "relaxed",
          onboardingStartingPoint: "diagnostic",
          onboardingStatus: "in_progress",
          onboardingStep: "starting_point",
        },
      }),
    ).toBe("/onboarding/initial-diagnostic");
    expect(
      getNextOnboardingRoute({
        user: { primaryEmail: "learner@example.com" },
        learner: {
          displayName: "Thiago",
          instructionLanguage: "pt",
          ageRange: "25_39",
        },
        currentLearningTrack: {
          targetLanguage: "en",
          learningGoal: "travel",
          additionalGoals: [],
          lessonEmphases: ["reading"],
          studyPace: "relaxed",
          onboardingStartingPoint: "beginner",
          onboardingStatus: "completed",
          onboardingStep: "starting_point",
        },
      }),
    ).toBe("/private");
  });

  it("redirects the Initial diagnostic page when onboarding prerequisites are missing", () => {
    expect(
      getInitialDiagnosticRedirect(
        {
          user: { primaryEmail: "learner@example.com" },
          learner: { displayName: "Thiago", instructionLanguage: null },
          currentLearningTrack: null,
        },
        "completed",
      ),
    ).toBe("/onboarding/languages");
    expect(
      getInitialDiagnosticRedirect(
        {
          user: { primaryEmail: "learner@example.com" },
          learner: {
            displayName: "Thiago",
            instructionLanguage: "pt",
            ageRange: "25_39",
          },
          currentLearningTrack: {
            targetLanguage: "en",
            learningGoal: "travel",
            additionalGoals: [],
            lessonEmphases: ["reading"],
            studyPace: "relaxed",
            onboardingStartingPoint: "beginner",
            onboardingStatus: "in_progress",
            onboardingStep: "starting_point",
          },
        },
        "completed",
      ),
    ).toBe("/onboarding/starting-point");
    expect(
      getInitialDiagnosticRedirect(
        {
          user: { primaryEmail: "learner@example.com" },
          learner: {
            displayName: "Thiago",
            instructionLanguage: "pt",
            ageRange: "25_39",
          },
          currentLearningTrack: {
            targetLanguage: "en",
            learningGoal: "travel",
            additionalGoals: [],
            lessonEmphases: ["reading"],
            studyPace: "relaxed",
            onboardingStartingPoint: "diagnostic",
            onboardingStatus: "in_progress",
            onboardingStep: "starting_point",
          },
        },
        "completed",
      ),
    ).toBeNull();
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
