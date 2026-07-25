import { describe, expect, it, vi } from "vitest";

import { fetchHome, UnauthorizedHomeError } from "./home-client.js";

describe("fetchHome", () => {
  it("returns the public ready Lesson state without provider or block internals", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ready",
          lessonId: "f7e1918b-78b8-47e3-b0d9-2d6597542c00",
        }),
        { status: 200 },
      ),
    );

    await expect(
      fetchHome("http://localhost:3000", fetch),
    ).resolves.toMatchObject({
      status: "ready",
    });
  });

  it("reports expired sessions distinctly", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }));

    await expect(
      fetchHome("http://localhost:3000", fetch),
    ).rejects.toBeInstanceOf(UnauthorizedHomeError);
  });
});
