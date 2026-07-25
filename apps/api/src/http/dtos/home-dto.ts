import { z } from "zod";

import type { HomeResult } from "../../lessons/home-service.js";

export const homeDtoSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("preparing"), lessonId: z.uuid() }),
  z.object({ status: z.literal("failed"), lessonId: z.uuid() }),
  z.object({ status: z.literal("ready"), lessonId: z.uuid() }),
]);
export type HomeDto = z.infer<typeof homeDtoSchema>;

export function toHomeDto(home: HomeResult): HomeDto {
  return { status: home.status, lessonId: home.lessonId };
}
