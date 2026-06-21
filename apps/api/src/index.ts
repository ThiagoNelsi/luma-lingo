import { createDatabaseClient } from "@luma-lingo/database";

import { CognitoAuthProvider } from "./auth/cognito-auth-provider.js";
import { loadRuntimeEnv, readRuntimeConfig } from "./config.js";
import { createApp } from "./http/app.js";
import {
  createGeminiGenerate,
  GeminiProfileExtractionProvider,
  GeminiTranscriptionProvider,
} from "./profile/gemini-providers.js";
import { ProfileIntroductionService } from "./profile/profile-introduction-service.js";
import { PrismaProfileIntroductionRepository } from "./repositories/prisma-profile-introduction-repository.js";
import { PrismaSessionRepository } from "./repositories/prisma-session-repository.js";
import { PrismaLearnerRepository } from "./repositories/prisma-learner-repository.js";
import { PrismaUserRepository } from "./repositories/prisma-user-repository.js";

loadRuntimeEnv();

const runtime = readRuntimeConfig();
const prisma = createDatabaseClient();
const profileRepository = new PrismaProfileIntroductionRepository(prisma);
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
  users: new PrismaUserRepository(prisma),
  sessions: new PrismaSessionRepository(prisma),
  profileIntroduction,
});

await app.listen({ host: "0.0.0.0", port: runtime.port });
