import type { CSSProperties } from "react";

const waveformBarHeights = [
  3, 7, 12, 20, 28, 20, 12, 28, 7, 3, 14, 28, 20, 7, 3, 14, 28, 20, 7, 14, 3,
  20, 14, 7, 28, 3, 14, 20,
];

interface RecordingWaveformProps {
  recording: boolean;
}

interface WaveformBarStyle extends CSSProperties {
  "--waveform-delay": string;
  "--waveform-height": string;
}

export function RecordingWaveform({ recording }: RecordingWaveformProps) {
  return (
    <div
      aria-hidden="true"
      className={`recording-waveform flex h-10 items-center justify-center gap-[3px] ${
        recording ? "text-accent" : "text-muted"
      }`}
      data-recording={recording}
    >
      {waveformBarHeights.map((height, index) => (
        <span
          className="recording-waveform-bar w-[3px] rounded-full bg-current"
          key={index}
          style={
            {
              "--waveform-delay": `${index * 45}ms`,
              "--waveform-height": `${height}px`,
            } as WaveformBarStyle
          }
        />
      ))}
    </div>
  );
}
