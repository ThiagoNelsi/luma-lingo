import { z } from "zod";

import { normalizeApiOrigin } from "../config/api-origin.js";

const textSchema = z.string().min(1);
const activitySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("multiple_choice"),
    prompt: textSchema,
    options: z.array(textSchema),
    correctOptionIndex: z.number().int().nonnegative(),
    explanation: textSchema,
  }),
  z.object({
    type: z.literal("fill_blank"),
    prompt: textSchema,
    answer: textSchema,
    explanation: textSchema,
  }),
  z.object({
    type: z.literal("word_order"),
    prompt: textSchema,
    words: z.array(textSchema),
    answer: textSchema,
    explanation: textSchema,
  }),
]);

export const homeResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("preparing"), lessonId: z.uuid() }),
  z.object({ status: z.literal("failed"), lessonId: z.uuid() }),
  z.object({ status: z.literal("ready"), lessonId: z.uuid() }),
]);
export type HomeResponse = z.infer<typeof homeResponseSchema>;

export const lessonResponseSchema = z.object({
  lessonId: z.uuid(),
  blocks: z
    .array(
      z.object({
        title: textSchema,
        objective: textSchema,
        explanation: textSchema,
        examples: z.array(
          z.object({ target: textSchema, instruction: textSchema }),
        ),
        activities: z.array(activitySchema),
      }),
    )
    .min(1),
  nextBlockStatus: z.enum(["preparing", "failed", "complete"]),
});
export type LessonResponse = z.infer<typeof lessonResponseSchema>;

export class UnauthorizedHomeError extends Error {}

export async function fetchHome(
  apiOrigin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HomeResponse> {
  const response = await fetchImpl(`${normalizeApiOrigin(apiOrigin)}/me/home`, {
    credentials: "include",
  });
  if (response.status === 401) {
    throw new UnauthorizedHomeError("unauthenticated");
  }
  if (!response.ok) throw new Error("home_fetch_failed");
  return homeResponseSchema.parse(await response.json());
}

export async function fetchLesson(
  apiOrigin: string,
  lessonId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LessonResponse> {
  const response = await fetchImpl(
    `${normalizeApiOrigin(apiOrigin)}/me/lessons/${encodeURIComponent(lessonId)}`,
    { credentials: "include" },
  );
  if (response.status === 401) {
    throw new UnauthorizedHomeError("unauthenticated");
  }
  if (!response.ok) throw new Error("lesson_fetch_failed");
  return lessonResponseSchema.parse(await response.json());
}
