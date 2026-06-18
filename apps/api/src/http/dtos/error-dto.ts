import { z } from "zod/v4";

export const errorDtoSchema = z.object({
  error: z.string(),
});

export type ErrorDto = z.infer<typeof errorDtoSchema>;
