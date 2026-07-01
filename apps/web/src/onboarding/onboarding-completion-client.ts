import { z } from "zod";

import { normalizeApiOrigin } from "../config/api-origin.js";

export const onboardingCompletionResultSchema = z.object({
  onboardingStatus: z.literal("completed"),
  onboardingStep: z.null(),
});
export type OnboardingCompletionResult = z.infer<
  typeof onboardingCompletionResultSchema
>;

export class UnauthorizedOnboardingCompletionError extends Error {}

export async function completeOnboarding(
  apiOrigin: string,
): Promise<OnboardingCompletionResult> {
  const response = await fetch(
    `${normalizeApiOrigin(apiOrigin)}/me/onboarding/complete`,
    {
      method: "POST",
      credentials: "include",
    },
  );

  if (response.status === 401) {
    throw new UnauthorizedOnboardingCompletionError("unauthenticated");
  }
  if (!response.ok) throw new Error("onboarding_completion_failed");

  return onboardingCompletionResultSchema.parse(await response.json());
}
