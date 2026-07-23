import { z } from "zod";

export const extractedProfileSchema = z.object({
  jobOrField: z.string().trim().max(200).nullable(),
  interests: z.array(z.string().trim().min(1).max(200)).max(10),
  other: z.array(z.string().trim().min(1).max(300)).max(10),
});

export type ExtractedProfile = z.infer<typeof extractedProfileSchema>;

export const confirmedProfileSchema = extractedProfileSchema.extend({
  jobOrField: z.string().trim().min(1).max(200),
  interests: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
});

export type ConfirmedProfile = z.infer<typeof confirmedProfileSchema>;

export const profileIntroductionStatusSchema = z.enum([
  "not_started",
  "pending",
  "processing",
  "completed",
  "failed",
  "manual_required",
]);

export type ProfileIntroductionStatus = z.infer<
  typeof profileIntroductionStatusSchema
>;

export const profileIntroductionProgressSchema = z.object({
  status: profileIntroductionStatusSchema,
  confirmed: z.boolean(),
  attempts: z.number().int().nonnegative(),
  errorCode: z.string().nullable(),
  profile: extractedProfileSchema.nullable(),
});

export type ProfileIntroductionProgress = z.infer<
  typeof profileIntroductionProgressSchema
>;
