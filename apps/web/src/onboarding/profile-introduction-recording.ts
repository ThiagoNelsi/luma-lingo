export interface ProfileIntroductionRecording {
  audio: Blob;
  durationMs: number;
}

let recording: ProfileIntroductionRecording | null = null;

export function saveProfileIntroductionRecording(
  nextRecording: ProfileIntroductionRecording,
): void {
  recording = nextRecording;
}

export function getProfileIntroductionRecording(): ProfileIntroductionRecording | null {
  return recording;
}

export function clearProfileIntroductionRecording(): void {
  recording = null;
}
