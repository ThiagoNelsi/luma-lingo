import { createId, PrismaClient } from "@luma-lingo/database";

import type { AuthenticatedSessionProfile } from "../services/auth-profile.js";
import type { SessionRecord } from "../sessions/session-record.js";
import type { SessionRepository } from "../sessions/session-repository.js";
import {
  toAuthProfile,
  userWithLearnerArgs,
} from "./prisma-auth-profile-mapper.js";

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    now: Date,
  ): Promise<SessionRecord> {
    return this.prisma.session.create({
      data: {
        id: createId(),
        userId,
        tokenHash,
        expiresAt,
        lastSeenAt: now,
      },
    });
  }

  async findValidByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<AuthenticatedSessionProfile | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      relationLoadStrategy: "join",
      include: {
        user: userWithLearnerArgs,
      },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      !session.user.learner
    ) {
      return null;
    }

    this.prisma.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: now },
      })
      .then(() => {
        // We intentionally don't await this update to avoid delaying the response.
      });

    return {
      ...toAuthProfile(session.user),
      session: {
        ...session,
        lastSeenAt: now,
      },
    };
  }

  async revokeByTokenHash(tokenHash: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
