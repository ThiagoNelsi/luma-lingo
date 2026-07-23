import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

import { config as loadDotenv } from "dotenv";

import { parseLogLevel, type LogLevel } from "./observability/logger.js";

export interface AppConfig {
  apiOrigin: string;
  authCallbackUrl: string;
  authLogoutUrl: string;
  frontendOrigin: string;
  logLevel: LogLevel;
  nodeEnv: string;
  sessionCookieName: string;
  sessionCookieSecure: boolean;
  sessionTtlDays: number;
}

export interface RuntimeConfig {
  app: AppConfig;
  cognito: {
    appClientId: string;
    appClientSecret: string;
    domain: string;
    region: string;
  };
  gemini: {
    apiKey: string;
    model: string;
  };
  port: number;
}

export function loadRuntimeEnv(cwd: string = process.cwd()): void {
  const envPath = process.env.DOTENV_CONFIG_PATH ?? findUp(".env", cwd);
  if (envPath) {
    loadDotenv({ path: envPath });
  }
}

export function readRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  return {
    app: {
      apiOrigin: required(env, "API_ORIGIN"),
      authCallbackUrl: required(env, "AUTH_CALLBACK_URL"),
      authLogoutUrl: required(env, "AUTH_LOGOUT_URL"),
      frontendOrigin: required(env, "FRONTEND_ORIGIN"),
      logLevel: parseLogLevel(env.LOG_LEVEL ?? "info"),
      nodeEnv: env.NODE_ENV ?? "development",
      sessionCookieName: env.SESSION_COOKIE_NAME ?? "luma_lingo_session",
      sessionCookieSecure: parseBoolean(env.SESSION_COOKIE_SECURE ?? "true"),
      sessionTtlDays: parseInteger(env.SESSION_TTL_DAYS ?? "7"),
    },
    cognito: {
      appClientId: required(env, "COGNITO_APP_CLIENT_ID"),
      appClientSecret: required(env, "COGNITO_APP_CLIENT_SECRET"),
      domain: required(env, "COGNITO_DOMAIN"),
      region: required(env, "AWS_REGION"),
    },
    gemini: {
      apiKey: required(env, "GEMINI_API_KEY"),
      model: env.GEMINI_MODEL ?? "gemini-3.5-flash",
    },
    port: parseInteger(env.PORT ?? "3000"),
  };
}

function findUp(fileName: string, startDirectory: string): string | null {
  let directory = startDirectory;

  while (true) {
    const candidate = join(directory, fileName);
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(directory);
    if (parent === directory) {
      return null;
    }
    directory = parent;
  }
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseBoolean(value: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Invalid boolean environment value: ${value}`);
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid integer environment value: ${value}`);
  }
  return parsed;
}
