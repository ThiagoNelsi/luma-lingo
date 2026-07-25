import { describe, expect, it } from "vitest";

import { previousBlockIndex } from "./home-page.js";

describe("previousBlockIndex", () => {
  it("moves one visible Lesson block back without going before the first block", () => {
    expect(previousBlockIndex(2)).toBe(1);
    expect(previousBlockIndex(0)).toBe(0);
  });
});
