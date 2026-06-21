import { afterEach, describe, expect, it, vi } from "vitest";

import { saveLessonPreferences } from "./lesson-preferences-client.js";

describe("Lesson preferences client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("saves the selection with credentials and parses its progress", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          lessonEmphases: ["listening", "reading"],
          studyPace: null,
          onboardingStatus: "in_progress",
          onboardingStep: "lesson_preferences",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveLessonPreferences("http://localhost:3000/", {
        lessonEmphases: ["listening", "reading"],
        studyPace: null,
      }),
    ).resolves.toMatchObject({ onboardingStep: "lesson_preferences" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/me/lesson-preferences",
      expect.objectContaining({
        method: "PUT",
        credentials: "include",
        body: JSON.stringify({
          lessonEmphases: ["listening", "reading"],
          studyPace: null,
        }),
      }),
    );
  });
});
