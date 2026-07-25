import { z } from "zod";

const textSchema = z.string().trim().min(1);

export const lessonPlanSchema = z.object({
  title: textSchema,
  objective: textSchema,
  blocks: z
    .array(
      z.object({
        title: textSchema,
        objective: textSchema,
      }),
    )
    .min(1)
    .max(5),
});
export type LessonPlan = z.infer<typeof lessonPlanSchema>;

const multipleChoiceActivitySchema = z.object({
  type: z.literal("multiple_choice"),
  prompt: textSchema,
  options: z.array(textSchema).min(2).max(6),
  correctOptionIndex: z.number().int().nonnegative(),
  explanation: textSchema,
});

const fillBlankActivitySchema = z.object({
  type: z.literal("fill_blank"),
  prompt: textSchema,
  answer: textSchema,
  explanation: textSchema,
});

const wordOrderActivitySchema = z.object({
  type: z.literal("word_order"),
  prompt: textSchema,
  words: z.array(textSchema).min(2).max(12),
  answer: textSchema,
  explanation: textSchema,
});

export const lessonActivitySchema = z.discriminatedUnion("type", [
  multipleChoiceActivitySchema,
  fillBlankActivitySchema,
  wordOrderActivitySchema,
]);
export type LessonActivity = z.infer<typeof lessonActivitySchema>;

export const lessonBlockSchema = z
  .object({
    title: textSchema,
    objective: textSchema,
    explanation: textSchema,
    examples: z
      .array(z.object({ target: textSchema, instruction: textSchema }))
      .min(1)
      .max(5),
    activities: z.array(lessonActivitySchema).min(1).max(5),
  })
  .superRefine((block, context) => {
    for (const [index, activity] of block.activities.entries()) {
      if (
        activity.type === "multiple_choice" &&
        activity.correctOptionIndex >= activity.options.length
      ) {
        context.addIssue({
          code: "custom",
          message: "multiple_choice_correct_option_out_of_range",
          path: ["activities", index, "correctOptionIndex"],
        });
      }
    }
  });
export type LessonBlock = z.infer<typeof lessonBlockSchema>;

export const lessonPlanContract = {
  name: "lesson_plan",
  version: "v1",
  schema: lessonPlanSchema,
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "objective", "blocks"],
    properties: {
      title: { type: "string" },
      objective: { type: "string" },
      blocks: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "objective"],
          properties: {
            title: { type: "string" },
            objective: { type: "string" },
          },
        },
      },
    },
  },
} as const;

export const lessonBlockContract = {
  name: "lesson_block",
  version: "v1",
  schema: lessonBlockSchema,
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "objective", "explanation", "examples", "activities"],
    properties: {
      title: { type: "string" },
      objective: { type: "string" },
      explanation: { type: "string" },
      examples: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["target", "instruction"],
          properties: {
            target: { type: "string" },
            instruction: { type: "string" },
          },
        },
      },
      activities: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              required: [
                "type",
                "prompt",
                "options",
                "correctOptionIndex",
                "explanation",
              ],
              properties: {
                type: { type: "string", enum: ["multiple_choice"] },
                prompt: { type: "string" },
                options: {
                  type: "array",
                  minItems: 2,
                  maxItems: 6,
                  items: { type: "string" },
                },
                correctOptionIndex: { type: "integer", minimum: 0 },
                explanation: { type: "string" },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "prompt", "answer", "explanation"],
              properties: {
                type: { type: "string", enum: ["fill_blank"] },
                prompt: { type: "string" },
                answer: { type: "string" },
                explanation: { type: "string" },
              },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["type", "prompt", "words", "answer", "explanation"],
              properties: {
                type: { type: "string", enum: ["word_order"] },
                prompt: { type: "string" },
                words: {
                  type: "array",
                  minItems: 2,
                  maxItems: 12,
                  items: { type: "string" },
                },
                answer: { type: "string" },
                explanation: { type: "string" },
              },
            },
          ],
        },
      },
    },
  },
} as const;
