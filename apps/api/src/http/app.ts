import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

import type { AuthProvider } from "../auth/auth-provider.js";
import type { AppConfig } from "../config.js";
import type { LearnerRepository } from "../learners/learner-repository.js";
import type { UserRepository } from "../repositories/user-repository.js";
import type { SessionRepository } from "../sessions/session-repository.js";
import { AuthService } from "../services/auth-service.js";
import { OnboardingService } from "../services/onboarding-service.js";
import { registerOpenApi } from "./openapi.js";
import { registerAuthRoutes } from "./routes/auth-routes.js";
import { registerHealthRoutes } from "./routes/health-routes.js";
import { registerMeRoutes } from "./routes/me-routes.js";
import { registerOnboardingRoutes } from "./routes/onboarding-routes.js";

export interface AppDependencies {
  config: AppConfig;
  authProvider: AuthProvider;
  learners: LearnerRepository;
  users: UserRepository;
  sessions: SessionRepository;
}

export async function createApp(deps: AppDependencies) {
  const app = Fastify({ logger: deps.config.nodeEnv !== "test" });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    async () => ({}),
  );

  const auth = new AuthService(deps.users, deps.sessions, deps.config);
  const onboarding = new OnboardingService(deps.learners);

  await app.register(cookie);
  await app.register(cors, {
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT"],
    origin: deps.config.frontendOrigin,
  });

  await registerOpenApi(app);

  registerHealthRoutes(app);
  registerAuthRoutes(app, {
    auth,
    authProvider: deps.authProvider,
    config: deps.config,
  });
  registerMeRoutes(app, { auth, config: deps.config });
  registerOnboardingRoutes(app, {
    auth,
    config: deps.config,
    onboarding,
  });

  return app;
}
