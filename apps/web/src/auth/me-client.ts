import { normalizeApiOrigin } from "../config/api-origin.js";
import { meResponseSchema, type MeResponse } from "./me.js";

export class UnauthorizedSessionError extends Error {
  constructor() {
    super("unauthorized_session");
    this.name = "UnauthorizedSessionError";
  }
}

export async function fetchMe(apiOrigin: string): Promise<MeResponse> {
  const response = await fetch(`${normalizeApiOrigin(apiOrigin)}/me`, {
    credentials: "include",
  });

  if (response.status === 401) {
    throw new UnauthorizedSessionError();
  }

  if (!response.ok) {
    throw new Error("me_request_failed");
  }

  return meResponseSchema.parse(await response.json());
}
