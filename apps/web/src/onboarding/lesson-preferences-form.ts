import {
  lessonPreferencesSelectionSchema,
  type LessonEmphasis,
  type StudyPace,
} from "@luma-lingo/shared";

export interface LessonPreferencesFormValues {
  lessonEmphases: LessonEmphasis[];
  studyPace: StudyPace | "";
}

export function toggleLessonEmphasis(
  current: LessonEmphasis[],
  emphasis: LessonEmphasis,
): LessonEmphasis[] {
  return current.includes(emphasis)
    ? current.filter((item) => item !== emphasis)
    : [...current, emphasis];
}

export function validateLessonPreferencesForm(
  values: LessonPreferencesFormValues,
) {
  if (values.lessonEmphases.length === 0) {
    return {
      ok: false as const,
      error: "Escolha pelo menos uma forma de estudar.",
    };
  }

  const result = lessonPreferencesSelectionSchema.safeParse({
    lessonEmphases: values.lessonEmphases,
    studyPace: values.studyPace || null,
  });
  if (!result.success) {
    return {
      ok: false as const,
      error: "Revise suas escolhas antes de continuar.",
    };
  }
  return { ok: true as const, selection: result.data };
}
