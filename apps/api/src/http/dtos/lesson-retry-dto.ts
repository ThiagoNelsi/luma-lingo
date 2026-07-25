import { z } from "zod";

export const lessonRetryDtoSchema = z
  .object({
    accepted: z.literal(true),
  })
  .strict();
export type LessonRetryDto = z.infer<typeof lessonRetryDtoSchema>;
