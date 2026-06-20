import { randomUUID } from "node:crypto";

import type { LanguageSelection } from "@luma-lingo/shared";

import type { AuthProvider } from "../../apps/api/src/auth/auth-provider.js";
import type { AppConfig } from "../../apps/api/src/config.js";
import { createApp } from "../../apps/api/src/http/app.js";
import type { LearnerRepository } from "../../apps/api/src/learners/learner-repository.js";
import { toLanguageSelectionProgress } from "../../apps/api/src/learners/language-selection-progress.js";
import type { UserRepository } from "../../apps/api/src/repositories/user-repository.js";
import type { AuthProfile } from "../../apps/api/src/services/auth-profile.js";
import type { SessionRecord } from "../../apps/api/src/sessions/session-record.js";
import type { SessionRepository } from "../../apps/api/src/sessions/session-repository.js";

const apiOrigin = "http://127.0.0.1:3100";
const frontendOrigin = "http://127.0.0.1:4173";
const config: AppConfig = {
  apiOrigin,
  authCallbackUrl: `${apiOrigin}/auth/callback`,
  authLogoutUrl: `${frontendOrigin}/login`,
  frontendOrigin,
  nodeEnv: "test",
  sessionCookieName: "luma_lingo_session",
  sessionCookieSecure: false,
  sessionTtlDays: 7,
};

let profile: AuthProfile | null = null;
const sessions = new Map<string, SessionRecord>();

const authProvider: AuthProvider = {
  getAuthorizationUrl({ state }) {
    return `${apiOrigin}/test-auth/authorize?state=${encodeURIComponent(state)}`;
  },
  async exchangeCode() {
    return {
      provider: "cognito",
      providerSubject: "e2e-learner",
      email: "e2e@example.com",
      emailVerified: true,
      name: "Pessoa estudante",
    };
  },
  async getLogoutUrl() {
    return `${frontendOrigin}/login`;
  },
};

const users: UserRepository = {
  async upsertVerifiedAuthIdentity(identity) {
    if (profile) return profile;
    const now = new Date();
    profile = {
      user: {
        id: randomUUID(),
        primaryEmail: identity.email,
        emailVerifiedAt: now,
        lastLoginAt: now,
      },
      learner: {
        id: randomUUID(),
        displayName: identity.name,
        instructionLanguage: null,
        ageRange: null,
        currentLearningTrackId: null,
      },
      currentLearningTrack: null,
    };
    return profile;
  },
};

const sessionRepository: SessionRepository = {
  async create(userId, tokenHash, expiresAt, now) {
    const session: SessionRecord = {
      id: randomUUID(),
      userId,
      tokenHash,
      expiresAt,
      lastSeenAt: now,
      revokedAt: null,
    };
    sessions.set(tokenHash, session);
    return session;
  },
  async findValidByTokenHash(tokenHash, now) {
    const session = sessions.get(tokenHash);
    if (!session || !profile || session.expiresAt <= now || session.revokedAt) {
      return null;
    }
    session.lastSeenAt = now;
    return { ...profile, session };
  },
  async revokeByTokenHash(tokenHash) {
    const session = sessions.get(tokenHash);
    if (session) session.revokedAt = new Date();
  },
};

const learners: LearnerRepository = {
  async saveLanguageSelection(_learnerId, selection: LanguageSelection) {
    if (!profile) throw new Error("learner_not_found");
    const trackId = profile.currentLearningTrack?.id ?? randomUUID();
    profile = {
      ...profile,
      learner: {
        ...profile.learner,
        instructionLanguage: selection.instructionLanguage,
        currentLearningTrackId: trackId,
      },
      currentLearningTrack: {
        id: trackId,
        targetLanguage: selection.targetLanguage,
        level: null,
        learningGoal: null,
        onboardingStatus: "in_progress",
        onboardingStep: "languages",
      },
    };
    return toLanguageSelectionProgress(selection);
  },
};

const app = await createApp({
  authProvider,
  config,
  learners,
  sessions: sessionRepository,
  users,
});

app.get("/test-auth/authorize", async (request, reply) => {
  const { state } = request.query as { state: string };
  return reply.redirect(
    `${config.authCallbackUrl}?code=e2e-code&state=${encodeURIComponent(state)}`,
  );
});

await app.listen({ host: "127.0.0.1", port: 3100 });
