import {
  ageAndGoalsSelectionSchema,
  type AdditionalGoal,
  type AgeAndGoalsSelection,
  type CefrGoalLevel,
  type Goal,
  type LearnerAgeRange,
} from "@luma-lingo/shared";

export interface AgeAndGoalsFormValues {
  ageRange: LearnerAgeRange | "";
  displayName: string;
  primaryGoal: Goal | "";
  cefrGoalLevel: CefrGoalLevel | "";
  additionalGoals: AdditionalGoal[];
}

export interface AboutYouFormValues {
  ageRange: LearnerAgeRange | "";
  displayName: string;
}

export interface GoalsFormValues {
  aboutYou: AboutYouFormValues | null;
  primaryGoal: Goal | "";
  cefrGoalLevel: CefrGoalLevel | "";
  additionalGoals: AdditionalGoal[];
}

type AgeAndGoalsFormResult =
  { ok: true; selection: AgeAndGoalsSelection } | { ok: false; error: string };

export function validateAgeAndGoalsForm(
  values: AgeAndGoalsFormValues,
): AgeAndGoalsFormResult {
  const aboutYouResult = validateAboutYouForm(values);
  if (!aboutYouResult.ok) return aboutYouResult;

  return validateGoalsForm({
    aboutYou: aboutYouResult.selection,
    primaryGoal: values.primaryGoal,
    cefrGoalLevel: values.cefrGoalLevel,
    additionalGoals: values.additionalGoals,
  });
}

export function validateAboutYouForm(values: AboutYouFormValues) {
  if (!values.ageRange)
    return { ok: false as const, error: "Escolha sua faixa etária." };

  return {
    ok: true as const,
    selection: {
      ageRange: values.ageRange,
      displayName: values.displayName.trim(),
    },
  };
}

export function validateGoalsForm(
  values: GoalsFormValues,
): AgeAndGoalsFormResult {
  if (!values.aboutYou?.ageRange) {
    return { ok: false, error: "Informe seu nome e sua faixa etária." };
  }
  if (!values.primaryGoal) {
    return { ok: false, error: "Escolha seu objetivo principal." };
  }
  if (values.primaryGoal === "cefr_level" && !values.cefrGoalLevel) {
    return {
      ok: false,
      error: "Escolha o nível CEFR que deseja alcançar.",
    };
  }

  const result = ageAndGoalsSelectionSchema.safeParse({
    ageRange: values.aboutYou.ageRange,
    displayName: values.aboutYou.displayName.trim() || null,
    primaryGoal: values.primaryGoal,
    cefrGoalLevel:
      values.primaryGoal === "cefr_level" ? values.cefrGoalLevel : null,
    additionalGoals: values.additionalGoals,
  });
  if (!result.success) {
    return { ok: false, error: "Revise suas escolhas antes de continuar." };
  }
  return { ok: true, selection: result.data };
}

export function toggleAdditionalGoal(
  current: AdditionalGoal[],
  goal: AdditionalGoal,
): AdditionalGoal[] {
  if (current.includes(goal)) {
    return current.filter((item) => item !== goal);
  }
  if (current.length >= 2) return current;
  return [...current, goal];
}
