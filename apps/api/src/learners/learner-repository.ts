import type { LanguageSelection } from "@luma-lingo/shared";

import type { LanguageSelectionProgress } from "./language-selection-progress.js";

export interface LearnerRepository {
  saveLanguageSelection(
    learnerId: string,
    selection: LanguageSelection,
  ): Promise<LanguageSelectionProgress>;
}
