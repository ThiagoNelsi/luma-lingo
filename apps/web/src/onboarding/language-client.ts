import { languageCodeSchema, type LanguageSelection } from "@luma-lingo/shared";
import { z } from "zod";

import { normalizeApiOrigin } from "../config/api-origin.js";

const languageSelectionProgressSchema = z.object({
  instructionLanguage: languageCodeSchema,
  targetLanguage: languageCodeSchema,
  onboardingStatus: z.literal("in_progress"),
  onboardingStep: z.literal("languages"),
});

export class UnauthorizedLanguageSelectionError extends Error {}

export async function saveLanguageSelection(
  apiOrigin: string,
  selection: LanguageSelection,
) {
  const response = await fetch(
    `${normalizeApiOrigin(apiOrigin)}/me/languages`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(selection),
    },
  );

  if (response.status === 401) {
    throw new UnauthorizedLanguageSelectionError("unauthenticated");
  }
  if (!response.ok) {
    throw new Error("language_selection_failed");
  }

  return languageSelectionProgressSchema.parse(await response.json());
}
