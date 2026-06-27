import {
  onboardingStartingPointSelectionSchema,
  type OnboardingStartingPoint,
} from "@luma-lingo/shared";

export interface OnboardingStartingPointFormValues {
  onboardingStartingPoint: OnboardingStartingPoint | "";
}

export function validateOnboardingStartingPointForm(
  values: OnboardingStartingPointFormValues,
) {
  if (!values.onboardingStartingPoint) {
    return {
      ok: false as const,
      error: "Escolha como quer começar.",
    };
  }

  const result = onboardingStartingPointSelectionSchema.safeParse(values);
  if (!result.success) {
    return {
      ok: false as const,
      error: "Revise sua escolha antes de continuar.",
    };
  }
  return { ok: true as const, selection: result.data };
}
