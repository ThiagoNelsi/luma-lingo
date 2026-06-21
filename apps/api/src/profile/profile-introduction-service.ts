import type { ProfileIntroductionProgress } from "@luma-lingo/shared";

import type { ProfileIntroductionRepository } from "./profile-introduction-repository.js";
import type {
  ProfileExtractionProvider,
  TranscriptionProvider,
} from "./profile-providers.js";

interface ProfileIntroductionServiceDependencies {
  repository: ProfileIntroductionRepository;
  transcription: TranscriptionProvider;
  extraction: ProfileExtractionProvider;
  schedule: (task: () => Promise<void>) => void;
  sleep?: (milliseconds: number) => Promise<void>;
  maxAttempts?: number;
}

export interface SubmittedAudio {
  audio: Buffer;
  mimeType: string;
}

export class ProfileIntroductionService {
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly maxAttempts: number;

  constructor(private readonly deps: ProfileIntroductionServiceDependencies) {
    this.sleep =
      deps.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.maxAttempts = deps.maxAttempts ?? 3;
  }

  async get(learnerId: string): Promise<ProfileIntroductionProgress> {
    return this.deps.repository.get(learnerId);
  }

  async submit(
    learnerId: string,
    instructionLanguage: string,
    input: SubmittedAudio,
  ): Promise<ProfileIntroductionProgress> {
    try {
      const progress = await this.deps.repository.markPending(learnerId);
      this.deps.schedule(() =>
        this.process(learnerId, instructionLanguage, input),
      );
      return progress;
    } catch (error) {
      input.audio.fill(0);
      throw error;
    }
  }

  async useManualFallback(
    learnerId: string,
  ): Promise<ProfileIntroductionProgress> {
    return this.deps.repository.markManualRequired(learnerId);
  }

  async recoverInterrupted(): Promise<number> {
    return this.deps.repository.failInterrupted();
  }

  private async process(
    learnerId: string,
    instructionLanguage: string,
    input: SubmittedAudio,
  ): Promise<void> {
    try {
      for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
        await this.deps.repository.markProcessing(learnerId, attempt);
        try {
          const transcript = await this.deps.transcription.transcribe({
            ...input,
            instructionLanguage,
          });
          const profile = await this.deps.extraction.extract(
            transcript,
            instructionLanguage,
          );
          await this.deps.repository.markCompleted(learnerId, profile);
          return;
        } catch {
          if (attempt === this.maxAttempts) break;
          await this.sleep(250 * 2 ** (attempt - 1));
        }
      }
      await this.deps.repository.markFailed(
        learnerId,
        "profile_processing_failed",
      );
    } finally {
      input.audio.fill(0);
    }
  }
}
