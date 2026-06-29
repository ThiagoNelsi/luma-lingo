import { describe, expect, it } from "vitest";

import type {
  DiagnosticAttempt,
  DiagnosticAttemptAbandonReason,
  DiagnosticAttemptItem,
} from "./diagnostic-attempt.js";
import type { DiagnosticAttemptRepository } from "./diagnostic-attempt-repository.js";
import { DiagnosticAttemptService } from "./diagnostic-attempt-service.js";

class FakeDiagnosticAttemptRepository implements DiagnosticAttemptRepository {
  attempts: DiagnosticAttempt[] = [];
  attemptItems: DiagnosticAttemptItem[] = [];

  async findInProgressAttempt(
    learningTrackId: string,
    purpose: string,
  ): Promise<DiagnosticAttempt | null> {
    return (
      this.attempts.find(
        (attempt) =>
          attempt.learningTrackId === learningTrackId &&
          attempt.purpose === purpose &&
          attempt.status === "in_progress",
      ) ?? null
    );
  }

  async createAttempt(input: {
    learningTrackId: string;
    catalogId: string;
    purpose: string;
    selectionPolicyVersion: string;
    scoringPolicyVersion: string;
    startedAt: Date;
    details?: Record<string, unknown>;
  }): Promise<DiagnosticAttempt> {
    const attempt: DiagnosticAttempt = {
      id: `attempt-${this.attempts.length + 1}`,
      learningTrackId: input.learningTrackId,
      catalogId: input.catalogId,
      purpose: input.purpose,
      status: "in_progress",
      selectionPolicyVersion: input.selectionPolicyVersion,
      scoringPolicyVersion: input.scoringPolicyVersion,
      startedAt: input.startedAt,
      completedAt: null,
      abandonedAt: null,
      summary: {},
      details: input.details ?? {},
    };
    this.attempts.push(attempt);
    return attempt;
  }

  async findAttemptItems(attemptId: string): Promise<DiagnosticAttemptItem[]> {
    return this.attemptItems
      .filter((item) => item.attemptId === attemptId)
      .sort((left, right) => left.position - right.position);
  }

  async abandonAttempt(input: {
    attemptId: string;
    abandonedAt: Date;
    abandonReason: DiagnosticAttemptAbandonReason;
  }): Promise<DiagnosticAttempt> {
    const { attemptId, abandonedAt, abandonReason } = input;
    const attempt = this.attempts.find(({ id }) => id === attemptId);
    if (!attempt) {
      throw new Error(`Attempt ${attemptId} not found`);
    }

    attempt.status = "abandoned";
    attempt.abandonedAt = abandonedAt;
    attempt.details = {
      abandonReason,
    };
    return attempt;
  }

  async createAttemptItem(input: {
    attemptId: string;
    diagnosticItemId: string;
    position: number;
    selectedForRole: string;
    selectionRule: string;
    selectionTrace: Record<string, unknown>;
    shownAt: Date;
  }): Promise<DiagnosticAttemptItem> {
    const attemptItem: DiagnosticAttemptItem = {
      id: `attempt-item-${this.attemptItems.length + 1}`,
      attemptId: input.attemptId,
      diagnosticItemId: input.diagnosticItemId,
      position: input.position,
      selectedForRole: input.selectedForRole,
      selectionRule: input.selectionRule,
      selectionTrace: input.selectionTrace,
      response: null,
      score: null,
      confidence: null,
      shownAt: input.shownAt,
      answeredAt: null,
      details: {},
    };
    this.attemptItems.push(attemptItem);
    return attemptItem;
  }

  async answerAttemptItem(input: {
    attemptItemId: string;
    response: Record<string, unknown>;
    score: number;
    confidence: number;
    answeredAt: Date;
    details: Record<string, unknown>;
  }): Promise<DiagnosticAttemptItem> {
    const attemptItem = this.attemptItems.find(
      ({ id }) => id === input.attemptItemId,
    );
    if (!attemptItem) {
      throw new Error(`Attempt item ${input.attemptItemId} not found`);
    }

    attemptItem.response = input.response;
    attemptItem.score = input.score;
    attemptItem.confidence = input.confidence;
    attemptItem.answeredAt = input.answeredAt;
    attemptItem.details = input.details;
    return attemptItem;
  }

  async completeAttempt(input: {
    attemptId: string;
    completedAt: Date;
    summary: Record<string, unknown>;
  }): Promise<DiagnosticAttempt> {
    const attempt = this.attempts.find(({ id }) => id === input.attemptId);
    if (!attempt) {
      throw new Error(`Attempt ${input.attemptId} not found`);
    }

    attempt.status = "completed";
    attempt.completedAt = input.completedAt;
    attempt.summary = input.summary;
    return attempt;
  }
}

describe("DiagnosticAttemptService", () => {
  it("creates an onboarding initial diagnostic attempt when none is in progress", async () => {
    const now = new Date("2026-06-27T12:00:00.000Z");
    const repository = new FakeDiagnosticAttemptRepository();
    const service = new DiagnosticAttemptService(repository, () => now);

    await expect(
      service.resumeOrCreateAttempt({
        learningTrackId: "track-1",
        catalogId: "catalog-1",
        purpose: "onboarding_initial",
        selectionPolicyVersion: "initial-diagnostic-selection-v1",
        scoringPolicyVersion: "initial-diagnostic-scoring-v1",
      }),
    ).resolves.toMatchObject({
      learningTrackId: "track-1",
      catalogId: "catalog-1",
      purpose: "onboarding_initial",
      status: "in_progress",
      startedAt: now,
    });
    expect(repository.attempts).toHaveLength(1);
  });

  it("resumes an in-progress attempt for the same learning track and purpose within 48 hours", async () => {
    const startedAt = new Date("2026-06-27T12:00:00.000Z");
    const now = new Date("2026-06-29T11:59:59.000Z");
    const repository = new FakeDiagnosticAttemptRepository();
    const existing = await repository.createAttempt({
      learningTrackId: "track-1",
      catalogId: "catalog-1",
      purpose: "onboarding_initial",
      selectionPolicyVersion: "initial-diagnostic-selection-v1",
      scoringPolicyVersion: "initial-diagnostic-scoring-v1",
      startedAt,
    });
    const service = new DiagnosticAttemptService(repository, () => now);

    await expect(
      service.resumeOrCreateAttempt({
        learningTrackId: "track-1",
        catalogId: "catalog-1",
        purpose: "onboarding_initial",
        selectionPolicyVersion: "initial-diagnostic-selection-v1",
        scoringPolicyVersion: "initial-diagnostic-scoring-v1",
      }),
    ).resolves.toEqual(existing);
    expect(repository.attempts).toHaveLength(1);
  });

  it("abandons a stale in-progress attempt before creating a new one", async () => {
    const startedAt = new Date("2026-06-27T12:00:00.000Z");
    const now = new Date("2026-06-29T12:00:01.000Z");
    const repository = new FakeDiagnosticAttemptRepository();
    const staleAttempt = await repository.createAttempt({
      learningTrackId: "track-1",
      catalogId: "catalog-1",
      purpose: "onboarding_initial",
      selectionPolicyVersion: "initial-diagnostic-selection-v1",
      scoringPolicyVersion: "initial-diagnostic-scoring-v1",
      startedAt,
    });
    const service = new DiagnosticAttemptService(repository, () => now);

    const replacement = await service.resumeOrCreateAttempt({
      learningTrackId: "track-1",
      catalogId: "catalog-1",
      purpose: "onboarding_initial",
      selectionPolicyVersion: "initial-diagnostic-selection-v1",
      scoringPolicyVersion: "initial-diagnostic-scoring-v1",
    });

    expect(staleAttempt).toMatchObject({
      status: "abandoned",
      abandonedAt: now,
      details: {
        abandonReason: "resume_window_expired",
      },
    });
    expect(replacement).toMatchObject({
      id: "attempt-2",
      status: "in_progress",
      startedAt: now,
    });
    expect(repository.attempts).toHaveLength(2);
  });

  it("records a diagnostic attempt item when an item is shown", async () => {
    const now = new Date("2026-06-27T12:10:00.000Z");
    const repository = new FakeDiagnosticAttemptRepository();
    const service = new DiagnosticAttemptService(repository, () => now);

    await expect(
      service.recordShownItem({
        attemptId: "attempt-1",
        diagnosticItemId: "item-1",
        position: 1,
        selectedForRole: "foundation_probe",
        selectionRule: "first-foundation-probe",
        selectionTrace: {
          schemaVersion: 1,
          candidateCount: 4,
        },
      }),
    ).resolves.toMatchObject({
      attemptId: "attempt-1",
      diagnosticItemId: "item-1",
      position: 1,
      response: null,
      score: null,
      confidence: null,
      shownAt: now,
      answeredAt: null,
    });
  });

  it("updates a shown attempt item when the learner answers", async () => {
    const shownAt = new Date("2026-06-27T12:10:00.000Z");
    const answeredAt = new Date("2026-06-27T12:10:12.000Z");
    const repository = new FakeDiagnosticAttemptRepository();
    const attemptItem = await repository.createAttemptItem({
      attemptId: "attempt-1",
      diagnosticItemId: "item-1",
      position: 1,
      selectedForRole: "foundation_probe",
      selectionRule: "first-foundation-probe",
      selectionTrace: {},
      shownAt,
    });
    const service = new DiagnosticAttemptService(repository, () => answeredAt);

    await expect(
      service.answerAttemptItem({
        attemptItemId: attemptItem.id,
        response: {
          kind: "dont_know",
        },
        score: 0,
        confidence: 0.65,
        details: {
          responseKind: "dont_know",
        },
      }),
    ).resolves.toMatchObject({
      id: attemptItem.id,
      response: {
        kind: "dont_know",
      },
      score: 0,
      confidence: 0.65,
      shownAt,
      answeredAt,
      details: {
        responseKind: "dont_know",
      },
    });
  });

  it("completes an attempt with a final summary", async () => {
    const startedAt = new Date("2026-06-27T12:00:00.000Z");
    const completedAt = new Date("2026-06-27T12:12:00.000Z");
    const repository = new FakeDiagnosticAttemptRepository();
    const attempt = await repository.createAttempt({
      learningTrackId: "track-1",
      catalogId: "catalog-1",
      purpose: "onboarding_initial",
      selectionPolicyVersion: "initial-diagnostic-selection-v1",
      scoringPolicyVersion: "initial-diagnostic-scoring-v1",
      startedAt,
    });
    const service = new DiagnosticAttemptService(repository, () => completedAt);

    await expect(
      service.completeAttempt({
        attemptId: attempt.id,
        summary: {
          schemaVersion: 1,
          answeredItemCount: 1,
          stopReason: "max_items_reached",
        },
      }),
    ).resolves.toMatchObject({
      id: attempt.id,
      status: "completed",
      completedAt,
      summary: {
        schemaVersion: 1,
        answeredItemCount: 1,
        stopReason: "max_items_reached",
      },
    });
  });
});
