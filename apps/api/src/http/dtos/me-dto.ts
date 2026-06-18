import { z } from "zod/v4";

import { learnerProfileSchema } from "../../learners/learner-profile.js";
import { learningTrackProfileSchema } from "../../learners/learning-track-profile.js";
import type { AuthenticatedSessionProfile } from "../../services/auth-profile.js";

export const meDtoSchema = z.object({
  user: z.object({
    id: z.uuid(),
    primaryEmail: z.email(),
    emailVerifiedAt: z.iso.datetime(),
    lastLoginAt: z.iso.datetime().nullable(),
  }),
  learner: learnerProfileSchema,
  currentLearningTrack: learningTrackProfileSchema.nullable(),
  session: z.object({
    id: z.uuid(),
    expiresAt: z.iso.datetime(),
    lastSeenAt: z.iso.datetime(),
  }),
});

export type MeDto = z.infer<typeof meDtoSchema>;

export function toMeDto(profile: AuthenticatedSessionProfile): MeDto {
  return {
    user: {
      id: profile.user.id,
      primaryEmail: profile.user.primaryEmail,
      emailVerifiedAt: profile.user.emailVerifiedAt.toISOString(),
      lastLoginAt: profile.user.lastLoginAt?.toISOString() ?? null,
    },
    learner: profile.learner,
    currentLearningTrack: profile.currentLearningTrack,
    session: {
      id: profile.session.id,
      expiresAt: profile.session.expiresAt.toISOString(),
      lastSeenAt: profile.session.lastSeenAt.toISOString(),
    },
  };
}
