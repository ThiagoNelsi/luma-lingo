import type { AuthIdentity } from "../auth/auth-identity.js";
import type { AuthProfile } from "../services/auth-profile.js";

export interface UserRepository {
  upsertVerifiedAuthIdentity(identity: AuthIdentity): Promise<AuthProfile>;
}
