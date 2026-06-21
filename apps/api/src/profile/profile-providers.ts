import type { ExtractedProfile } from "@luma-lingo/shared";

export interface TranscriptionInput {
  audio: Buffer;
  mimeType: string;
  instructionLanguage: string;
}

export interface TranscriptionProvider {
  transcribe(input: TranscriptionInput): Promise<string>;
}

export interface ProfileExtractionProvider {
  extract(
    transcript: string,
    instructionLanguage: string,
  ): Promise<ExtractedProfile>;
}
