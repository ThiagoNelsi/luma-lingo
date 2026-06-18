import { z } from "zod/v4";

export const sessionRecordSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  tokenHash: z.string(),
  expiresAt: z.date(),
  lastSeenAt: z.date(),
  revokedAt: z.date().nullable(),
});

export type SessionRecord = z.infer<typeof sessionRecordSchema>;
