import { z } from "zod";

const textSchema = z.string().trim().min(1);
const lessonEmphasisSchema = z.enum(["listening", "reading", "writing"]);

const lessonAlignmentSchema = z
  .object({
    instructionLanguage: textSchema,
    targetLanguage: textSchema,
    primaryGoal: textSchema,
    priorityCompetencyKey: textSchema,
    priorityCompetencyState: z
      .object({
        abilityEstimate: z.number().min(0).max(1).nullable(),
        confidence: z.number().min(0).max(1),
      })
      .strict()
      .nullable()
      .optional(),
    lessonEmphases: z.array(lessonEmphasisSchema).min(1).max(3),
    profileTopics: z.array(textSchema).max(3),
  })
  .strict();

export const lessonPlanSchema = z
  .object({
    title: textSchema,
    objective: textSchema,
    alignment: lessonAlignmentSchema.optional(),
    blocks: z
      .array(
        z
          .object({
            title: textSchema,
            objective: textSchema,
            emphasis: lessonEmphasisSchema.optional(),
          })
          .strict(),
      )
      .min(3)
      .max(5),
  })
  .strict();
export type LessonPlan = z.infer<typeof lessonPlanSchema>;

const multipleChoiceActivitySchema = z
  .object({
    type: z.literal("multiple_choice"),
    prompt: textSchema,
    options: z.array(textSchema).min(2).max(6),
    correctOptionIndex: z.number().int().nonnegative(),
    explanation: textSchema,
  })
  .strict();

const fillBlankActivitySchema = z
  .object({
    type: z.literal("fill_blank"),
    prompt: textSchema,
    answer: textSchema,
    explanation: textSchema,
  })
  .strict();

const wordOrderActivitySchema = z
  .object({
    type: z.literal("word_order"),
    prompt: textSchema,
    words: z.array(textSchema).min(2).max(12),
    answer: textSchema,
    explanation: textSchema,
  })
  .strict();

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
      .array(z.object({ target: textSchema, instruction: textSchema }).strict())
      .min(1)
      .max(5),
    activities: z.array(lessonActivitySchema).min(1).max(5),
  })
  .strict()
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
    required: ["title", "objective", "alignment", "blocks"],
    properties: {
      title: { type: "string" },
      objective: { type: "string" },
      alignment: {
        type: "object",
        additionalProperties: false,
        required: [
          "instructionLanguage",
          "targetLanguage",
          "primaryGoal",
          "priorityCompetencyKey",
          "priorityCompetencyState",
          "lessonEmphases",
          "profileTopics",
        ],
        properties: {
          instructionLanguage: { type: "string" },
          targetLanguage: { type: "string" },
          primaryGoal: { type: "string" },
          priorityCompetencyKey: { type: "string" },
          priorityCompetencyState: {
            anyOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["abilityEstimate", "confidence"],
                properties: {
                  abilityEstimate: {
                    anyOf: [{ type: "number" }, { type: "null" }],
                  },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                },
              },
              { type: "null" },
            ],
          },
          lessonEmphases: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: {
              type: "string",
              enum: ["listening", "reading", "writing"],
            },
          },
          profileTopics: {
            type: "array",
            maxItems: 3,
            items: { type: "string" },
          },
        },
      },
      blocks: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "objective", "emphasis"],
          properties: {
            title: { type: "string" },
            objective: { type: "string" },
            emphasis: {
              type: "string",
              enum: ["listening", "reading", "writing"],
            },
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
        maxItems: 5,
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
