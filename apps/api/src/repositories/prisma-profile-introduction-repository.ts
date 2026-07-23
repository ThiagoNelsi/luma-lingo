import type {
  ConfirmedProfile,
  ExtractedProfile,
  ProfileIntroductionProgress,
} from "@luma-lingo/shared";
import { createId, PrismaClient } from "@luma-lingo/database";

import type { ProfileIntroductionRepository } from "../profile/profile-introduction-repository.js";

interface PersistedProfileIntroduction {
  status: ProfileIntroductionProgress["status"];
  confirmedAt: Date | null;
  attempts: number;
  errorCode: string | null;
  jobOrField: string | null;
  interests: string[];
  other: string[];
}

export function toProfileIntroductionProgress(
  value: PersistedProfileIntroduction | null,
): ProfileIntroductionProgress {
  if (!value)
    return {
      status: "not_started",
      confirmed: false,
      attempts: 0,
      errorCode: null,
      profile: null,
    };
  return {
    status: value.status,
    confirmed: value.confirmedAt !== null,
    attempts: value.attempts,
    errorCode: value.errorCode,
    profile:
      value.status === "completed"
        ? {
            jobOrField: value.jobOrField,
            interests: value.interests,
            other: value.other,
          }
        : null,
  };
}

export class PrismaProfileIntroductionRepository implements ProfileIntroductionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async get(learnerId: string) {
    return toProfileIntroductionProgress(
      await this.prisma.profileIntroduction.findUnique({
        where: { learnerId },
      }),
    );
  }

  async markPending(learnerId: string) {
    const value = await this.prisma.profileIntroduction.upsert({
      where: { learnerId },
      create: { id: createId(), learnerId, status: "pending" },
      update: {
        status: "pending",
        attempts: 0,
        errorCode: null,
        jobOrField: null,
        interests: [],
        other: [],
        confirmedAt: null,
      },
    });
    return toProfileIntroductionProgress(value);
  }

  async markProcessing(learnerId: string, attempts: number): Promise<void> {
    await this.prisma.profileIntroduction.updateMany({
      where: { learnerId, confirmedAt: null },
      data: { status: "processing", attempts, errorCode: null },
    });
  }

  async markCompleted(
    learnerId: string,
    profile: ExtractedProfile,
  ): Promise<void> {
    await this.prisma.profileIntroduction.updateMany({
      where: { learnerId, confirmedAt: null },
      data: { status: "completed", errorCode: null, ...profile },
    });
  }

  async markFailed(learnerId: string, errorCode: string): Promise<void> {
    await this.prisma.profileIntroduction.updateMany({
      where: { learnerId, confirmedAt: null },
      data: { status: "failed", errorCode },
    });
  }

  async markManualRequired(learnerId: string) {
    const value = await this.prisma.profileIntroduction.upsert({
      where: { learnerId },
      create: { id: createId(), learnerId, status: "manual_required" },
      update: { status: "manual_required", errorCode: null },
    });
    return toProfileIntroductionProgress(value);
  }

  async confirmProfile(
    learnerId: string,
    profile: ConfirmedProfile,
  ): Promise<void> {
    await this.prisma.profileIntroduction.upsert({
      where: { learnerId },
      create: {
        id: createId(),
        learnerId,
        status: "completed",
        ...profile,
        confirmedAt: new Date(),
      },
      update: {
        status: "completed",
        errorCode: null,
        ...profile,
        confirmedAt: new Date(),
      },
    });
  }

  async failInterrupted(): Promise<number> {
    const result = await this.prisma.profileIntroduction.updateMany({
      where: {
        status: { in: ["pending", "processing"] },
        confirmedAt: null,
      },
      data: { status: "failed", errorCode: "processing_interrupted" },
    });
    return result.count;
  }
}
