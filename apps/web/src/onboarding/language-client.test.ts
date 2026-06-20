import { afterEach, describe, expect, it, vi } from "vitest";

import {
  saveLanguageSelection,
  UnauthorizedLanguageSelectionError,
} from "./language-client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saveLanguageSelection", () => {
  it("saves languages with the authenticated browser session", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          instructionLanguage: "pt",
          targetLanguage: "en",
          onboardingStatus: "in_progress",
          onboardingStep: "languages",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      saveLanguageSelection("http://localhost:3000/", {
        instructionLanguage: "pt",
        targetLanguage: "en",
      }),
    ).resolves.toMatchObject({ targetLanguage: "en" });
    expect(fetch).toHaveBeenCalledWith("http://localhost:3000/me/languages", {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        instructionLanguage: "pt",
        targetLanguage: "en",
      }),
    });
  });

  it("reports an expired authenticated session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );

    await expect(
      saveLanguageSelection("http://localhost:3000", {
        instructionLanguage: "pt",
        targetLanguage: "en",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedLanguageSelectionError);
  });
});
