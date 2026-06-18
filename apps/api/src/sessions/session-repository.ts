import type { AuthenticatedSessionProfile } from "../services/auth-profile.js";
import type { SessionRecord } from "./session-record.js";

export interface SessionRepository {
  create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    now: Date,
  ): Promise<SessionRecord>;
  findValidByTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<AuthenticatedSessionProfile | null>;
  revokeByTokenHash(tokenHash: string): Promise<void>;
}
