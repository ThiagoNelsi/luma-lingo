import {
  onboardingStartingPointSelectionSchema,
  type OnboardingStartingPointSelection,
} from "@luma-lingo/shared";
import { z } from "zod";

import { normalizeApiOrigin } from "../config/api-origin.js";

const onboardingStartingPointProgressSchema =
  onboardingStartingPointSelectionSchema.and(
    z.object({
      onboardingStatus: z.literal("in_progress"),
      onboardingStep: z.literal("starting_point"),
    }),
  );

export class UnauthorizedOnboardingStartingPointError extends Error {}

export async function saveOnboardingStartingPoint(
  apiOrigin: string,
  selection: OnboardingStartingPointSelection,
) {
  const response = await fetch(
    `${normalizeApiOrigin(apiOrigin)}/me/onboarding-starting-point`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(selection),
    },
  );

  if (response.status === 401) {
    throw new UnauthorizedOnboardingStartingPointError("unauthenticated");
  }
  if (!response.ok) throw new Error("onboarding_starting_point_save_failed");
  return onboardingStartingPointProgressSchema.parse(await response.json());
}
