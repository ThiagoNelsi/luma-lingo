import { z } from "zod";

import { lessonBlockSchema } from "../../lessons/lesson-content.js";

export const lessonDtoSchema = z.object({
  lessonId: z.uuid(),
  block: lessonBlockSchema,
});
export type LessonDto = z.infer<typeof lessonDtoSchema>;
