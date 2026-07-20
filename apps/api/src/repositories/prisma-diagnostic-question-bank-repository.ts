import type { PrismaClient } from "@luma-lingo/database";

import {
  diagnosticQuestionBankItemSchema,
  diagnosticQuestionBankSchema,
  type DiagnosticQuestionBank,
} from "../diagnostics/diagnostic-question-bank.js";
import type { DiagnosticQuestionBankRepository } from "../diagnostics/diagnostic-question-bank-repository.js";

type DiagnosticQuestionBankCatalogRow = {
  id: string;
  targetLanguage: string;
  version: string;
  status: string;
  publishedAt: Date | null;
  diagnosticItems: DiagnosticQuestionBankItemRow[];
};

type DiagnosticQuestionBankItemRow = {
  id: string;
  key: string;
  primaryCompetencyId: string | null;
  primaryConceptId: string | null;
  difficultyBand: string;
  mode: string;
  responseFormat: string;
  status: string;
  prompt: unknown;
  scoringRule: unknown;
  details: unknown;
  reviewedAt: Date | null;
  publishedAt: Date | null;
  primaryCompetency: {
    id: string;
    key: string;
    family: string;
    difficultyBand: string | null;
  } | null;
  primaryConcept: {
    id: string;
    key: string;
  } | null;
  conceptEvidenceMappings: DiagnosticQuestionBankEvidenceMappingRow[];
};

type DiagnosticQuestionBankEvidenceMappingRow = {
  conceptId: string;
  capability: string;
  strength: number;
  concept: {
    id: string;
    key: string;
  };
};

export class PrismaDiagnosticQuestionBankRepository implements DiagnosticQuestionBankRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findPublishedOnboardingQuestionBank(
    targetLanguage: string,
  ): Promise<DiagnosticQuestionBank | null> {
    const row = await this.prisma.competencyCatalog.findFirst({
      where: {
        targetLanguage,
        status: "published",
        diagnosticItems: {
          some: {
            status: "published",
          },
        },
      },
      orderBy: [
        {
          publishedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      include: {
        diagnosticItems: {
          where: {
            status: "published",
          },
          orderBy: {
            key: "asc",
          },
          include: {
            primaryCompetency: {
              select: {
                id: true,
                key: true,
                family: true,
                difficultyBand: true,
              },
            },
            primaryConcept: {
              select: {
                id: true,
                key: true,
              },
            },
            conceptEvidenceMappings: {
              include: {
                concept: {
                  select: {
                    id: true,
                    key: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return row
      ? toDiagnosticQuestionBank(
          row as unknown as DiagnosticQuestionBankCatalogRow,
        )
      : null;
  }
}

function toDiagnosticQuestionBank(
  row: DiagnosticQuestionBankCatalogRow,
): DiagnosticQuestionBank {
  return diagnosticQuestionBankSchema.parse({
    catalog: {
      id: row.id,
      targetLanguage: row.targetLanguage,
      version: row.version,
      status: row.status,
      publishedAt: row.publishedAt,
    },
    items: row.diagnosticItems.map(toDiagnosticQuestionBankItem),
  }) as DiagnosticQuestionBank;
}

function toDiagnosticQuestionBankItem(row: DiagnosticQuestionBankItemRow) {
  return diagnosticQuestionBankItemSchema.parse({
    id: row.id,
    key: row.key,
    primaryCompetencyId: row.primaryCompetencyId,
    primaryCompetencyKey: row.primaryCompetency?.key ?? null,
    primaryConceptId: row.primaryConceptId,
    primaryConceptKey: row.primaryConcept?.key ?? null,
    mode: row.mode,
    primaryCompetency: row.primaryCompetency
      ? {
          id: row.primaryCompetency.id,
          key: row.primaryCompetency.key,
          family: row.primaryCompetency.family,
          mode: null,
          difficultyBand: row.primaryCompetency.difficultyBand,
          isCore: false,
          prerequisites: [],
          goalPriorities: [],
        }
      : undefined,
    difficultyBand: row.difficultyBand,
    responseFormat: row.responseFormat,
    status: row.status,
    prompt: row.prompt,
    scoringRule: row.scoringRule,
    details: row.details,
    reviewedAt: row.reviewedAt,
    publishedAt: row.publishedAt,
    targets: [],
    evidenceMappings: [...(row.conceptEvidenceMappings ?? [])]
      .sort(compareEvidenceMappings)
      .map((mapping) => ({
        conceptId: mapping.conceptId,
        conceptKey: mapping.concept.key,
        capability: mapping.capability,
        strength: mapping.strength,
      })),
  });
}

function compareEvidenceMappings(
  left: DiagnosticQuestionBankEvidenceMappingRow,
  right: DiagnosticQuestionBankEvidenceMappingRow,
): number {
  return (
    left.concept.key.localeCompare(right.concept.key) ||
    left.capability.localeCompare(right.capability)
  );
}
