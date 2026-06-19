import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMe, UnauthorizedSessionError } from "./me-client.js";

describe("fetchMe", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads and parses the authenticated learner response", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { primaryEmail: "learner@example.com" },
          learner: { displayName: "Thiago" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(fetchMe("http://localhost:3000/")).resolves.toEqual({
      user: { primaryEmail: "learner@example.com" },
      learner: { displayName: "Thiago" },
    });
    expect(fetch).toHaveBeenCalledWith("http://localhost:3000/me", {
      credentials: "include",
    });
  });

  it("reports unauthenticated sessions explicitly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );

    await expect(fetchMe("http://localhost:3000")).rejects.toBeInstanceOf(
      UnauthorizedSessionError,
    );
  });
});
