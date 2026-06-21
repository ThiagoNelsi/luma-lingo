import {
  ageAndGoalsSelectionSchema,
  type AgeAndGoalsSelection,
} from "@luma-lingo/shared";
import { z } from "zod";

import { normalizeApiOrigin } from "../config/api-origin.js";

const ageAndGoalsProgressSchema = ageAndGoalsSelectionSchema.and(
  z.object({
    onboardingStatus: z.literal("in_progress"),
    onboardingStep: z.literal("age_and_goals"),
  }),
);

export class UnauthorizedAgeAndGoalsError extends Error {}

export async function saveAgeAndGoals(
  apiOrigin: string,
  selection: AgeAndGoalsSelection,
) {
  const response = await fetch(
    `${normalizeApiOrigin(apiOrigin)}/me/age-and-goals`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(selection),
    },
  );

  if (response.status === 401) {
    throw new UnauthorizedAgeAndGoalsError("unauthenticated");
  }
  if (!response.ok) throw new Error("age_and_goals_save_failed");
  return ageAndGoalsProgressSchema.parse(await response.json());
}
