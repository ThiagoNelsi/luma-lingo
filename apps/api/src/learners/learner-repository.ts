import type {
  AgeAndGoalsSelection,
  LanguageSelection,
} from "@luma-lingo/shared";

import type { AgeAndGoalsProgress } from "./age-and-goals-progress.js";
import type { LanguageSelectionProgress } from "./language-selection-progress.js";

export interface LearnerRepository {
  saveLanguageSelection(
    learnerId: string,
    selection: LanguageSelection,
  ): Promise<LanguageSelectionProgress>;
  saveAgeAndGoals(
    learnerId: string,
    selection: AgeAndGoalsSelection,
  ): Promise<AgeAndGoalsProgress>;
}
