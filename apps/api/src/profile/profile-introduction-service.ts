import {
  confirmedProfileSchema,
  type ConfirmedProfile,
  type ProfileIntroductionProgress,
} from "@luma-lingo/shared";

import {
  createSilentLogger,
  errorMetadata,
  type AppLogger,
} from "../observability/logger.js";
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
  logger?: AppLogger;
  random?: () => number;
}

export interface SubmittedAudio {
  audio: Buffer;
  mimeType: string;
}

export class ProfileIntroductionService {
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly maxAttempts: number;
  private readonly logger: AppLogger;
  private readonly random: () => number;

  constructor(private readonly deps: ProfileIntroductionServiceDependencies) {
    this.sleep =
      deps.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.maxAttempts = deps.maxAttempts ?? 4;
    this.logger = deps.logger ?? createSilentLogger();
    this.random = deps.random ?? Math.random;
  }

  async get(learnerId: string): Promise<ProfileIntroductionProgress> {
    const progress = await this.deps.repository.get(learnerId);
    this.logger.debug(
      {
        event: "profile_introduction.queried",
        learnerId,
        status: progress.status,
      },
      "Profile introduction queried",
    );
    return progress;
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
      this.logger.info(
        {
          audioBytes: input.audio.length,
          event: "profile_introduction.submitted",
          learnerId,
          mimeType: input.mimeType,
        },
        "Profile introduction submitted",
      );
      return progress;
    } catch (error) {
      input.audio.fill(0);
      this.logger.error(
        {
          event: "profile_introduction.submission_failed",
          learnerId,
          ...errorMetadata(error),
        },
        "Profile introduction submission failed",
      );
      throw error;
    }
  }

  async useManualFallback(
    learnerId: string,
  ): Promise<ProfileIntroductionProgress> {
    const progress = await this.deps.repository.markManualRequired(learnerId);
    this.logger.info(
      { event: "profile_introduction.manual_fallback", learnerId },
      "Profile introduction manual fallback selected",
    );
    return progress;
  }

  async confirm(
    learnerId: string,
    profile: ConfirmedProfile,
  ): Promise<ProfileIntroductionProgress> {
    const confirmedProfile = confirmedProfileSchema.parse(profile);
    await this.deps.repository.confirmProfile(learnerId, confirmedProfile);
    this.logger.info(
      { event: "profile_introduction.confirmed", learnerId },
      "Profile introduction confirmed",
    );
    return this.deps.repository.get(learnerId);
  }

  async recoverInterrupted(): Promise<number> {
    const recovered = await this.deps.repository.failInterrupted();
    if (recovered > 0) {
      this.logger.warn(
        { event: "profile_introduction.interrupted_recovered", recovered },
        "Interrupted profile introductions marked as failed",
      );
    }
    return recovered;
  }

  private async process(
    learnerId: string,
    instructionLanguage: string,
    input: SubmittedAudio,
  ): Promise<void> {
    let finalErrorCode = "profile_processing_failed";
    let finalError: unknown;
    try {
      for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
        await this.deps.repository.markProcessing(learnerId, attempt);
        let stage: "transcription" | "extraction" = "transcription";
        try {
          const transcript = await this.deps.transcription.transcribe({
            ...input,
            instructionLanguage,
          });
          stage = "extraction";
          const profile = await this.deps.extraction.extract(
            transcript,
            instructionLanguage,
          );
          await this.deps.repository.markCompleted(learnerId, profile);
          this.logger.info(
            {
              attempt,
              event: "profile_introduction.completed",
              learnerId,
            },
            "Profile introduction completed",
          );
          return;
        } catch (error) {
          finalError = error;
          finalErrorCode = `profile_${stage}_failed`;
          const fields = {
            attempt,
            event: "profile_introduction.processing_failed",
            learnerId,
            stage,
            ...errorMetadata(error),
          };
          if (
            !isTransientProviderError(error) ||
            attempt === this.maxAttempts
          ) {
            break;
          }
          const retryDelayMs = retryDelayMilliseconds(
            attempt,
            retryAfterMilliseconds(error),
            this.random,
          );
          this.logger.warn(
            { ...fields, retryDelayMs },
            "Profile introduction processing failed; retrying",
          );
          await this.sleep(retryDelayMs);
        }
      }
      this.logger.error(
        {
          attempts: this.maxAttempts,
          errorCode: finalErrorCode,
          event: "profile_introduction.failed",
          learnerId,
          ...errorMetadata(finalError),
        },
        "Profile introduction failed after all attempts",
      );
      await this.deps.repository.markFailed(learnerId, finalErrorCode);
    } catch (error) {
      this.logger.error(
        {
          event: "profile_introduction.persistence_failed",
          learnerId,
          ...errorMetadata(error),
        },
        "Profile introduction processing could not be persisted",
      );
    } finally {
      input.audio.fill(0);
    }
  }
}

export function isTransientProviderError(error: unknown): boolean {
  const status = providerErrorStatus(error);
  return (
    status === 408 || status === 429 || (status !== undefined && status >= 500)
  );
}

export function retryDelayMilliseconds(
  attempt: number,
  retryAfterMs: number | undefined,
  random: () => number = Math.random,
): number {
  const backoffMs = 1_000 * 2 ** (attempt - 1);
  const jitterMs = Math.floor(random() * Math.min(backoffMs, 1_000));
  return Math.max(backoffMs + jitterMs, retryAfterMs ?? 0);
}

function providerErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error) || typeof error.status !== "number") return undefined;
  return error.status;
}

function retryAfterMilliseconds(error: unknown): number | undefined {
  if (!isRecord(error) || typeof error.retryAfterMilliseconds !== "number") {
    return undefined;
  }
  return error.retryAfterMilliseconds;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
