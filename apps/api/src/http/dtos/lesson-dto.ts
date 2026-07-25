import { z } from "zod";

import { lessonBlockSchema } from "../../lessons/lesson-content.js";
import type { LessonResult } from "../../lessons/home-service.js";

export const lessonDtoSchema = z.object({
  lessonId: z.uuid(),
  blocks: z.array(lessonBlockSchema).min(1),
  nextBlockStatus: z.enum(["preparing", "failed", "complete"]),
});
export type LessonDto = z.infer<typeof lessonDtoSchema>;

export function toLessonDto(lesson: LessonResult): LessonDto {
  return lesson;
}
