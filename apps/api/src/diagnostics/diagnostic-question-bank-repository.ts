import type { DiagnosticQuestionBank } from "./diagnostic-question-bank.js";

export interface DiagnosticQuestionBankRepository {
  findPublishedOnboardingQuestionBank(
    targetLanguage: string,
  ): Promise<DiagnosticQuestionBank | null>;
}
