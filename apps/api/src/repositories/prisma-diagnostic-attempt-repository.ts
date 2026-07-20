import { createId, type Prisma, type PrismaClient } from "@luma-lingo/database";

import type {
  AnswerDiagnosticAttemptItemInput,
  CompleteDiagnosticAttemptInput,
  CreateDiagnosticAttemptInput,
  DiagnosticAttempt,
  DiagnosticAttemptAbandonReason,
  DiagnosticAttemptItem,
  RecordShownDiagnosticAttemptItemInput,
} from "../diagnostics/diagnostic-attempt.js";
import {
  diagnosticAttemptStatusSchema,
  diagnosticEvidenceDetailsSchemaVersion,
  diagnosticJsonObjectSchema,
  learnerCompetencyStateDetailsSchemaVersion,
} from "../diagnostics/diagnostic-attempt.js";
import type { DiagnosticAttemptRepository } from "../diagnostics/diagnostic-attempt-repository.js";

type DiagnosticAttemptRow = {
  id: string;
  learningTrackId: string;
  catalogId: string;
  purpose: string;
  status: string;
  selectionPolicyVersion: string;
  scoringPolicyVersion: string;
  startedAt: Date;
  completedAt: Date | null;
  abandonedAt: Date | null;
  summary: unknown;
  details: unknown;
};

type DiagnosticAttemptItemRow = {
  id: string;
  attemptId: string;
  diagnosticItemId: string;
  position: number;
  selectedForRole: string;
  selectionRule: string;
  selectionTrace: unknown;
  response: unknown;
  score: number | null;
  confidence: number | null;
  shownAt: Date;
  answeredAt: Date | null;
  details: unknown;
};

type CompletedAttemptItemRow = {
  id: string;
  diagnosticItemId: string;
  score: number | null;
  confidence: number | null;
  answeredAt: Date | null;
  details: unknown;
  diagnosticItem: {
    primaryCompetencyId: string | null;
    conceptEvidenceMappings: Array<{
      conceptId: string;
      capability: string;
      strength: number;
    }>;
  };
};

type CompletedAttemptRow = DiagnosticAttemptRow & {
  items: CompletedAttemptItemRow[];
};

function toDiagnosticAttempt(row: DiagnosticAttemptRow): DiagnosticAttempt {
  return {
    id: row.id,
    learningTrackId: row.learningTrackId,
    catalogId: row.catalogId,
    purpose: row.purpose,
    status: diagnosticAttemptStatusSchema.parse(row.status),
    selectionPolicyVersion: row.selectionPolicyVersion,
    scoringPolicyVersion: row.scoringPolicyVersion,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    abandonedAt: row.abandonedAt,
    summary: toObject(row.summary),
    details: toObject(row.details),
  };
}

function toDiagnosticAttemptItem(
  row: DiagnosticAttemptItemRow,
): DiagnosticAttemptItem {
  return {
    id: row.id,
    attemptId: row.attemptId,
    diagnosticItemId: row.diagnosticItemId,
    position: row.position,
    selectedForRole: row.selectedForRole,
    selectionRule: row.selectionRule,
    selectionTrace: toObject(row.selectionTrace),
    response: toNullableObject(row.response),
    score: row.score,
    confidence: row.confidence,
    shownAt: row.shownAt,
    answeredAt: row.answeredAt,
    details: toObject(row.details),
  };
}

function toObject(value: unknown): Record<string, unknown> {
  const parsedValue = diagnosticJsonObjectSchema.safeParse(value);
  return parsedValue.success ? parsedValue.data : {};
}

function toNullableObject(value: unknown): Record<string, unknown> | null {
  const parsedValue = diagnosticJsonObjectSchema.safeParse(value);
  return parsedValue.success ? parsedValue.data : null;
}

function toInputJsonObject(
  value: Record<string, unknown>,
): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function weightedConfidence(confidence: number, strength: number): number {
  return confidence * (strength / 100);
}

export class PrismaDiagnosticAttemptRepository implements DiagnosticAttemptRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findInProgressAttempt(
    learningTrackId: string,
    purpose: string,
  ): Promise<DiagnosticAttempt | null> {
    // Active-attempt uniqueness is enforced in application code for MVP.
    const row = await this.prisma.diagnosticAttempt.findFirst({
      where: {
        learningTrackId,
        purpose,
        status: "in_progress",
      },
      orderBy: {
        startedAt: "desc",
      },
    });

    return row ? toDiagnosticAttempt(row) : null;
  }

  async findCompletedAttempt(
    learningTrackId: string,
    purpose: string,
  ): Promise<DiagnosticAttempt | null> {
    const row = await this.prisma.diagnosticAttempt.findFirst({
      where: {
        learningTrackId,
        purpose,
        status: "completed",
      },
      orderBy: {
        completedAt: "desc",
      },
    });

    return row ? toDiagnosticAttempt(row) : null;
  }

  async createAttempt(
    input: CreateDiagnosticAttemptInput,
  ): Promise<DiagnosticAttempt> {
    const row = await this.prisma.diagnosticAttempt.create({
      data: {
        id: createId(),
        learningTrackId: input.learningTrackId,
        catalogId: input.catalogId,
        purpose: input.purpose,
        status: "in_progress",
        selectionPolicyVersion: input.selectionPolicyVersion,
        scoringPolicyVersion: input.scoringPolicyVersion,
        startedAt: input.startedAt,
        summary: {},
        details: toInputJsonObject(input.details ?? {}),
      },
    });

    return toDiagnosticAttempt(row);
  }

  async findAttemptItems(attemptId: string): Promise<DiagnosticAttemptItem[]> {
    const rows = await this.prisma.diagnosticAttemptItem.findMany({
      where: {
        attemptId,
      },
      orderBy: {
        position: "asc",
      },
    });

    return rows.map(toDiagnosticAttemptItem);
  }

  async abandonAttempt(input: {
    attemptId: string;
    abandonedAt: Date;
    abandonReason: DiagnosticAttemptAbandonReason;
  }): Promise<DiagnosticAttempt> {
    const row = await this.prisma.diagnosticAttempt.update({
      where: {
        id: input.attemptId,
      },
      data: {
        status: "abandoned",
        abandonedAt: input.abandonedAt,
        details: {
          abandonReason: input.abandonReason,
        },
      },
    });

    return toDiagnosticAttempt(row);
  }

  async createAttemptItem(
    input: RecordShownDiagnosticAttemptItemInput & { shownAt: Date },
  ): Promise<DiagnosticAttemptItem> {
    const row = await this.prisma.diagnosticAttemptItem.create({
      data: {
        id: createId(),
        attemptId: input.attemptId,
        diagnosticItemId: input.diagnosticItemId,
        position: input.position,
        selectedForRole: input.selectedForRole,
        selectionRule: input.selectionRule,
        selectionTrace: toInputJsonObject(input.selectionTrace),
        shownAt: input.shownAt,
        details: {},
      },
    });

    return toDiagnosticAttemptItem(row);
  }

  async answerAttemptItem(
    input: AnswerDiagnosticAttemptItemInput & { answeredAt: Date },
  ): Promise<DiagnosticAttemptItem> {
    const row = await this.prisma.diagnosticAttemptItem.update({
      where: {
        id: input.attemptItemId,
      },
      data: {
        response: toInputJsonObject(input.response),
        score: input.score,
        confidence: input.confidence,
        answeredAt: input.answeredAt,
        details: toInputJsonObject(input.details),
      },
    });

    return toDiagnosticAttemptItem(row);
  }

  async completeAttempt(
    input: CompleteDiagnosticAttemptInput & { completedAt: Date },
  ): Promise<DiagnosticAttempt> {
    const completedAttempt = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.diagnosticAttempt.update({
        where: {
          id: input.attemptId,
        },
        data: {
          status: "completed",
          completedAt: input.completedAt,
          summary: toInputJsonObject(input.summary),
        },
        include: {
          items: {
            where: {
              answeredAt: {
                not: null,
              },
              score: {
                not: null,
              },
              confidence: {
                not: null,
              },
            },
            include: {
              diagnosticItem: {
                include: {
                  conceptEvidenceMappings: true,
                },
              },
            },
          },
        },
      });
      const competencyEvidenceRows = buildCompetencyEvidenceRows(
        attempt as unknown as CompletedAttemptRow,
      );
      const conceptEvidenceRows = buildConceptEvidenceRows(
        attempt as unknown as CompletedAttemptRow,
      );

      if (competencyEvidenceRows.length > 0) {
        await tx.competencyEvidence.createMany({
          data: competencyEvidenceRows,
        });
      }

      if (conceptEvidenceRows.length > 0) {
        await tx.conceptEvidence.createMany({
          data: conceptEvidenceRows,
        });
      }

      for (const evidence of competencyEvidenceRows) {
        const stateDetails = {
          schemaVersion: learnerCompetencyStateDetailsSchemaVersion,
          lastUpdateReason: evidence.sourceType,
          scoringPolicyVersion: attempt.scoringPolicyVersion,
        };
        await tx.learnerCompetencyState.upsert({
          where: {
            learningTrackId_competencyId: {
              learningTrackId: evidence.learningTrackId,
              competencyId: evidence.competencyId,
            },
          },
          create: {
            id: createId(),
            learningTrackId: evidence.learningTrackId,
            competencyId: evidence.competencyId,
            abilityEstimate: evidence.score,
            confidence: evidence.confidence,
            evidenceCount: 1,
            lastEvidenceAt: evidence.observedAt,
            details: stateDetails,
          },
          update: {
            abilityEstimate: evidence.score,
            confidence: evidence.confidence,
            evidenceCount: {
              increment: 1,
            },
            lastEvidenceAt: evidence.observedAt,
            details: stateDetails,
          },
        });
      }

      for (const evidence of conceptEvidenceRows) {
        const stateDetails = {
          schemaVersion: learnerCompetencyStateDetailsSchemaVersion,
          lastUpdateReason: evidence.sourceType,
          scoringPolicyVersion: attempt.scoringPolicyVersion,
        };
        await tx.learnerConceptState.upsert({
          where: {
            learningTrackId_conceptId_capability: {
              learningTrackId: evidence.learningTrackId,
              conceptId: evidence.conceptId,
              capability: evidence.capability,
            },
          },
          create: {
            id: createId(),
            learningTrackId: evidence.learningTrackId,
            conceptId: evidence.conceptId,
            capability: evidence.capability,
            mastery: evidence.score,
            confidence: evidence.confidence,
            directEvidenceCount: 1,
            inferredEvidenceCount: 0,
            lastEvidenceAt: evidence.observedAt,
            details: stateDetails,
          },
          update: {
            mastery: evidence.score,
            confidence: evidence.confidence,
            directEvidenceCount: {
              increment: 1,
            },
            lastEvidenceAt: evidence.observedAt,
            details: stateDetails,
          },
        });
      }

      return attempt;
    });

    return toDiagnosticAttempt(completedAttempt);
  }
}

function buildCompetencyEvidenceRows(attempt: CompletedAttemptRow) {
  return attempt.items.filter(isPublishableAttemptItem).flatMap((item) => {
    const competencyId = item.diagnosticItem.primaryCompetencyId;
    if (!competencyId) return [];

    return {
      id: createId(),
      learningTrackId: attempt.learningTrackId,
      competencyId,
      sourceType: "initial_diagnostic",
      sourceId: item.id,
      observedAt: item.answeredAt,
      score: item.score,
      confidence: item.confidence,
      details: {
        schemaVersion: diagnosticEvidenceDetailsSchemaVersion,
        attemptId: attempt.id,
        diagnosticItemId: item.diagnosticItemId,
        scoringPolicyVersion: attempt.scoringPolicyVersion,
      },
    };
  });
}

function buildConceptEvidenceRows(attempt: CompletedAttemptRow) {
  return attempt.items.filter(isPublishableAttemptItem).flatMap((item) =>
    (item.diagnosticItem.conceptEvidenceMappings ?? []).map((mapping) => ({
      id: createId(),
      learningTrackId: attempt.learningTrackId,
      conceptId: mapping.conceptId,
      capability: mapping.capability,
      evidenceKind: "direct",
      sourceType: "initial_diagnostic",
      sourceId: item.id,
      observedAt: item.answeredAt,
      score: item.score,
      confidence: weightedConfidence(item.confidence, mapping.strength),
      strength: mapping.strength,
      details: {
        schemaVersion: diagnosticEvidenceDetailsSchemaVersion,
        attemptId: attempt.id,
        diagnosticItemId: item.diagnosticItemId,
        scoringPolicyVersion: attempt.scoringPolicyVersion,
      },
    })),
  );
}

type PublishableAttemptItemRow = CompletedAttemptItemRow & {
  score: number;
  confidence: number;
  answeredAt: Date;
};

function isPublishableAttemptItem(
  item: CompletedAttemptItemRow,
): item is PublishableAttemptItemRow {
  return (
    item.score !== null && item.confidence !== null && item.answeredAt !== null
  );
}
