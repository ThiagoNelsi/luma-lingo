import { describe, expect, it } from "vitest";

import { validateOnboardingStartingPointForm } from "./onboarding-starting-point-form.js";

describe("Onboarding starting point form", () => {
  it("requires a Beginner path or Diagnostic path selection", () => {
    expect(
      validateOnboardingStartingPointForm({ onboardingStartingPoint: "" }),
    ).toEqual({
      ok: false,
      error: "Escolha como quer começar.",
    });
    expect(
      validateOnboardingStartingPointForm({
        onboardingStartingPoint: "beginner",
      }),
    ).toEqual({
      ok: true,
      selection: { onboardingStartingPoint: "beginner" },
    });
    expect(
      validateOnboardingStartingPointForm({
        onboardingStartingPoint: "diagnostic",
      }),
    ).toEqual({
      ok: true,
      selection: { onboardingStartingPoint: "diagnostic" },
    });
  });
});
