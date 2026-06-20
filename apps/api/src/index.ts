import { createDatabaseClient } from "@luma-lingo/database";

import { CognitoAuthProvider } from "./auth/cognito-auth-provider.js";
import { loadRuntimeEnv, readRuntimeConfig } from "./config.js";
import { createApp } from "./http/app.js";
import { PrismaSessionRepository } from "./repositories/prisma-session-repository.js";
import { PrismaLearnerRepository } from "./repositories/prisma-learner-repository.js";
import { PrismaUserRepository } from "./repositories/prisma-user-repository.js";

loadRuntimeEnv();

const runtime = readRuntimeConfig();
const prisma = createDatabaseClient();
const app = await createApp({
  config: runtime.app,
  authProvider: new CognitoAuthProvider(runtime.cognito),
  learners: new PrismaLearnerRepository(prisma),
  users: new PrismaUserRepository(prisma),
  sessions: new PrismaSessionRepository(prisma),
});

await app.listen({ host: "0.0.0.0", port: runtime.port });
