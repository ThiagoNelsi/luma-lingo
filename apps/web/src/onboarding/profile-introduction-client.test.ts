import { afterEach, describe, expect, it, vi } from "vitest";

import {
  confirmProfileIntroduction,
  getProfileIntroduction,
  submitProfileIntroduction,
  UnauthorizedProfileIntroductionError,
  useManualProfileIntroduction,
} from "./profile-introduction-client.js";

afterEach(() => vi.unstubAllGlobals());

const progress = {
  status: "pending",
  confirmed: false,
  attempts: 0,
  errorCode: null,
  profile: null,
};

describe("profile introduction client", () => {
  it("submits audio metadata with the authenticated session", async () => {
    const fetch = vi.fn(
      async () => new Response(JSON.stringify(progress), { status: 202 }),
    );
    vi.stubGlobal("fetch", fetch);
    const audio = new Blob(["audio"], { type: "audio/webm" });
    await expect(
      submitProfileIntroduction("http://localhost:3000/", audio, 1_500),
    ).resolves.toMatchObject(progress);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/me/profile-introduction",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: expect.any(FormData),
      }),
    );
  });

  it("loads status and selects manual fallback", async () => {
    const fetch = vi.fn(
      async () => new Response(JSON.stringify(progress), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetch);
    await getProfileIntroduction("http://localhost:3000");
    await useManualProfileIntroduction("http://localhost:3000");
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3000/me/profile-introduction",
      { credentials: "include" },
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3000/me/profile-introduction/manual",
      { method: "POST", credentials: "include" },
    );
  });

  it("persists the learner-confirmed profile", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ...progress,
            status: "completed",
            profile: {
              jobOrField: "Professora",
              interests: ["cinema"],
              dailyRoutine: [],
              studyContext: null,
              other: [],
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await confirmProfileIntroduction("http://localhost:3000", {
      jobOrField: "Professora",
      interests: ["cinema"],
      dailyRoutine: [],
      studyContext: null,
      other: [],
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3000/me/profile-introduction/confirm",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          jobOrField: "Professora",
          interests: ["cinema"],
          dailyRoutine: [],
          studyContext: null,
          other: [],
        }),
      }),
    );
  });

  it("reports an expired session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    await expect(
      getProfileIntroduction("http://localhost:3000"),
    ).rejects.toBeInstanceOf(UnauthorizedProfileIntroductionError);
  });
});
