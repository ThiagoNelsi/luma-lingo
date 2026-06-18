import { createId, PrismaClient } from "@luma-lingo/database";

import type { AuthIdentity } from "../auth/auth-identity.js";
import type { AuthProfile } from "../services/auth-profile.js";
import {
  toAuthProfile,
  userWithLearnerArgs,
} from "./prisma-auth-profile-mapper.js";
import type { UserRepository } from "./user-repository.js";

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertVerifiedAuthIdentity(
    identity: AuthIdentity,
  ): Promise<AuthProfile> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.authIdentity.findUnique({
        where: {
          provider_providerSubject: {
            provider: identity.provider,
            providerSubject: identity.providerSubject,
          },
        },
        include: {
          user: userWithLearnerArgs,
        },
      });

      if (existing) {
        const now = new Date();
        await tx.authIdentity.update({
          where: { id: existing.id },
          data: {
            lastSeenAt: now,
          },
        });
        const user = await tx.user.update({
          where: { id: existing.userId },
          data: { lastLoginAt: now },
          ...userWithLearnerArgs,
        });
        return toAuthProfile(user);
      }

      const now = new Date();
      const user = await tx.user.create({
        data: {
          id: createId(),
          primaryEmail: identity.email,
          emailVerifiedAt: now,
          lastLoginAt: now,
          authIdentities: {
            create: {
              id: createId(),
              provider: identity.provider,
              providerSubject: identity.providerSubject,
              emailAtAuthTime: identity.email,
              lastSeenAt: now,
            },
          },
          learner: {
            create: {
              id: createId(),
              displayName: identity.name,
            },
          },
        },
        ...userWithLearnerArgs,
      });

      return toAuthProfile(user);
    });
  }
}
