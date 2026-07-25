import { describe, expect, it, vi } from "vitest";

import { UnauthorizedHomeError } from "../home/home-client.js";
import { previousBlockIndex, resolveLessonRetry } from "./home-page.js";

describe("previousBlockIndex", () => {
  it("moves one visible Lesson block back without going before the first block", () => {
    expect(previousBlockIndex(2)).toBe(1);
    expect(previousBlockIndex(0)).toBe(0);
  });
});

describe("resolveLessonRetry", () => {
  const home = {
    status: "ready" as const,
    lessonId: "f7e1918b-78b8-47e3-b0d9-2d6597542c00",
  };
  const lesson = {
    lessonId: home.lessonId,
    blocks: [],
    nextBlockStatus: "failed" as const,
  };

  it("moves a partial Lesson back to preparing after an accepted retry", async () => {
    await expect(
      resolveLessonRetry("http://localhost:3000", home, lesson, vi.fn()),
    ).resolves.toMatchObject({
      status: "waiting",
      lesson: { nextBlockStatus: "preparing" },
    });
  });

  it("reports failed and unauthenticated retry outcomes distinctly", async () => {
    await expect(
      resolveLessonRetry(
        "http://localhost:3000",
        home,
        lesson,
        vi.fn(async () => {
          throw new Error("network");
        }),
      ),
    ).resolves.toEqual({ status: "failed" });
    await expect(
      resolveLessonRetry(
        "http://localhost:3000",
        home,
        lesson,
        vi.fn(async () => {
          throw new UnauthorizedHomeError("unauthenticated");
        }),
      ),
    ).resolves.toEqual({ status: "unauthenticated" });
  });
});
