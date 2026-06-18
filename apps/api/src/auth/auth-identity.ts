import { z } from "zod/v4";

export const authIdentitySchema = z.object({
  provider: z.string(),
  providerSubject: z.string(),
  email: z.email(),
  emailVerified: z.boolean(),
  name: z.string().nullable(),
});

export type AuthIdentity = z.infer<typeof authIdentitySchema>;
