import { afterEach, describe, expect, it, vi } from "vitest";

import { CognitoAuthProvider } from "./cognito-auth-provider.js";

const config = {
  appClientId: "client-id",
  appClientSecret: "client-secret",
  domain: "https://auth.example.com",
  region: "us-east-1",
};

describe("CognitoAuthProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves identity from the OIDC id token returned by Cognito", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          access_token: "access-token-without-admin-scope",
          id_token: createUnsignedJwt({
            sub: "cognito-sub-1",
            email: "learner@example.com",
            email_verified: true,
            name: "Learner One",
          }),
        }),
      ),
    );
    const provider = new CognitoAuthProvider(config);

    await expect(
      provider.exchangeCode({
        code: "code",
        redirectUri: "http://localhost:3000/auth/callback",
      }),
    ).resolves.toEqual({
      provider: "cognito",
      providerSubject: "cognito-sub-1",
      email: "learner@example.com",
      emailVerified: true,
      name: "Learner One",
    });
  });
});

function createUnsignedJwt(payload: Record<string, unknown>): string {
  return [
    encodeBase64Url({ alg: "none", typ: "JWT" }),
    encodeBase64Url(payload),
    "signature",
  ].join(".");
}

function encodeBase64Url(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
