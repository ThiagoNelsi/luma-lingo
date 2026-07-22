import { afterEach, describe, expect, it, vi } from "vitest";

import {
  completeOnboarding,
  UnauthorizedOnboardingCompletionError,
} from "./onboarding-completion-client.js";

describe("Onboarding completion client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("completes onboarding with credentials and parses the completion state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          onboardingStatus: "completed",
          onboardingStep: null,
          initialLearningPriority: null,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(completeOnboarding("http://localhost:3000/")).resolves.toEqual(
      {
        onboardingStatus: "completed",
        onboardingStep: null,
        initialLearningPriority: null,
      },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/me/onboarding/complete",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
  });

  it("throws a specific unauthorized error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 401 })),
    );

    await expect(
      completeOnboarding("http://localhost:3000"),
    ).rejects.toBeInstanceOf(UnauthorizedOnboardingCompletionError);
  });
});
