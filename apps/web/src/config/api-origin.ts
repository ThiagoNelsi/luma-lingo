const defaultApiOrigin = "http://localhost:3000";

export function normalizeApiOrigin(apiOrigin: string): string {
  return apiOrigin.replace(/\/+$/, "");
}

export function readApiOrigin(apiOrigin: string | undefined): string {
  return normalizeApiOrigin(apiOrigin ?? defaultApiOrigin);
}
