import { normalizeApiOrigin } from "../config/api-origin.js";

export function createLoginRedirect(apiOrigin: string): string {
  return `${normalizeApiOrigin(apiOrigin)}/auth/login`;
}

export function createLogoutAction(apiOrigin: string): string {
  return `${normalizeApiOrigin(apiOrigin)}/auth/logout`;
}
