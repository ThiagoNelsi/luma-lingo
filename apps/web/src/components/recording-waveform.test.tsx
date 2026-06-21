import { describe, expect, it } from "vitest";

import { RecordingWaveform } from "./recording-waveform.js";

describe("RecordingWaveform", () => {
  it("renders the reference waveform bars with staggered timing", () => {
    const element = RecordingWaveform({ recording: false });
    const bars = element.props.children;

    expect(bars).toHaveLength(28);
    expect(bars[0].props.style).toMatchObject({
      "--waveform-delay": "0ms",
      "--waveform-height": "3px",
    });
    expect(bars[1].props.style).toMatchObject({
      "--waveform-delay": "45ms",
      "--waveform-height": "7px",
    });
  });

  it("uses the accent color while recording", () => {
    const element = RecordingWaveform({ recording: true });

    expect(element.props["data-recording"]).toBe(true);
    expect(element.props.className).toContain("text-accent");
    expect(element.props.className).not.toContain("text-muted");
  });
});
