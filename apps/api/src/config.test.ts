import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadRuntimeEnv, readRuntimeConfig } from "./config.js";

const envKeys = [
  "API_ORIGIN",
  "AUTH_CALLBACK_URL",
  "AUTH_LOGOUT_URL",
  "AWS_REGION",
  "COGNITO_APP_CLIENT_ID",
  "COGNITO_APP_CLIENT_SECRET",
  "COGNITO_DOMAIN",
  "FRONTEND_ORIGIN",
  "PORT",
  "SESSION_COOKIE_NAME",
  "SESSION_COOKIE_SECURE",
  "SESSION_TTL_DAYS",
];

describe("runtime config", () => {
  const previousEnv = new Map<string, string | undefined>();

  afterEach(() => {
    for (const key of envKeys) {
      const previous = previousEnv.get(key);
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
    previousEnv.clear();
    delete process.env.DOTENV_CONFIG_PATH;
  });

  it("loads the workspace .env when the API starts from a package directory", () => {
    for (const key of envKeys) {
      previousEnv.set(key, process.env[key]);
      delete process.env[key];
    }

    const workspace = mkdtempSync(join(tmpdir(), "luma-lingo-env-"));
    const packageDirectory = join(workspace, "apps", "api");
    writeFileSync(
      join(workspace, ".env"),
      [
        "API_ORIGIN=http://localhost:3000",
        "AUTH_CALLBACK_URL=http://localhost:3000/auth/callback",
        "AUTH_LOGOUT_URL=http://localhost:5173/login",
        "AWS_REGION=us-east-1",
        "COGNITO_APP_CLIENT_ID=client",
        "COGNITO_APP_CLIENT_SECRET=secret",
        "COGNITO_DOMAIN=https://auth.example.com",
        "FRONTEND_ORIGIN=http://localhost:5173",
        "PORT=3000",
        "SESSION_COOKIE_NAME=luma_lingo_session",
        "SESSION_COOKIE_SECURE=false",
        "SESSION_TTL_DAYS=7",
      ].join("\n"),
    );

    try {
      loadRuntimeEnv(packageDirectory);
      expect(readRuntimeConfig().app.apiOrigin).toBe("http://localhost:3000");
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
