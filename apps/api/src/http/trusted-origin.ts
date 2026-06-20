import type { AppConfig } from "../config.js";

export function isTrustedOrigin(
  origin: string | undefined,
  config: AppConfig,
): boolean {
  if (!origin) return true;

  return origin === config.frontendOrigin || origin === config.apiOrigin;
}
