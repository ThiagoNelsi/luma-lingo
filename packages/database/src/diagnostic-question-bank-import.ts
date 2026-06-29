import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  authoredDiagnosticQuestionBankSchema,
  type AuthoredDiagnosticQuestionBank,
} from "@luma-lingo/shared";
import type { PrismaClient } from "@prisma/client";

type JsonObject = Record<string, unknown>;

export interface DiagnosticQuestionBankImportCatalog {
  id: string;
  targetLanguage: string;
  version: string;
  metadata?: unknown;
}

export interface DiagnosticQuestionBankImportCompetency {
  id: string;
  key: string;
}

export interface DiagnosticQuestionBankImportItemRow {
  id: string;
  catalogId: string;
  key: string;
  primaryCompetencyId: string;
  difficultyBand: string;
  responseFormat: string;
  status: string;
  prompt: JsonObject;
  scoringRule: JsonObject;
  details: JsonObject;
  reviewedAt: Date | null;
  publishedAt: Date | null;
}

export interface DiagnosticQuestionBankImportTargetRow {
  diagnosticItemId: string;
  competencyId: string;
  role: string;
  weight: number;
  details: JsonObject;
}

export interface DiagnosticQuestionBankImportPlan {
  catalog: {
    id: string;
    targetLanguage: string;
    version: string;
  };
  diagnosticItems: DiagnosticQuestionBankImportItemRow[];
  diagnosticTargets: DiagnosticQuestionBankImportTargetRow[];
  catalogMetadata: JsonObject;
  summary: {
    diagnosticItems: number;
    diagnosticTargets: number;
  };
}

export interface BuildDiagnosticQuestionBankImportPlanInput {
  questionBank: AuthoredDiagnosticQuestionBank;
  catalog: DiagnosticQuestionBankImportCatalog;
  competencies: DiagnosticQuestionBankImportCompetency[];
  importedAt: Date;
  sourceFile?: string;
}

export interface DiagnosticQuestionBankImportSummary {
  dryRun: boolean;
  catalog: {
    id: string;
    targetLanguage: string;
    version: string;
  };
  imported: {
    diagnosticItems: number;
    diagnosticTargets: number;
  };
  catalogTotals: {
    diagnosticItems: number;
    diagnosticTargets: number;
  } | null;
}

type DiagnosticQuestionBankImportTransaction = {
  competencyCatalog: {
    findUnique(input: unknown): Promise<
      | (DiagnosticQuestionBankImportCatalog & {
          competencies: DiagnosticQuestionBankImportCompetency[];
        })
      | null
    >;
    update(input: unknown): Promise<unknown>;
  };
  diagnosticItem: {
    upsert(input: unknown): Promise<unknown>;
    count(input: unknown): Promise<number>;
  };
  diagnosticItemCompetencyTarget: {
    deleteMany(input: unknown): Promise<unknown>;
    createMany(input: unknown): Promise<unknown>;
    count(input: unknown): Promise<number>;
  };
};

export function parseDiagnosticQuestionBank(
  value: unknown,
): AuthoredDiagnosticQuestionBank {
  return authoredDiagnosticQuestionBankSchema.parse(value);
}

export async function readDiagnosticQuestionBankFile(
  path: string,
): Promise<{ text: string; questionBank: AuthoredDiagnosticQuestionBank }> {
  const text = await readFile(path, "utf8");

  return {
    text,
    questionBank: parseDiagnosticQuestionBank(JSON.parse(text)),
  };
}

export function buildDiagnosticQuestionBankImportPlan(
  input: BuildDiagnosticQuestionBankImportPlanInput,
): DiagnosticQuestionBankImportPlan {
  assertCatalogMatchesQuestionBank(input.catalog, input.questionBank);

  const competencyByKey = new Map(
    input.competencies.map((competency) => [competency.key, competency]),
  );
  assertQuestionBankReferencesKnownCompetencies(
    input.questionBank,
    competencyByKey,
  );

  const duplicateItemKeys = findDuplicates(
    input.questionBank.items.map((item) => item.key),
  );
  if (duplicateItemKeys.length > 0) {
    throw new Error(
      `Question bank has duplicate diagnostic item keys: ${duplicateItemKeys.join(
        ", ",
      )}`,
    );
  }

  const diagnosticItems = input.questionBank.items.map((item) => {
    const primaryCompetency = competencyByKey.get(item.primaryCompetencyKey);
    if (!primaryCompetency) {
      throw new Error(
        `Question bank references unknown competency: ${item.primaryCompetencyKey}`,
      );
    }

    return {
      id: deterministicUuid(
        "diagnostic-item",
        `${input.catalog.id}:${item.key}`,
      ),
      catalogId: input.catalog.id,
      key: item.key,
      primaryCompetencyId: primaryCompetency.id,
      difficultyBand: item.difficultyBand,
      responseFormat: item.responseFormat,
      status: item.status,
      prompt: compactJson(item.prompt),
      scoringRule: compactJson(item.scoringRule),
      details: compactJson(item.details),
      reviewedAt:
        item.status === "reviewed" || item.status === "published"
          ? input.importedAt
          : null,
      publishedAt: item.status === "published" ? input.importedAt : null,
    };
  });

  const diagnosticItemIdByKey = new Map(
    diagnosticItems.map((item) => [item.key, item.id]),
  );
  const diagnosticTargets = input.questionBank.items.flatMap((item) =>
    item.targets.map((target) => {
      const diagnosticItemId = diagnosticItemIdByKey.get(item.key);
      const competency = competencyByKey.get(target.competencyKey);
      if (!diagnosticItemId || !competency) {
        throw new Error(
          `Question bank references unknown diagnostic item target: ${item.key}/${target.competencyKey}`,
        );
      }

      return {
        diagnosticItemId,
        competencyId: competency.id,
        role: target.role,
        weight: target.weight,
        details: compactJson(target.details),
      };
    }),
  );

  return {
    catalog: {
      id: input.catalog.id,
      targetLanguage: input.catalog.targetLanguage,
      version: input.catalog.version,
    },
    diagnosticItems,
    diagnosticTargets,
    catalogMetadata: buildCatalogMetadata(input),
    summary: {
      diagnosticItems: diagnosticItems.length,
      diagnosticTargets: diagnosticTargets.length,
    },
  };
}

export async function importDiagnosticQuestionBank(
  prisma: PrismaClient,
  input: {
    questionBank: AuthoredDiagnosticQuestionBank;
    dryRun?: boolean;
    sourceFile?: string;
    transactionTimeoutMs?: number;
    now?: () => Date;
  },
): Promise<DiagnosticQuestionBankImportSummary> {
  return prisma.$transaction(
    async (tx) =>
      writeDiagnosticQuestionBank(
        tx as unknown as DiagnosticQuestionBankImportTransaction,
        input,
      ),
    {
      timeout: input.transactionTimeoutMs,
    },
  );
}

async function writeDiagnosticQuestionBank(
  tx: DiagnosticQuestionBankImportTransaction,
  input: {
    questionBank: AuthoredDiagnosticQuestionBank;
    dryRun?: boolean;
    sourceFile?: string;
    now?: () => Date;
  },
): Promise<DiagnosticQuestionBankImportSummary> {
  const catalog = await tx.competencyCatalog.findUnique({
    where: {
      targetLanguage_version: {
        targetLanguage: input.questionBank.targetLanguage,
        version: input.questionBank.catalogVersion,
      },
    },
    include: {
      competencies: {
        select: {
          id: true,
          key: true,
        },
      },
    },
  });

  if (!catalog) {
    throw new Error(
      `CompetencyCatalog not found for ${input.questionBank.targetLanguage}/${input.questionBank.catalogVersion}. Import competencies first.`,
    );
  }

  const plan = buildDiagnosticQuestionBankImportPlan({
    questionBank: input.questionBank,
    catalog,
    competencies: catalog.competencies,
    importedAt: input.now?.() ?? new Date(),
    sourceFile: input.sourceFile,
  });

  if (input.dryRun) {
    return {
      dryRun: true,
      catalog: plan.catalog,
      imported: {
        diagnosticItems: plan.summary.diagnosticItems,
        diagnosticTargets: plan.summary.diagnosticTargets,
      },
      catalogTotals: null,
    };
  }

  for (const item of plan.diagnosticItems) {
    await tx.diagnosticItem.upsert({
      where: {
        catalogId_key: {
          catalogId: item.catalogId,
          key: item.key,
        },
      },
      create: item,
      update: {
        primaryCompetencyId: item.primaryCompetencyId,
        difficultyBand: item.difficultyBand,
        responseFormat: item.responseFormat,
        status: item.status,
        prompt: item.prompt,
        scoringRule: item.scoringRule,
        details: item.details,
        reviewedAt: item.reviewedAt,
        publishedAt: item.publishedAt,
      },
    });
  }

  await tx.diagnosticItemCompetencyTarget.deleteMany({
    where: {
      diagnosticItemId: {
        in: plan.diagnosticItems.map((item) => item.id),
      },
    },
  });

  if (plan.diagnosticTargets.length > 0) {
    await tx.diagnosticItemCompetencyTarget.createMany({
      data: plan.diagnosticTargets,
    });
  }

  await tx.competencyCatalog.update({
    where: {
      id: catalog.id,
    },
    data: {
      metadata: plan.catalogMetadata,
    },
  });

  const [diagnosticItems, diagnosticTargets] = await Promise.all([
    tx.diagnosticItem.count({
      where: {
        catalogId: catalog.id,
      },
    }),
    tx.diagnosticItemCompetencyTarget.count({
      where: {
        diagnosticItem: {
          catalogId: catalog.id,
        },
      },
    }),
  ]);

  return {
    dryRun: false,
    catalog: plan.catalog,
    imported: {
      diagnosticItems: plan.summary.diagnosticItems,
      diagnosticTargets: plan.summary.diagnosticTargets,
    },
    catalogTotals: {
      diagnosticItems,
      diagnosticTargets,
    },
  };
}

function assertCatalogMatchesQuestionBank(
  catalog: DiagnosticQuestionBankImportCatalog,
  questionBank: AuthoredDiagnosticQuestionBank,
) {
  if (catalog.targetLanguage !== questionBank.targetLanguage) {
    throw new Error(
      `Question bank target language ${questionBank.targetLanguage} does not match catalog target language ${catalog.targetLanguage}`,
    );
  }

  if (catalog.version !== questionBank.catalogVersion) {
    throw new Error(
      `Question bank catalog version ${questionBank.catalogVersion} does not match catalog version ${catalog.version}`,
    );
  }
}

function assertQuestionBankReferencesKnownCompetencies(
  questionBank: AuthoredDiagnosticQuestionBank,
  competencyByKey: Map<string, DiagnosticQuestionBankImportCompetency>,
) {
  const missingCompetencyKeys = new Set<string>();

  for (const item of questionBank.items) {
    if (!competencyByKey.has(item.primaryCompetencyKey)) {
      missingCompetencyKeys.add(item.primaryCompetencyKey);
    }

    for (const target of item.targets) {
      if (!competencyByKey.has(target.competencyKey)) {
        missingCompetencyKeys.add(target.competencyKey);
      }
    }
  }

  if (missingCompetencyKeys.size > 0) {
    throw new Error(
      `Question bank references unknown competencies: ${Array.from(
        missingCompetencyKeys,
      )
        .sort()
        .join(", ")}`,
    );
  }
}

function buildCatalogMetadata(
  input: BuildDiagnosticQuestionBankImportPlanInput,
): JsonObject {
  return {
    ...toJsonObject(input.catalog.metadata),
    diagnosticQuestionBank: {
      schemaVersion: input.questionBank.schemaVersion,
      purpose: input.questionBank.purpose,
      itemCount: input.questionBank.items.length,
      sourceFile: input.sourceFile,
      importedAt: input.importedAt.toISOString(),
    },
  };
}

function compactJson(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, compactJsonValue(entry)]),
  );
}

function compactJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compactJsonValue);
  if (!value || typeof value !== "object") return value;

  return compactJson(value);
}

function toJsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value }
    : {};
}

function deterministicUuid(namespace: string, value: string): string {
  const hex = createHash("sha256")
    .update(`${namespace}:${value}`)
    .digest("hex")
    .slice(0, 32);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    else seen.add(value);
  }

  return Array.from(duplicates).sort();
}
