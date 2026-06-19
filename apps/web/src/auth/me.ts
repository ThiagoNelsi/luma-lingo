import { z } from "zod";

export const meResponseSchema = z.object({
  user: z.object({
    primaryEmail: z.string(),
  }),
  learner: z.object({
    displayName: z.string().nullable(),
  }),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
