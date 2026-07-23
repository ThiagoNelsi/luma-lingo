import {
  confirmedProfileSchema,
  type ConfirmedProfile,
  type ExtractedProfile,
} from "@luma-lingo/shared";

export interface ProfileReviewValues {
  jobOrField: string;
  interests: string;
  dailyRoutine: string;
  studyContext: string;
  other: string;
}

export type ProfileReviewFormResult =
  | { ok: true; profile: ConfirmedProfile }
  | { ok: false; errors: Partial<Record<keyof ProfileReviewValues, string>> };

export function createProfileReviewValues(
  profile: ExtractedProfile | null,
): ProfileReviewValues {
  return {
    jobOrField: profile?.jobOrField ?? "",
    interests: profile?.interests.join(", ") ?? "",
    dailyRoutine: profile?.dailyRoutine.join(", ") ?? "",
    studyContext: profile?.studyContext ?? "",
    other: profile?.other.join(", ") ?? "",
  };
}

export function validateProfileReviewForm(
  values: ProfileReviewValues,
): ProfileReviewFormResult {
  const profile = {
    jobOrField: values.jobOrField,
    interests: splitItems(values.interests),
    dailyRoutine: splitItems(values.dailyRoutine),
    studyContext: values.studyContext.trim() || null,
    other: splitItems(values.other),
  };
  const result = confirmedProfileSchema.safeParse(profile);
  if (result.success) return { ok: true, profile: result.data };

  const errors: Partial<Record<keyof ProfileReviewValues, string>> = {};
  for (const issue of result.error.issues) {
    if (issue.path[0] === "jobOrField")
      errors.jobOrField = "Conte sua área de trabalho ou atuação.";
    if (issue.path[0] === "interests")
      errors.interests = "Conte pelo menos um interesse.";
    if (issue.path[0] === "dailyRoutine")
      errors.dailyRoutine = "Use até 10 itens de até 300 caracteres.";
    if (issue.path[0] === "studyContext")
      errors.studyContext = "Use até 300 caracteres.";
    if (issue.path[0] === "other")
      errors.other = "Use até 10 itens de até 300 caracteres.";
  }
  return { ok: false, errors };
}

function splitItems(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
