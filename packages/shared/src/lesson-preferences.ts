import { z } from "zod";

export const lessonEmphasisOptions = [
  {
    value: "listening",
    label: "Ouvir",
    description: "Aprender com diálogos e exercícios de compreensão",
  },
  {
    value: "reading",
    label: "Ler",
    description: "Aprender com textos e exemplos",
  },
  {
    value: "writing",
    label: "Escrever",
    description: "Praticar formando frases e respostas",
  },
] as const;

export const studyPaceOptions = [
  {
    value: "relaxed",
    label: "Com calma",
    description: "Mais tempo para praticar e revisar",
  },
  {
    value: "accelerated",
    label: "Mais rápido",
    description: "Um ritmo mais direto e desafiador",
  },
] as const;

export const lessonEmphasisValues = lessonEmphasisOptions.map(
  ({ value }) => value,
);
export const studyPaceValues = studyPaceOptions.map(({ value }) => value);

export const lessonEmphasisSchema = z.enum(lessonEmphasisValues);
export const studyPaceSchema = z.enum(studyPaceValues);
export const lessonPreferencesSelectionSchema = z
  .object({
    lessonEmphases: z.array(lessonEmphasisSchema).min(1),
    studyPace: studyPaceSchema.nullable(),
  })
  .superRefine((selection, context) => {
    if (
      new Set(selection.lessonEmphases).size !== selection.lessonEmphases.length
    ) {
      context.addIssue({
        code: "custom",
        message: "lesson_emphases_must_be_unique",
        path: ["lessonEmphases"],
      });
    }
  });

export type LessonEmphasis = z.infer<typeof lessonEmphasisSchema>;
export type StudyPace = z.infer<typeof studyPaceSchema>;
export type LessonPreferencesSelection = z.infer<
  typeof lessonPreferencesSelectionSchema
>;
