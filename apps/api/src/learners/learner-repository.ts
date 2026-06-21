import type {
  AgeAndGoalsSelection,
  LanguageSelection,
  LessonPreferencesSelection,
} from "@luma-lingo/shared";

import type { AgeAndGoalsProgress } from "./age-and-goals-progress.js";
import type { LanguageSelectionProgress } from "./language-selection-progress.js";
import type { LessonPreferencesProgress } from "./lesson-preferences-progress.js";

export interface LearnerRepository {
  saveLanguageSelection(
    learnerId: string,
    selection: LanguageSelection,
  ): Promise<LanguageSelectionProgress>;
  saveAgeAndGoals(
    learnerId: string,
    selection: AgeAndGoalsSelection,
  ): Promise<AgeAndGoalsProgress>;
  saveLessonPreferences(
    learnerId: string,
    selection: LessonPreferencesSelection,
  ): Promise<LessonPreferencesProgress>;
}
