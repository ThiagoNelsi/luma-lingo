import { learnerAgeRangeSchema } from "@luma-lingo/shared";
import { z } from "zod";

const storageKey = "luma-lingo-about-you-draft";

const aboutYouDraftSchema = z.object({
  ageRange: learnerAgeRangeSchema,
  displayName: z.string().max(100),
});

export type AboutYouDraft = z.infer<typeof aboutYouDraftSchema>;

export function loadAboutYouDraft(): AboutYouDraft | null {
  const stored = window.sessionStorage.getItem(storageKey);
  if (!stored) return null;

  try {
    const result = aboutYouDraftSchema.safeParse(JSON.parse(stored));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function saveAboutYouDraft(draft: AboutYouDraft) {
  window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
}

export function clearAboutYouDraft() {
  window.sessionStorage.removeItem(storageKey);
}
