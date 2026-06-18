import { z } from "zod/v4";

export const userProfileSchema = z.object({
  id: z.uuid(),
  primaryEmail: z.email(),
  emailVerifiedAt: z.date(),
  lastLoginAt: z.date().nullable(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;
