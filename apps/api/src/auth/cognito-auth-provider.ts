import type { AuthIdentity } from "./auth-identity.js";
import type { AuthProvider } from "./auth-provider.js";

export interface CognitoAuthProviderConfig {
  appClientId: string;
  appClientSecret: string;
  domain: string;
  region: string;
}

export class CognitoAuthProvider implements AuthProvider {
  constructor(private readonly config: CognitoAuthProviderConfig) {}

  getAuthorizationUrl(input: { state: string; redirectUri: string }): string {
    const url = new URL("/oauth2/authorize", this.config.domain);
    url.searchParams.set("client_id", this.config.appClientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("state", input.state);
    return url.toString();
  }

  async exchangeCode(input: {
    code: string;
    redirectUri: string;
  }): Promise<AuthIdentity> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.config.appClientId,
      code: input.code,
      redirect_uri: input.redirectUri,
    });

    const response = await fetch(new URL("/oauth2/token", this.config.domain), {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(
          `${this.config.appClientId}:${this.config.appClientSecret}`,
        ).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const token = (await response.json()) as {
      access_token?: string;
      id_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !token.access_token || !token.id_token) {
      throw new Error(
        token.error_description ??
          token.error ??
          "cognito_token_exchange_failed",
      );
    }

    const claims = decodeJwtPayload(token.id_token);
    const sub = stringClaim(claims, "sub");
    const email = stringClaim(claims, "email");

    if (!sub || !email) {
      throw new Error("cognito_identity_missing_required_claims");
    }

    return {
      provider: "cognito",
      providerSubject: sub,
      email,
      emailVerified: booleanClaim(claims, "email_verified"),
      name: stringClaim(claims, "name"),
    };
  }

  async getLogoutUrl(input: { logoutUri: string }): Promise<string> {
    const url = new URL("/logout", this.config.domain);
    url.searchParams.set("client_id", this.config.appClientId);
    url.searchParams.set("logout_uri", input.logoutUri);
    return url.toString();
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split(".");
  if (!payload) {
    throw new Error("cognito_id_token_invalid");
  }

  try {
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
  } catch {
    throw new Error("cognito_id_token_invalid");
  }
}

function stringClaim(
  claims: Record<string, unknown>,
  name: string,
): string | null {
  const value = claims[name];
  return typeof value === "string" ? value : null;
}

function booleanClaim(claims: Record<string, unknown>, name: string): boolean {
  const value = claims[name];
  return value === true || value === "true";
}
