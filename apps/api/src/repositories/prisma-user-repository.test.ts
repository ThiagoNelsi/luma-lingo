import type { PrismaClient } from "@luma-lingo/database";
import { describe, expect, it } from "vitest";

import { PrismaUserRepository } from "./prisma-user-repository.js";

type TransactionFake = {
  authIdentity: {
    findUnique: () => Promise<unknown>;
    update: (input: { data: Record<string, unknown> }) => Promise<unknown>;
  };
  user: {
    update: () => Promise<unknown>;
  };
};

describe("PrismaUserRepository", () => {
  it("preserves the first provider email on returning logins", async () => {
    const existingUser = {
      id: "user-1",
      primaryEmail: "first@example.com",
      emailVerifiedAt: new Date("2026-06-18T12:00:00.000Z"),
      createdAt: new Date("2026-06-18T12:00:00.000Z"),
      updatedAt: new Date("2026-06-18T12:00:00.000Z"),
      lastLoginAt: new Date("2026-06-18T12:00:00.000Z"),
      learner: {
        id: "learner-1",
        userId: "user-1",
        displayName: "Learner One",
        nativeLanguage: null,
        ageRange: null,
        ageRangeDeclaredAt: null,
        currentLearningTrackId: null,
        createdAt: new Date("2026-06-18T12:00:00.000Z"),
        updatedAt: new Date("2026-06-18T12:00:00.000Z"),
        currentLearningTrack: null,
      },
    };
    let authIdentityUpdateData: Record<string, unknown> | null = null;

    const tx: TransactionFake = {
      authIdentity: {
        findUnique: async () => ({
          id: "auth-identity-1",
          userId: "user-1",
          provider: "cognito",
          providerSubject: "cognito-sub-1",
          emailAtAuthTime: "first@example.com",
          createdAt: new Date("2026-06-18T12:00:00.000Z"),
          lastSeenAt: new Date("2026-06-18T12:00:00.000Z"),
          user: existingUser,
        }),
        update: async (input: { data: Record<string, unknown> }) => {
          authIdentityUpdateData = input.data;
          return {};
        },
      },
      user: {
        update: async () => ({
          ...existingUser,
          lastLoginAt: new Date("2026-06-18T12:05:00.000Z"),
        }),
      },
    };
    const prisma = {
      $transaction: async <T>(callback: (tx: TransactionFake) => Promise<T>) =>
        callback(tx),
    };
    const repository = new PrismaUserRepository(
      prisma as unknown as PrismaClient,
    );

    await repository.upsertVerifiedAuthIdentity({
      provider: "cognito",
      providerSubject: "cognito-sub-1",
      email: "changed@example.com",
      emailVerified: true,
      name: "Learner One",
    });

    expect(authIdentityUpdateData).toEqual({
      lastSeenAt: expect.any(Date),
    });
  });
});
