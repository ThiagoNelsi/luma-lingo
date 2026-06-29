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
  primaryCompetencyId: string;
  difficultyBand: string;
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
    mode: string | null;
    difficultyBand: string | null;
    isCore: boolean;
    prerequisites: Array<{
      strength: number | null;
      prerequisite: {
        id: string;
        key: string;
      };
    }>;
    goalPriorities: Array<{
      goal: string;
      priority: number;
    }>;
  };
  competencyTargets: DiagnosticQuestionBankTargetRow[];
};

type DiagnosticQuestionBankTargetRow = {
  competencyId: string;
  role: string;
  weight: number | null;
  details: unknown;
  competency: {
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
                mode: true,
                difficultyBand: true,
                isCore: true,
                prerequisites: {
                  select: {
                    strength: true,
                    prerequisite: {
                      select: {
                        id: true,
                        key: true,
                      },
                    },
                  },
                  orderBy: {
                    prerequisite: {
                      key: "asc",
                    },
                  },
                },
                goalPriorities: {
                  select: {
                    goal: true,
                    priority: true,
                  },
                  orderBy: {
                    goal: "asc",
                  },
                },
              },
            },
            competencyTargets: {
              include: {
                competency: {
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
      ? toDiagnosticQuestionBank(row as DiagnosticQuestionBankCatalogRow)
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
    primaryCompetencyKey: row.primaryCompetency.key,
    primaryCompetency: {
      id: row.primaryCompetency.id,
      key: row.primaryCompetency.key,
      family: row.primaryCompetency.family,
      mode: row.primaryCompetency.mode,
      difficultyBand: row.primaryCompetency.difficultyBand,
      isCore: row.primaryCompetency.isCore,
      prerequisites: row.primaryCompetency.prerequisites.map(
        (prerequisite) => ({
          competencyId: prerequisite.prerequisite.id,
          competencyKey: prerequisite.prerequisite.key,
          strength: prerequisite.strength,
        }),
      ),
      goalPriorities: row.primaryCompetency.goalPriorities.map((priority) => ({
        goal: priority.goal,
        priority: priority.priority,
      })),
    },
    difficultyBand: row.difficultyBand,
    responseFormat: row.responseFormat,
    status: row.status,
    prompt: row.prompt,
    scoringRule: row.scoringRule,
    details: row.details,
    reviewedAt: row.reviewedAt,
    publishedAt: row.publishedAt,
    targets: [...row.competencyTargets].sort(compareTargets).map((target) => ({
      competencyId: target.competencyId,
      competencyKey: target.competency.key,
      role: target.role,
      weight: target.weight ?? 100,
      details: toObject(target.details),
    })),
  });
}

function compareTargets(
  left: DiagnosticQuestionBankTargetRow,
  right: DiagnosticQuestionBankTargetRow,
): number {
  if (left.role !== right.role) {
    if (left.role === "primary") return -1;
    if (right.role === "primary") return 1;
  }

  return left.competency.key.localeCompare(right.competency.key);
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value }
    : {};
}
