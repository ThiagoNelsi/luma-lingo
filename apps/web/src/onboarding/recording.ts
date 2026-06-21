const recordingMimeTypes = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg",
];

export function formatRecordingTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1_000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function preferredRecordingMimeType(
  isSupported: (mimeType: string) => boolean,
): string {
  return recordingMimeTypes.find(isSupported) ?? "";
}
