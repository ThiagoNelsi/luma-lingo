import {
  confirmedProfileSchema,
  profileIntroductionProgressSchema,
  type ConfirmedProfile,
} from "@luma-lingo/shared";

import { normalizeApiOrigin } from "../config/api-origin.js";

export class UnauthorizedProfileIntroductionError extends Error {
  constructor() {
    super("unauthorized_profile_introduction");
    this.name = "UnauthorizedProfileIntroductionError";
  }
}

async function parseProgress(response: Response) {
  if (response.status === 401) throw new UnauthorizedProfileIntroductionError();
  if (!response.ok) throw new Error("profile_introduction_request_failed");
  return profileIntroductionProgressSchema.parse(await response.json());
}

export async function getProfileIntroduction(apiOrigin: string) {
  return parseProgress(
    await fetch(`${normalizeApiOrigin(apiOrigin)}/me/profile-introduction`, {
      credentials: "include",
    }),
  );
}

export async function submitProfileIntroduction(
  apiOrigin: string,
  audio: Blob,
  durationMs: number,
) {
  const body = new FormData();
  body.append("durationMs", String(Math.round(durationMs)));
  body.append("mimeType", audio.type);
  body.append("byteSize", String(audio.size));
  body.append("audio", audio, "introduction.webm");
  return parseProgress(
    await fetch(`${normalizeApiOrigin(apiOrigin)}/me/profile-introduction`, {
      method: "POST",
      credentials: "include",
      body,
    }),
  );
}

export async function useManualProfileIntroduction(apiOrigin: string) {
  return parseProgress(
    await fetch(
      `${normalizeApiOrigin(apiOrigin)}/me/profile-introduction/manual`,
      { method: "POST", credentials: "include" },
    ),
  );
}

export async function confirmProfileIntroduction(
  apiOrigin: string,
  profile: ConfirmedProfile,
) {
  const body = confirmedProfileSchema.parse(profile);
  return parseProgress(
    await fetch(
      `${normalizeApiOrigin(apiOrigin)}/me/profile-introduction/confirm`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    ),
  );
}
