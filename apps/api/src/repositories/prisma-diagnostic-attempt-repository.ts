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
import { defaultInitialDiagnosticPolicyConfig } from "../diagnostics/initial-diagnostic-policy.js";

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
    primaryCompetencyId: string;
    primaryCompetency: CompetencyWithPrerequisitesRow;
    competencyTargets: Array<{
      competencyId: string;
      role: string;
      weight: number | null;
    }>;
  };
};

type CompletedAttemptRow = DiagnosticAttemptRow & {
  items: CompletedAttemptItemRow[];
};

type CompetencyWithPrerequisitesRow = {
  id: string;
  prerequisites?: Array<{
    strength: number | null;
    prerequisite: CompetencyWithPrerequisitesRow;
  }>;
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

function weightedConfidence(confidence: number, weight: number | null): number {
  return confidence * ((weight ?? 100) / 100);
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
                  competencyTargets: true,
                  primaryCompetency: {
                    include: {
                      prerequisites: {
                        include: {
                          prerequisite: {
                            include: {
                              prerequisites: {
                                include: {
                                  prerequisite: true,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      const evidenceRows = buildEvidenceRows(attempt as CompletedAttemptRow);

      if (evidenceRows.length > 0) {
        await tx.competencyEvidence.createMany({
          data: evidenceRows,
        });
      }

      for (const evidence of evidenceRows) {
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

      return attempt;
    });

    return toDiagnosticAttempt(completedAttempt);
  }
}

function buildEvidenceRows(attempt: CompletedAttemptRow) {
  const directEvidenceRows = attempt.items
    .filter(isPublishableAttemptItem)
    .flatMap((item) => {
      const itemScore = item.score;
      const itemConfidence = item.confidence;
      const observedAt = item.answeredAt;

      return item.diagnosticItem.competencyTargets.map((target) => {
        const targetWeight = target.weight ?? 100;

        return {
          id: createId(),
          learningTrackId: attempt.learningTrackId,
          competencyId: target.competencyId,
          sourceType: "initial_diagnostic",
          sourceId: item.id,
          observedAt,
          score: itemScore,
          confidence: weightedConfidence(itemConfidence, target.weight),
          details: {
            schemaVersion: diagnosticEvidenceDetailsSchemaVersion,
            attemptId: attempt.id,
            diagnosticItemId: item.diagnosticItemId,
            targetRole: target.role,
            targetWeight,
            scoringPolicyVersion: attempt.scoringPolicyVersion,
          },
        };
      });
    });
  const directCompetencyIds = new Set(
    directEvidenceRows.map((evidence) => evidence.competencyId),
  );
  const prerequisiteInferenceRows = attempt.items
    .filter(isPublishableAttemptItem)
    .flatMap((item) =>
      buildPrerequisiteInferenceRows({
        attempt,
        item,
        directCompetencyIds,
      }),
    );

  return [...directEvidenceRows, ...prerequisiteInferenceRows];
}

function buildPrerequisiteInferenceRows(input: {
  attempt: CompletedAttemptRow;
  item: PublishableAttemptItemRow;
  directCompetencyIds: Set<string>;
}) {
  const scoringConfig = readScoringPolicyConfig(input.attempt.details);
  if (!canSpreadPrerequisiteEvidence({ item: input.item, scoringConfig })) {
    return [];
  }

  const rows = [];
  const seenCompetencyIds = new Set<string>();
  const queue = (
    input.item.diagnosticItem.primaryCompetency.prerequisites ?? []
  ).map((prerequisite) => ({
    depth: 1,
    edge: prerequisite,
  }));

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;

    const prerequisiteCompetency = next.edge.prerequisite;
    if (
      next.depth > scoringConfig.prerequisiteSpreadMaxDepth ||
      seenCompetencyIds.has(prerequisiteCompetency.id)
    ) {
      continue;
    }

    seenCompetencyIds.add(prerequisiteCompetency.id);

    if (!input.directCompetencyIds.has(prerequisiteCompetency.id)) {
      const inferredScore = prerequisiteInferenceScore(next.depth);
      const inferredConfidence = prerequisiteInferenceConfidence(next.depth);
      rows.push({
        id: createId(),
        learningTrackId: input.attempt.learningTrackId,
        competencyId: prerequisiteCompetency.id,
        sourceType: "initial_diagnostic_prerequisite_inference",
        sourceId: input.item.id,
        observedAt: input.item.answeredAt,
        score: inferredScore,
        confidence: inferredConfidence,
        details: {
          schemaVersion: diagnosticEvidenceDetailsSchemaVersion,
          attemptId: input.attempt.id,
          sourceAttemptItemId: input.item.id,
          sourceDiagnosticItemId: input.item.diagnosticItemId,
          sourceCompetencyId: input.item.diagnosticItem.primaryCompetencyId,
          inferredCompetencyId: prerequisiteCompetency.id,
          inferenceReason: "correct_higher_band_item",
          prerequisiteDepth: next.depth,
          prerequisiteStrength: next.edge.strength ?? 100,
          scoringPolicyVersion: input.attempt.scoringPolicyVersion,
        },
      });
    }

    if (next.depth < scoringConfig.prerequisiteSpreadMaxDepth) {
      for (const nestedEdge of prerequisiteCompetency.prerequisites ?? []) {
        queue.push({
          depth: next.depth + 1,
          edge: nestedEdge,
        });
      }
    }
  }

  return rows;
}

function canSpreadPrerequisiteEvidence(input: {
  item: PublishableAttemptItemRow;
  scoringConfig: typeof defaultInitialDiagnosticPolicyConfig;
}): boolean {
  const itemScore = input.item.score;
  const itemConfidence = input.item.confidence;

  if (
    itemScore < input.scoringConfig.strongCorrectMinScore ||
    itemConfidence < input.scoringConfig.strongCorrectMinConfidence
  ) {
    return false;
  }

  const details = toObject(input.item.details);
  if (details.responseKind === "dont_know") {
    return false;
  }

  return (
    details.responseKind !== "word_bank_sequence" ||
    !input.scoringConfig.requireExactWordBankSequenceForSpread ||
    details.matchedAcceptedTokenSequence === true
  );
}

function readScoringPolicyConfig(details: unknown) {
  const detailsObject = toObject(details);
  const scoringPolicy = toObject(detailsObject.scoringPolicy);
  const config = toObject(scoringPolicy.config);

  return {
    ...defaultInitialDiagnosticPolicyConfig,
    ...config,
  };
}

function prerequisiteInferenceScore(depth: number): number {
  return clamp01(0.85 - (depth - 1) * 0.1);
}

function prerequisiteInferenceConfidence(depth: number): number {
  return clamp01(0.6 - (depth - 1) * 0.1);
}

function clamp01(value: number): number {
  const clampedValue = Math.min(1, Math.max(0, value));
  return Math.round(clampedValue * 1_000_000) / 1_000_000;
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
