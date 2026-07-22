import { createDatabaseClient } from "@luma-lingo/database";

import { CognitoAuthProvider } from "./auth/cognito-auth-provider.js";
import { loadRuntimeEnv, readRuntimeConfig } from "./config.js";
import { DiagnosticAttemptService } from "./diagnostics/diagnostic-attempt-service.js";
import { InitialDiagnosticRuntimeService } from "./diagnostics/initial-diagnostic-runtime-service.js";
import { createApp } from "./http/app.js";
import {
  createGeminiGenerate,
  GeminiProfileExtractionProvider,
  GeminiTranscriptionProvider,
} from "./profile/gemini-providers.js";
import { ProfileIntroductionService } from "./profile/profile-introduction-service.js";
import { PrismaDiagnosticAttemptRepository } from "./repositories/prisma-diagnostic-attempt-repository.js";
import { PrismaDiagnosticQuestionBankRepository } from "./repositories/prisma-diagnostic-question-bank-repository.js";
import { PrismaInitialLearningPriorityRepository } from "./repositories/prisma-initial-learning-priority-repository.js";
import { PrismaProfileIntroductionRepository } from "./repositories/prisma-profile-introduction-repository.js";
import { PrismaOnboardingCompletionRepository } from "./repositories/prisma-onboarding-completion-repository.js";
import { PrismaSessionRepository } from "./repositories/prisma-session-repository.js";
import { PrismaLearnerRepository } from "./repositories/prisma-learner-repository.js";
import { PrismaUserRepository } from "./repositories/prisma-user-repository.js";

loadRuntimeEnv();

const runtime = readRuntimeConfig();
const prisma = createDatabaseClient();
const profileRepository = new PrismaProfileIntroductionRepository(prisma);
const diagnosticAttemptRepository = new PrismaDiagnosticAttemptRepository(
  prisma,
);
const diagnosticQuestionBankRepository =
  new PrismaDiagnosticQuestionBankRepository(prisma);
const geminiGenerate = createGeminiGenerate(runtime.gemini);
const profileIntroduction = new ProfileIntroductionService({
  repository: profileRepository,
  transcription: new GeminiTranscriptionProvider(geminiGenerate),
  extraction: new GeminiProfileExtractionProvider(geminiGenerate),
  schedule(task) {
    setImmediate(() => void task());
  },
});
await profileIntroduction.recoverInterrupted();
const app = await createApp({
  config: runtime.app,
  authProvider: new CognitoAuthProvider(runtime.cognito),
  learners: new PrismaLearnerRepository(prisma),
  onboardingCompletion: new PrismaOnboardingCompletionRepository(prisma),
  diagnosticAttempts: diagnosticAttemptRepository,
  initialLearningPriorities: new PrismaInitialLearningPriorityRepository(
    prisma,
  ),
  users: new PrismaUserRepository(prisma),
  sessions: new PrismaSessionRepository(prisma),
  initialDiagnostic: new InitialDiagnosticRuntimeService({
    attempts: new DiagnosticAttemptService(diagnosticAttemptRepository),
    questionBanks: diagnosticQuestionBankRepository,
  }),
  profileIntroduction,
});

await app.listen({ host: "0.0.0.0", port: runtime.port });
