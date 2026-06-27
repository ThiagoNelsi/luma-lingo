import { afterEach, describe, expect, it, vi } from "vitest";

import { saveOnboardingStartingPoint } from "./onboarding-starting-point-client.js";

describe("Onboarding starting point client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("saves the selected path with credentials and parses its progress", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          onboardingStartingPoint: "diagnostic",
          onboardingStatus: "in_progress",
          onboardingStep: "starting_point",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveOnboardingStartingPoint("http://localhost:3000/", {
        onboardingStartingPoint: "diagnostic",
      }),
    ).resolves.toEqual({
      onboardingStartingPoint: "diagnostic",
      onboardingStatus: "in_progress",
      onboardingStep: "starting_point",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/me/onboarding-starting-point",
      expect.objectContaining({
        method: "PUT",
        credentials: "include",
        body: JSON.stringify({ onboardingStartingPoint: "diagnostic" }),
      }),
    );
  });
});
