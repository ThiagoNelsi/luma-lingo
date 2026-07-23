import { randomUUID } from "node:crypto";

import type {
  AgeAndGoalsSelection,
  ConfirmedProfile,
  ExtractedProfile,
  ProfileIntroductionStatus,
  LanguageSelection,
  LessonPreferencesSelection,
  OnboardingStartingPointSelection,
} from "@luma-lingo/shared";

import type { AuthProvider } from "../../apps/api/src/auth/auth-provider.js";
import type { AppConfig } from "../../apps/api/src/config.js";
import type { DiagnosticAttempt } from "../../apps/api/src/diagnostics/diagnostic-attempt.js";
import type { DiagnosticAttemptRepository } from "../../apps/api/src/diagnostics/diagnostic-attempt-repository.js";
import type { InitialDiagnosticRuntimeService } from "../../apps/api/src/diagnostics/initial-diagnostic-runtime-service.js";
import { createApp } from "../../apps/api/src/http/app.js";
import type { LearnerRepository } from "../../apps/api/src/learners/learner-repository.js";
import type { OnboardingCompletionRepository } from "../../apps/api/src/learners/onboarding-completion-repository.js";
import type { ProfileIntroductionRepository } from "../../apps/api/src/profile/profile-introduction-repository.js";
import { ProfileIntroductionService } from "../../apps/api/src/profile/profile-introduction-service.js";
import { toLanguageSelectionProgress } from "../../apps/api/src/learners/language-selection-progress.js";
import { toLessonPreferencesProgress } from "../../apps/api/src/learners/lesson-preferences-progress.js";
import { toOnboardingStartingPointProgress } from "../../apps/api/src/learners/onboarding-starting-point-progress.js";
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
let completedDiagnosticAttempt: DiagnosticAttempt | null = null;
let answeredDiagnosticItemCount = 0;
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
        goalCefrLevel: null,
        additionalGoals: [],
        lessonEmphases: [],
        studyPace: null,
        onboardingStartingPoint: null,
        onboardingStatus: "in_progress",
        onboardingStep: "languages",
      },
    };
    return toLanguageSelectionProgress(selection);
  },
  async saveAgeAndGoals(_learnerId, selection: AgeAndGoalsSelection) {
    if (!profile?.currentLearningTrack) throw new Error("learner_not_found");
    profile = {
      ...profile,
      learner: {
        ...profile.learner,
        ageRange: selection.ageRange,
        displayName: selection.displayName,
      },
      currentLearningTrack: {
        ...profile.currentLearningTrack,
        learningGoal: selection.primaryGoal,
        goalCefrLevel: selection.cefrGoalLevel,
        additionalGoals: selection.additionalGoals,
        onboardingStep: "age_and_goals",
      },
    };
    return {
      ...selection,
      onboardingStatus: "in_progress",
      onboardingStep: "age_and_goals",
    };
  },
  async saveLessonPreferences(
    _learnerId,
    selection: LessonPreferencesSelection,
  ) {
    if (!profile?.currentLearningTrack) throw new Error("learner_not_found");
    profile = {
      ...profile,
      currentLearningTrack: {
        ...profile.currentLearningTrack,
        lessonEmphases: selection.lessonEmphases,
        studyPace: selection.studyPace,
        onboardingStep: "lesson_preferences",
      },
    };
    return toLessonPreferencesProgress(selection);
  },
  async saveOnboardingStartingPoint(
    _learnerId,
    selection: OnboardingStartingPointSelection,
  ) {
    if (!profile?.currentLearningTrack) throw new Error("learner_not_found");
    profile = {
      ...profile,
      currentLearningTrack: {
        ...profile.currentLearningTrack,
        onboardingStartingPoint: selection.onboardingStartingPoint,
        onboardingStep: "starting_point",
      },
    };
    return toOnboardingStartingPointProgress(selection);
  },
};

const onboardingCompletion: OnboardingCompletionRepository = {
  async completeBeginnerOnboarding(input) {
    return completeCurrentLearningTrack(input.learningTrackId);
  },
  async completeDiagnosticOnboarding(input) {
    return completeCurrentLearningTrack(input.learningTrackId);
  },
};

const initialLearningPriorities = {
  async findInitialLearningPriority(input: {
    onboardingStartingPoint: "beginner" | "diagnostic";
  }) {
    return {
      competencyId: "synthetic-competency-1",
      competencyKey: "en.synthetic.foundation.pre_a1",
      score: 205,
      readiness: 1,
      foundationWeight: 100,
      basePriority: 40,
      goalFit: 0,
      knowledgeGap: 1,
      uncertainty: 1,
      reviewNeed: 0,
      recentRepetition: 0,
      selectionReason:
        input.onboardingStartingPoint === "beginner"
          ? ("beginner_pre_a1_foundation" as const)
          : ("diagnostic_ranking" as const),
    };
  },
};

const diagnosticAttempts: DiagnosticAttemptRepository = {
  async findInProgressAttempt() {
    return null;
  },
  async findCompletedAttempt() {
    return completedDiagnosticAttempt;
  },
  async createAttempt() {
    throw new Error("unused");
  },
  async findAttemptItems() {
    return [];
  },
  async abandonAttempt() {
    throw new Error("unused");
  },
  async createAttemptItem() {
    throw new Error("unused");
  },
  async answerAttemptItem() {
    throw new Error("unused");
  },
  async completeAttempt() {
    throw new Error("unused");
  },
};

const initialDiagnostic = {
  async startInitialDiagnostic() {
    if (completedDiagnosticAttempt) {
      return {
        attempt: {
          id: completedDiagnosticAttempt.id,
          status: "completed" as const,
          summary: completedDiagnosticAttempt.summary,
        },
        item: null,
      };
    }

    if (answeredDiagnosticItemCount === 1) {
      return {
        attempt: {
          id: "attempt-1",
          status: "in_progress" as const,
        },
        item: {
          attemptItemId: "attempt-item-2",
          position: 2,
          diagnosticItemId: "item-2",
          key: "synthetic.diag.item-2",
          responseFormat: "multiple_choice" as const,
          prompt: {
            schemaVersion: 1 as const,
            kind: "multiple_choice" as const,
            instructionLocalizations: {
              pt: "Escolha a melhor resposta.",
            },
            contentLanguage: "en" as const,
            stem: "Synthetic prompt two.",
            options: [
              { id: "option_c", text: "Synthetic option C" },
              { id: "option_d", text: "Synthetic option D" },
            ],
          },
        },
      };
    }

    return {
      attempt: {
        id: "attempt-1",
        status: "in_progress" as const,
      },
      item: {
        attemptItemId: "attempt-item-1",
        position: 1,
        diagnosticItemId: "item-1",
        key: "synthetic.diag.item-1",
        responseFormat: "multiple_choice" as const,
        prompt: {
          schemaVersion: 1 as const,
          kind: "multiple_choice" as const,
          instructionLocalizations: {
            pt: "Escolha a melhor resposta.",
          },
          contentLanguage: "en" as const,
          stem: "Synthetic prompt one.",
          options: [
            { id: "option_a", text: "Synthetic option A" },
            { id: "option_b", text: "Synthetic option B" },
          ],
        },
      },
    };
  },
  async answerInitialDiagnosticItem(input: { learningTrackId: string }) {
    answeredDiagnosticItemCount += 1;
    if (answeredDiagnosticItemCount === 1) {
      return {
        attempt: {
          id: "attempt-1",
          status: "in_progress" as const,
        },
        item: {
          attemptItemId: "attempt-item-2",
          position: 2,
          diagnosticItemId: "item-2",
          key: "synthetic.diag.item-2",
          responseFormat: "multiple_choice" as const,
          prompt: {
            schemaVersion: 1 as const,
            kind: "multiple_choice" as const,
            instructionLocalizations: {
              pt: "Escolha a melhor resposta.",
            },
            contentLanguage: "en" as const,
            stem: "Synthetic prompt two.",
            options: [
              { id: "option_c", text: "Synthetic option C" },
              { id: "option_d", text: "Synthetic option D" },
            ],
          },
        },
      };
    }

    completedDiagnosticAttempt = {
      id: "attempt-1",
      learningTrackId: input.learningTrackId,
      catalogId: "catalog-1",
      purpose: "onboarding_initial",
      status: "completed",
      selectionPolicyVersion: "initial-diagnostic-selection-v1",
      scoringPolicyVersion: "initial-diagnostic-scoring-v1",
      startedAt: new Date(),
      completedAt: new Date(),
      abandonedAt: null,
      summary: {
        schemaVersion: 1,
        answeredItemCount: 1,
      },
      details: {},
    };

    return {
      attempt: {
        id: "attempt-1",
        status: "completed" as const,
        summary: completedDiagnosticAttempt.summary,
      },
      item: null,
    };
  },
} as unknown as InitialDiagnosticRuntimeService;

function completeCurrentLearningTrack(learningTrackId: string) {
  if (
    !profile?.currentLearningTrack ||
    profile.currentLearningTrack.id !== learningTrackId
  ) {
    throw new Error("learning_track_not_found");
  }

  profile = {
    ...profile,
    currentLearningTrack: {
      ...profile.currentLearningTrack,
      onboardingStatus: "completed",
      onboardingStep: null,
    },
  };

  return {
    onboardingStatus: "completed" as const,
    onboardingStep: null,
  };
}

let profileIntroductionStatus: ProfileIntroductionStatus = "not_started";
let profileIntroductionProfile: ExtractedProfile | null = null;
let profileIntroductionConfirmed = false;
const profileIntroductions: ProfileIntroductionRepository = {
  async get() {
    return {
      status: profileIntroductionStatus,
      confirmed: profileIntroductionConfirmed,
      attempts: 0,
      errorCode: null,
      profile: profileIntroductionProfile,
    };
  },
  async markPending() {
    profileIntroductionStatus = "pending";
    return {
      status: profileIntroductionStatus,
      confirmed: false,
      attempts: 0,
      errorCode: null,
      profile: null,
    };
  },
  async markProcessing() {},
  async markCompleted(_learnerId, extractedProfile) {
    profileIntroductionStatus = "completed";
    profileIntroductionConfirmed = false;
    profileIntroductionProfile = extractedProfile;
  },
  async markFailed() {
    profileIntroductionStatus = "failed";
  },
  async markManualRequired() {
    profileIntroductionStatus = "manual_required";
    return {
      status: profileIntroductionStatus,
      confirmed: false,
      attempts: 0,
      errorCode: null,
      profile: null,
    };
  },
  async confirmProfile(_learnerId, confirmedProfile: ConfirmedProfile) {
    profileIntroductionStatus = "completed";
    profileIntroductionConfirmed = true;
    profileIntroductionProfile = confirmedProfile;
  },
  async failInterrupted() {
    return 0;
  },
};
const profileIntroduction = new ProfileIntroductionService({
  repository: profileIntroductions,
  transcription: {
    async transcribe() {
      return "Gosto de viajar.";
    },
  },
  extraction: {
    async extract() {
      return {
        jobOrField: null,
        interests: ["viagens"],
        dailyRoutine: [],
        studyContext: null,
        other: [],
      };
    },
  },
  schedule(task) {
    setImmediate(() => void task());
  },
});

const app = await createApp({
  authProvider,
  config,
  learners,
  onboardingCompletion,
  diagnosticAttempts,
  initialLearningPriorities,
  sessions: sessionRepository,
  users,
  profileIntroduction,
  initialDiagnostic,
});

app.get("/test-auth/authorize", async (request, reply) => {
  const { state } = request.query as { state: string };
  return reply.redirect(
    `${config.authCallbackUrl}?code=e2e-code&state=${encodeURIComponent(state)}`,
  );
});

app.post("/test-control/reset", async (_request, reply) => {
  profile = null;
  completedDiagnosticAttempt = null;
  answeredDiagnosticItemCount = 0;
  profileIntroductionStatus = "not_started";
  profileIntroductionProfile = null;
  profileIntroductionConfirmed = false;
  sessions.clear();
  return reply.code(204).send();
});

app.post("/test-control/seed", async (request, reply) => {
  if (!profile) {
    return reply.code(409).send({ error: "authenticated_profile_required" });
  }

  const { state } = request.body as { state?: string };
  if (
    state !== "starting-point" &&
    state !== "profile-introduction" &&
    state !== "profile-introduction-under-13" &&
    state !== "profile-review-pending" &&
    state !== "profile-review-failed" &&
    state !== "profile-review-diagnostic"
  ) {
    return reply.code(400).send({ error: "unsupported_seed_state" });
  }

  const learningTrackId = profile.currentLearningTrack?.id ?? randomUUID();
  const introductionStep =
    state === "profile-introduction" ||
    state === "profile-introduction-under-13";
  const profileReviewStep =
    state === "profile-review-pending" ||
    state === "profile-review-failed" ||
    state === "profile-review-diagnostic";

  profile = {
    ...profile,
    learner: {
      ...profile.learner,
      instructionLanguage: "pt",
      ageRange:
        state === "profile-introduction-under-13" ? "under_13" : "25_39",
      currentLearningTrackId: learningTrackId,
    },
    currentLearningTrack: {
      id: learningTrackId,
      targetLanguage: "en",
      level: null,
      learningGoal: "travel",
      goalCefrLevel: null,
      additionalGoals: [],
      lessonEmphases: introductionStep ? [] : ["reading"],
      studyPace: null,
      onboardingStartingPoint:
        state === "profile-review-diagnostic"
          ? "diagnostic"
          : profileReviewStep
            ? "beginner"
            : null,
      onboardingStatus: "in_progress",
      onboardingStep: introductionStep ? "age_and_goals" : "starting_point",
    },
  };
  completedDiagnosticAttempt = null;
  answeredDiagnosticItemCount = 0;
  profileIntroductionStatus = introductionStep
    ? "not_started"
    : state === "profile-review-pending"
      ? "pending"
      : state === "profile-review-failed"
        ? "failed"
        : state === "profile-review-diagnostic"
          ? "completed"
          : "completed";
  profileIntroductionProfile = null;
  profileIntroductionConfirmed = false;

  return reply.code(204).send();
});

app.post("/test-control/profile-introduction", async (request, reply) => {
  const { status, profile: nextProfile } = request.body as {
    status?: ProfileIntroductionStatus;
    profile?: ExtractedProfile;
  };
  if (!status) return reply.code(400).send({ error: "status_required" });

  profileIntroductionStatus = status;
  profileIntroductionProfile = nextProfile ?? null;
  profileIntroductionConfirmed = false;
  return reply.code(204).send();
});

await app.listen({ host: "127.0.0.1", port: 3100 });
