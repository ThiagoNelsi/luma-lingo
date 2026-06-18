import type { AuthIdentity } from "./auth-identity.js";

export interface AuthProvider {
  getAuthorizationUrl(input: { state: string; redirectUri: string }): string;
  exchangeCode(input: {
    code: string;
    redirectUri: string;
  }): Promise<AuthIdentity>;
  getLogoutUrl(input: { logoutUri: string }): Promise<string>;
}
