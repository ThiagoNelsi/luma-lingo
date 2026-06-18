import { z } from "zod/v4";

import { learnerProfileSchema } from "../learners/learner-profile.js";
import { learningTrackProfileSchema } from "../learners/learning-track-profile.js";
import { sessionRecordSchema } from "../sessions/session-record.js";
import { userProfileSchema } from "../users/user-profile.js";

export const authProfileSchema = z.object({
  user: userProfileSchema,
  learner: learnerProfileSchema,
  currentLearningTrack: learningTrackProfileSchema.nullable(),
});

export type AuthProfile = z.infer<typeof authProfileSchema>;

export const authenticatedSessionProfileSchema = authProfileSchema.extend({
  session: sessionRecordSchema,
});

export type AuthenticatedSessionProfile = z.infer<
  typeof authenticatedSessionProfileSchema
>;
