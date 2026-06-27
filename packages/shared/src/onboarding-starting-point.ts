import { z } from "zod";

export const onboardingStartingPointOptions = [
  {
    value: "beginner",
    label: "Começar do zero",
    description: "Pular o teste inicial e começar pelas primeiras bases",
  },
  {
    value: "diagnostic",
    label: "Fazer um teste rápido",
    description: "Responder algumas perguntas para ajustar o ponto de partida",
  },
] as const;

export const onboardingStartingPointValues = onboardingStartingPointOptions.map(
  ({ value }) => value,
);

export const onboardingStartingPointSchema = z.enum(
  onboardingStartingPointValues,
);

export const onboardingStartingPointSelectionSchema = z.object({
  onboardingStartingPoint: onboardingStartingPointSchema,
});

export type OnboardingStartingPoint = z.infer<
  typeof onboardingStartingPointSchema
>;
export type OnboardingStartingPointSelection = z.infer<
  typeof onboardingStartingPointSelectionSchema
>;
