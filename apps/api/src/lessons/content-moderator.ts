import { z } from "zod";

export const contentModerationResultSchema = z
  .object({
    flagged: z.boolean(),
    flaggedCategories: z.array(z.string().min(1)),
    model: z.string().min(1),
    reference: z.string().min(1),
  })
  .strict();
export type ContentModerationResult = z.infer<
  typeof contentModerationResultSchema
>;

export interface ContentModerator {
  moderate(input: {
    content: string;
    correlation?: {
      attempt?: number;
      lessonId?: string;
      requestId?: string;
    };
    purpose: "lesson_plan" | "lesson_block";
  }): Promise<ContentModerationResult>;
}

export class LessonContentModerationError extends Error {
  readonly code = "lesson_content_moderation_rejected";
  readonly reason = "unsafe_content";

  constructor(readonly flaggedCategories: string[]) {
    super("lesson_content_moderation_rejected");
    this.name = "LessonContentModerationError";
  }
}
