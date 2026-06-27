import type {
  CreateDiagnosticAttemptInput,
  DiagnosticAttempt,
  DiagnosticAttemptAbandonReason,
  DiagnosticAttemptItem,
} from "./diagnostic-attempt.js";

export interface DiagnosticAttemptRepository {
  findInProgressAttempt(
    learningTrackId: string,
    purpose: string,
  ): Promise<DiagnosticAttempt | null>;
  createAttempt(
    input: CreateDiagnosticAttemptInput,
  ): Promise<DiagnosticAttempt>;
  abandonAttempt(input: {
    attemptId: string;
    abandonedAt: Date;
    abandonReason: DiagnosticAttemptAbandonReason;
  }): Promise<DiagnosticAttempt>;
  createAttemptItem(input: {
    attemptId: string;
    diagnosticItemId: string;
    position: number;
    selectedForRole: string;
    selectionRule: string;
    selectionTrace: Record<string, unknown>;
    shownAt: Date;
  }): Promise<DiagnosticAttemptItem>;
  answerAttemptItem(input: {
    attemptItemId: string;
    response: Record<string, unknown>;
    score: number;
    confidence: number;
    answeredAt: Date;
    details: Record<string, unknown>;
  }): Promise<DiagnosticAttemptItem>;
  completeAttempt(input: {
    attemptId: string;
    completedAt: Date;
    summary: Record<string, unknown>;
  }): Promise<DiagnosticAttempt>;
}
