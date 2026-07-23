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
import { createSilentLogger, type AppLogger } from "../observability/logger.js";

const resumeWindowMs = 48 * 60 * 60 * 1000;

export class DiagnosticAttemptService {
  constructor(
    private readonly repository: DiagnosticAttemptRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly logger: AppLogger = createSilentLogger(),
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
      this.logger.info(
        {
          attemptId: existingAttempt.id,
          event: "diagnostic.attempt.resumed",
          learningTrackId: parsedInput.learningTrackId,
          purpose: parsedInput.purpose,
        },
        "Diagnostic attempt resumed",
      );
      return existingAttempt;
    }

    if (existingAttempt) {
      await this.repository.abandonAttempt({
        attemptId: existingAttempt.id,
        abandonedAt: now,
        abandonReason: diagnosticAttemptAbandonReasons.resumeWindowExpired,
      });
      this.logger.warn(
        {
          attemptId: existingAttempt.id,
          event: "diagnostic.attempt.abandoned",
          learningTrackId: parsedInput.learningTrackId,
          purpose: parsedInput.purpose,
          reason: "resume_window_expired",
        },
        "Diagnostic attempt abandoned after resume window expired",
      );
    }

    const attempt = await this.repository.createAttempt({
      ...parsedInput,
      startedAt: now,
    });
    this.logger.info(
      {
        attemptId: attempt.id,
        event: "diagnostic.attempt.created",
        learningTrackId: parsedInput.learningTrackId,
        purpose: parsedInput.purpose,
      },
      "Diagnostic attempt created",
    );
    return attempt;
  }

  findInProgressAttempt(
    learningTrackId: string,
    purpose: string,
  ): Promise<DiagnosticAttempt | null> {
    return this.repository
      .findInProgressAttempt(learningTrackId, purpose)
      .then((attempt) => {
        this.logger.debug(
          {
            attemptId: attempt?.id,
            event: "diagnostic.attempt.in_progress_queried",
            learningTrackId,
            purpose,
          },
          "In-progress diagnostic attempt queried",
        );
        return attempt;
      });
  }

  findCompletedAttempt(
    learningTrackId: string,
    purpose: string,
  ): Promise<DiagnosticAttempt | null> {
    return this.repository
      .findCompletedAttempt(learningTrackId, purpose)
      .then((attempt) => {
        this.logger.debug(
          {
            attemptId: attempt?.id,
            event: "diagnostic.attempt.completed_queried",
            learningTrackId,
            purpose,
          },
          "Completed diagnostic attempt queried",
        );
        return attempt;
      });
  }

  async recordShownItem(
    input: RecordShownDiagnosticAttemptItemInput,
  ): Promise<DiagnosticAttemptItem> {
    const parsedInput =
      recordShownDiagnosticAttemptItemInputSchema.parse(input);

    const item = await this.repository.createAttemptItem({
      ...parsedInput,
      shownAt: this.now(),
    });
    this.logger.info(
      {
        attemptId: parsedInput.attemptId,
        attemptItemId: item.id,
        event: "diagnostic.item.shown",
        position: parsedInput.position,
      },
      "Diagnostic item shown",
    );
    return item;
  }

  findAttemptItems(attemptId: string): Promise<DiagnosticAttemptItem[]> {
    return this.repository.findAttemptItems(attemptId).then((items) => {
      this.logger.debug(
        {
          attemptId,
          event: "diagnostic.attempt.items_queried",
          itemCount: items.length,
        },
        "Diagnostic attempt items queried",
      );
      return items;
    });
  }

  async answerAttemptItem(
    input: AnswerDiagnosticAttemptItemInput,
  ): Promise<DiagnosticAttemptItem> {
    const parsedInput = answerDiagnosticAttemptItemInputSchema.parse(input);

    const item = await this.repository.answerAttemptItem({
      ...parsedInput,
      answeredAt: this.now(),
    });
    this.logger.info(
      {
        attemptItemId: item.id,
        event: "diagnostic.item.answered",
        score: parsedInput.score,
      },
      "Diagnostic item answered",
    );
    return item;
  }

  async completeAttempt(
    input: CompleteDiagnosticAttemptInput,
  ): Promise<DiagnosticAttempt> {
    const parsedInput = completeDiagnosticAttemptInputSchema.parse(input);

    const attempt = await this.repository.completeAttempt({
      ...parsedInput,
      completedAt: this.now(),
    });
    this.logger.info(
      {
        attemptId: attempt.id,
        event: "diagnostic.attempt.completed",
        summary: parsedInput.summary,
      },
      "Diagnostic attempt completed",
    );
    return attempt;
  }
}
