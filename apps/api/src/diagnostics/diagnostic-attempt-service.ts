import {
  answerDiagnosticAttemptItemInputSchema,
  completeDiagnosticAttemptInputSchema,
  diagnosticAttemptAbandonReasons,
  recordShownDiagnosticAttemptItemInputSchema,
  resumeOrCreateDiagnosticAttemptInputSchema,
  type AnswerDiagnosticAttemptItemInput,
  type CompleteDiagnosticAttemptInput,
  type DiagnosticAttempt,
  type DiagnosticAttemptItem,
  type RecordShownDiagnosticAttemptItemInput,
  type ResumeOrCreateDiagnosticAttemptInput,
} from "./diagnostic-attempt.js";
import type { DiagnosticAttemptRepository } from "./diagnostic-attempt-repository.js";

const resumeWindowMs = 48 * 60 * 60 * 1000;

export class DiagnosticAttemptService {
  constructor(
    private readonly repository: DiagnosticAttemptRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async resumeOrCreateAttempt(
    input: ResumeOrCreateDiagnosticAttemptInput,
  ): Promise<DiagnosticAttempt> {
    const parsedInput = resumeOrCreateDiagnosticAttemptInputSchema.parse(input);
    const now = this.now();
    const existingAttempt = await this.repository.findInProgressAttempt(
      parsedInput.learningTrackId,
      parsedInput.purpose,
    );

    if (
      existingAttempt &&
      now.getTime() - existingAttempt.startedAt.getTime() <= resumeWindowMs
    ) {
      return existingAttempt;
    }

    if (existingAttempt) {
      await this.repository.abandonAttempt({
        attemptId: existingAttempt.id,
        abandonedAt: now,
        abandonReason: diagnosticAttemptAbandonReasons.resumeWindowExpired,
      });
    }

    return this.repository.createAttempt({
      ...parsedInput,
      startedAt: now,
    });
  }

  findInProgressAttempt(
    learningTrackId: string,
    purpose: string,
  ): Promise<DiagnosticAttempt | null> {
    return this.repository.findInProgressAttempt(learningTrackId, purpose);
  }

  findCompletedAttempt(
    learningTrackId: string,
    purpose: string,
  ): Promise<DiagnosticAttempt | null> {
    return this.repository.findCompletedAttempt(learningTrackId, purpose);
  }

  async recordShownItem(
    input: RecordShownDiagnosticAttemptItemInput,
  ): Promise<DiagnosticAttemptItem> {
    const parsedInput =
      recordShownDiagnosticAttemptItemInputSchema.parse(input);

    return this.repository.createAttemptItem({
      ...parsedInput,
      shownAt: this.now(),
    });
  }

  findAttemptItems(attemptId: string): Promise<DiagnosticAttemptItem[]> {
    return this.repository.findAttemptItems(attemptId);
  }

  async answerAttemptItem(
    input: AnswerDiagnosticAttemptItemInput,
  ): Promise<DiagnosticAttemptItem> {
    const parsedInput = answerDiagnosticAttemptItemInputSchema.parse(input);

    return this.repository.answerAttemptItem({
      ...parsedInput,
      answeredAt: this.now(),
    });
  }

  async completeAttempt(
    input: CompleteDiagnosticAttemptInput,
  ): Promise<DiagnosticAttempt> {
    const parsedInput = completeDiagnosticAttemptInputSchema.parse(input);

    return this.repository.completeAttempt({
      ...parsedInput,
      completedAt: this.now(),
    });
  }
}
