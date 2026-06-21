import {
  lessonPreferencesSelectionSchema,
  type LessonPreferencesSelection,
} from "@luma-lingo/shared";
import { z } from "zod";

import { normalizeApiOrigin } from "../config/api-origin.js";

const lessonPreferencesProgressSchema = lessonPreferencesSelectionSchema.and(
  z.object({
    onboardingStatus: z.literal("in_progress"),
    onboardingStep: z.literal("lesson_preferences"),
  }),
);

export class UnauthorizedLessonPreferencesError extends Error {}

export async function saveLessonPreferences(
  apiOrigin: string,
  selection: LessonPreferencesSelection,
) {
  const response = await fetch(
    `${normalizeApiOrigin(apiOrigin)}/me/lesson-preferences`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(selection),
    },
  );

  if (response.status === 401) {
    throw new UnauthorizedLessonPreferencesError("unauthenticated");
  }
  if (!response.ok) throw new Error("lesson_preferences_save_failed");
  return lessonPreferencesProgressSchema.parse(await response.json());
}
