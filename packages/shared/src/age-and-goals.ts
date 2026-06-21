import { z } from "zod";

export const learnerAgeRangeOptions = [
  { value: "under_13", label: "Menos de 13" },
  { value: "13_17", label: "13–17" },
  { value: "18_24", label: "18–24" },
  { value: "25_39", label: "25–39" },
  { value: "40_59", label: "40–59" },
  { value: "60_plus", label: "60+" },
] as const;

export const goalOptions = [
  { value: "everyday_conversation", label: "Conversas do dia a dia" },
  { value: "work", label: "Trabalho" },
  { value: "travel", label: "Viagens" },
  { value: "exam_prep", label: "Preparação para prova" },
  { value: "cefr_level", label: "Alcançar um nível CEFR" },
] as const;

export const additionalGoalOptions = [
  goalOptions[0],
  goalOptions[1],
  goalOptions[2],
] as const;
export const cefrGoalLevelValues = ["A1", "A2", "B1", "B2"] as const;

export const learnerAgeRangeValues = learnerAgeRangeOptions.map(
  ({ value }) => value,
);
export const goalValues = goalOptions.map(({ value }) => value);
export const additionalGoalValues = additionalGoalOptions.map(
  ({ value }) => value,
);

export const learnerAgeRangeSchema = z.enum(learnerAgeRangeValues);
export const goalSchema = z.enum(goalValues);
export const additionalGoalSchema = z.enum(additionalGoalValues);
export const cefrGoalLevelSchema = z.enum(cefrGoalLevelValues);

export const ageAndGoalsSelectionSchema = z
  .object({
    ageRange: learnerAgeRangeSchema,
    displayName: z.string().trim().min(1).max(100).nullable(),
    primaryGoal: goalSchema,
    cefrGoalLevel: cefrGoalLevelSchema.nullable(),
    additionalGoals: z.array(additionalGoalSchema).max(2),
  })
  .superRefine((selection, context) => {
    if (
      (selection.primaryGoal === "cefr_level") !==
      (selection.cefrGoalLevel !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "cefr_level_required_only_for_cefr_goal",
        path: ["cefrGoalLevel"],
      });
    }

    if (
      new Set(selection.additionalGoals).size !==
      selection.additionalGoals.length
    ) {
      context.addIssue({
        code: "custom",
        message: "additional_goals_must_be_unique",
        path: ["additionalGoals"],
      });
    }

    if (
      selection.additionalGoals.some((goal) => goal === selection.primaryGoal)
    ) {
      context.addIssue({
        code: "custom",
        message: "additional_goal_must_differ_from_primary",
        path: ["additionalGoals"],
      });
    }
  });

export type LearnerAgeRange = z.infer<typeof learnerAgeRangeSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type AdditionalGoal = z.infer<typeof additionalGoalSchema>;
export type CefrGoalLevel = z.infer<typeof cefrGoalLevelSchema>;
export type AgeAndGoalsSelection = z.infer<typeof ageAndGoalsSelectionSchema>;
