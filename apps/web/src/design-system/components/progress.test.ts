import { describe, expect, it } from "vitest";

import type { ReactElement } from "react";

import { normalizeProgress, Progress } from "./progress.js";

describe("normalizeProgress", () => {
  it("keeps a value inside the range", () => {
    expect(normalizeProgress(3, 5)).toBe(3);
  });

  it("clamps values outside the range", () => {
    expect(normalizeProgress(-1, 5)).toBe(0);
    expect(normalizeProgress(8, 5)).toBe(5);
  });

  it("returns zero for invalid values", () => {
    expect(normalizeProgress(Number.NaN, 5)).toBe(0);
    expect(normalizeProgress(3, 0)).toBe(0);
  });
});

describe("Progress", () => {
  it("uses the calculated percentage as the indicator width", () => {
    const progress = Progress({ label: "Course progress", value: 25 });
    const indicator = progress.props.children as ReactElement<{
      className: string;
      style: Record<string, string>;
    }>;

    expect(indicator.props.className).toContain("w-[var(--progress-value)]");
    expect(indicator.props.style).toEqual({ "--progress-value": "25%" });
  });
});
