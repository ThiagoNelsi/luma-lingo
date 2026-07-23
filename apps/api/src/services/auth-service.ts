import { randomBytes, timingSafeEqual } from "node:crypto";

import type { AuthIdentity } from "../auth/auth-identity.js";
import type { AppConfig } from "../config.js";
import { createSilentLogger, type AppLogger } from "../observability/logger.js";
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
    private readonly logger: AppLogger = createSilentLogger(),
  ) {}

  createOAuthState(): string {
    this.logger.info(
      { event: "auth.oauth_state.created" },
      "OAuth state created",
    );
    return randomToken();
  }

  validateOAuthState(
    expected: string | undefined,
    actual: string | undefined,
  ): boolean {
    if (!expected || !actual) {
      this.logger.warn(
        { event: "auth.oauth_state.invalid", reason: "missing_state" },
        "OAuth state validation failed",
      );
      return false;
    }

    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);
    if (expectedBuffer.length !== actualBuffer.length) {
      this.logger.warn(
        { event: "auth.oauth_state.invalid", reason: "length_mismatch" },
        "OAuth state validation failed",
      );
      return false;
    }

    const valid = timingSafeEqual(expectedBuffer, actualBuffer);
    if (!valid) {
      this.logger.warn(
        { event: "auth.oauth_state.invalid", reason: "value_mismatch" },
        "OAuth state validation failed",
      );
    }
    return valid;
  }

  async completeLogin(identity: AuthIdentity): Promise<{
    profile: AuthProfile;
    sessionToken: string;
    session: SessionRecord;
  }> {
    if (!identity.emailVerified) {
      this.logger.warn(
        {
          event: "auth.login.rejected",
          provider: identity.provider,
          reason: "email_not_verified",
        },
        "Login rejected because email is not verified",
      );
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

    this.logger.info(
      {
        event: "auth.login.completed",
        learnerId: profile.learner.id,
        provider: identity.provider,
        userId: profile.user.id,
      },
      "Login completed",
    );

    return { profile, sessionToken, session };
  }

  async resolveSession(
    sessionToken: string | undefined,
  ): Promise<AuthenticatedSessionProfile | null> {
    if (!sessionToken) return null;

    const session = await this.sessions.findValidByTokenHash(
      hashSessionToken(sessionToken),
      new Date(),
    );
    if (!session) {
      this.logger.debug(
        { event: "auth.session.not_found" },
        "No valid session found",
      );
    } else {
      this.logger.debug(
        {
          event: "auth.session.resolved",
          learnerId: session.learner.id,
          userId: session.user.id,
        },
        "Valid session resolved",
      );
    }
    return session;
  }

  async revokeSession(sessionToken: string | undefined): Promise<void> {
    if (!sessionToken) return;
    await this.sessions.revokeByTokenHash(hashSessionToken(sessionToken));
    this.logger.info({ event: "auth.session.revoked" }, "Session revoked");
  }
}

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}
