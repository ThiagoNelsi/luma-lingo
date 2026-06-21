import type {
  ExtractedProfile,
  ProfileIntroductionProgress,
} from "@luma-lingo/shared";

export interface ProfileIntroductionRepository {
  get(learnerId: string): Promise<ProfileIntroductionProgress>;
  markPending(learnerId: string): Promise<ProfileIntroductionProgress>;
  markProcessing(learnerId: string, attempts: number): Promise<void>;
  markCompleted(learnerId: string, profile: ExtractedProfile): Promise<void>;
  markFailed(learnerId: string, errorCode: string): Promise<void>;
  markManualRequired(learnerId: string): Promise<ProfileIntroductionProgress>;
  failInterrupted(): Promise<number>;
}
