import { randomBytes, timingSafeEqual } from "node:crypto";

import type { AuthIdentity } from "../auth/auth-identity.js";
import type { AppConfig } from "../config.js";
import type { UserRepository } from "../repositories/user-repository.js";
import type { SessionRepository } from "../sessions/session-repository.js";
import type { SessionRecord } from "../sessions/session-record.js";
import { hashSessionToken } from "../sessions/session-token.js";
import { UnverifiedEmailError } from "./auth-errors.js";
import type {
  AuthenticatedSessionProfile,
  AuthProfile,
} from "./auth-profile.js";

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly config: AppConfig,
  ) {}

  createOAuthState(): string {
    return randomToken();
  }

  validateOAuthState(
    expected: string | undefined,
    actual: string | undefined,
  ): boolean {
    if (!expected || !actual) return false;

    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);
    if (expectedBuffer.length !== actualBuffer.length) return false;

    return timingSafeEqual(expectedBuffer, actualBuffer);
  }

  async completeLogin(identity: AuthIdentity): Promise<{
    profile: AuthProfile;
    sessionToken: string;
    session: SessionRecord;
  }> {
    if (!identity.emailVerified) {
      throw new UnverifiedEmailError("email_not_verified");
    }

    const profile = await this.users.upsertVerifiedAuthIdentity(identity);
    const sessionToken = randomToken();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.config.sessionTtlDays * 24 * 60 * 60 * 1000,
    );
    const session = await this.sessions.create(
      profile.user.id,
      hashSessionToken(sessionToken),
      expiresAt,
      now,
    );

    return { profile, sessionToken, session };
  }

  async resolveSession(
    sessionToken: string | undefined,
  ): Promise<AuthenticatedSessionProfile | null> {
    if (!sessionToken) return null;

    return this.sessions.findValidByTokenHash(
      hashSessionToken(sessionToken),
      new Date(),
    );
  }

  async revokeSession(sessionToken: string | undefined): Promise<void> {
    if (!sessionToken) return;
    await this.sessions.revokeByTokenHash(hashSessionToken(sessionToken));
  }
}

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}
