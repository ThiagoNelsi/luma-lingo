import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgeAndGoalsSelection } from "@luma-lingo/shared";

import {
  saveAgeAndGoals,
  UnauthorizedAgeAndGoalsError,
} from "./age-and-goals-client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saveAgeAndGoals", () => {
  const selection: AgeAndGoalsSelection = {
    ageRange: "25_39",
    displayName: "Thiago",
    primaryGoal: "work",
    cefrGoalLevel: null,
    additionalGoals: ["travel"],
  };

  it("saves age and goals with the authenticated browser session", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...selection,
          onboardingStatus: "in_progress",
          onboardingStep: "age_and_goals",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      saveAgeAndGoals("http://localhost:3000/", selection),
    ).resolves.toMatchObject({ onboardingStep: "age_and_goals" });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/me/age-and-goals",
      {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(selection),
      },
    );
  });

  it("reports an expired authenticated session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );

    await expect(
      saveAgeAndGoals("http://localhost:3000", selection),
    ).rejects.toBeInstanceOf(UnauthorizedAgeAndGoalsError);
  });
});
