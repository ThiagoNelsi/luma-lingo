import { describe, expect, it } from "vitest";

import {
  lessonBlockContract,
  lessonBlockSchema,
  lessonPlanSchema,
} from "./lesson-content.js";

describe("lesson block contract", () => {
  it("requires an approximately ten-minute Lesson plan to have three to five cohesive blocks", () => {
    expect(() =>
      lessonPlanSchema.parse({
        title: "Greetings",
        objective: "Introduce yourself.",
        blocks: [
          { title: "Hello", objective: "Say hello." },
          { title: "Name", objective: "Share your name." },
        ],
      }),
    ).toThrow();
  });

  it("keeps rendered activity variants closed and rejects an invalid answer index", () => {
    expect(() =>
      lessonBlockSchema.parse({
        title: "Greeting",
        objective: "Say hello.",
        explanation: "Use Hello.",
        examples: [{ target: "Hello", instruction: "Olá" }],
        activities: [
          {
            type: "multiple_choice",
            prompt: "Choose a greeting.",
            options: ["Hello", "Thanks"],
            correctOptionIndex: 2,
            explanation: "Hello is a greeting.",
          },
        ],
      }),
    ).toThrow("multiple_choice_correct_option_out_of_range");

    const activityVariants = (
      lessonBlockContract.jsonSchema.properties.activities as {
        items: {
          anyOf: readonly {
            properties: {
              type: { type?: string; enum?: readonly string[] };
            };
          }[];
        };
      }
    ).items.anyOf;
    expect(activityVariants).toHaveLength(3);
    expect(activityVariants.map((variant) => variant.properties.type)).toEqual([
      { type: "string", enum: ["multiple_choice"] },
      { type: "string", enum: ["fill_blank"] },
      { type: "string", enum: ["word_order"] },
    ]);
  });
});
