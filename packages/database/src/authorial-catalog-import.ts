import { createHash } from "node:crypto";

import {
  competencyCatalogSchema,
  conceptRegistrySchema,
  lifecycleStatusValues,
  validateCompetencyCatalogArtifacts,
  versionedControlledArtifactSchema,
} from "@luma-lingo/shared";
import { v5 as uuidv5 } from "uuid";

export interface ConceptRegistryImportPlan {
  registry: {
    id: string;
    targetLanguage: string;
    version: string;
  };
  concepts: Array<{
    id: string;
    targetLanguage: string;
    key: string;
    label: string;
    aliases: string[];
    status: string;
    replacedByKey: string | null;
  }>;
  summary: {
    concepts: number;
  };
}

export interface CompetencyCatalogImportPlan {
  catalog: {
    id: string;
    targetLanguage: string;
    version: string;
    status: string;
    sourceChecksum: string;
    metadata: Record<string, unknown>;
  };
  competencies: Array<{
    id: string;
    catalogId: string;
    key: string;
    title: string;
    description: string;
    family: string;
    difficultyBand: string;
    taxonomyId: string;
    estimatedDifficultyScore: number | null;
    status: string;
    details: Record<string, unknown>;
  }>;
  relationships: Array<{
    competencyId: string;
    conceptId: string;
    role: "component" | "assumed" | "supporting";
    requiredCapability: string | null;
  }>;
  summary: {
    competencies: number;
    relationships: Record<"component" | "assumed" | "supporting", number>;
  };
}

export interface AuthorialCatalogTransactionClient {
  competencyCatalog: {
    findUnique(input: unknown): Promise<unknown>;
    upsert(input: unknown): Promise<unknown>;
  };
  concept: {
    upsert(input: unknown): Promise<unknown>;
    update(input: unknown): Promise<unknown>;
    count(input: unknown): Promise<number>;
    findMany(input: unknown): Promise<Array<{ id: string; key: string }>>;
  };
  competency: {
    upsert(input: unknown): Promise<unknown>;
    count(input: unknown): Promise<number>;
  };
  competencyConcept: {
    deleteMany(input: unknown): Promise<unknown>;
    createMany(input: unknown): Promise<unknown>;
    count(input: unknown): Promise<number>;
  };
}

export interface AuthorialCatalogPrismaClient {
  $transaction<T>(
    callback: (transaction: AuthorialCatalogTransactionClient) => Promise<T>,
    options?: { timeout?: number },
  ): Promise<T>;
}

export interface ConceptRegistryImportSummary {
  dryRun: boolean;
  registry: ConceptRegistryImportPlan["registry"];
  imported: {
    concepts: number;
  };
  totals: {
    concepts: number;
  } | null;
}

export interface CompetencyCatalogImportSummary {
  dryRun: boolean;
  catalog: {
    id: string;
    targetLanguage: string;
    version: string;
    status: string;
  };
  imported: CompetencyCatalogImportPlan["summary"];
  totals: {
    competencies: number;
    relationships: number;
  } | null;
}

interface TaxonomyEntry {
  id: string;
  status: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function taxonomyEntriesFromArtifact(value: unknown): TaxonomyEntry[] {
  const controlledArtifact = versionedControlledArtifactSchema.safeParse(value);
  if (controlledArtifact.success) {
    return controlledArtifact.data.entries.map((entry) => ({
      id: entry.id,
      status: entry.status,
    }));
  }

  if (!isRecord(value) || value.closed !== true) {
    throw controlledArtifact.error;
  }
  const status = value.status;
  const areas = value.areas;
  const specialFamilies = value.specialFamilies;
  if (
    typeof value.id !== "string" ||
    typeof value.version !== "string" ||
    typeof status !== "string" ||
    !(lifecycleStatusValues as readonly string[]).includes(status) ||
    !Array.isArray(areas) ||
    !Array.isArray(specialFamilies)
  ) {
    throw new Error("Closed taxonomy artifact is invalid");
  }

  const entries: TaxonomyEntry[] = [];
  for (const area of areas) {
    if (!isRecord(area) || !Array.isArray(area.families)) {
      throw new Error("Closed taxonomy area is invalid");
    }
    for (const family of area.families) {
      if (!isRecord(family) || typeof family.id !== "string") {
        throw new Error("Closed taxonomy family is invalid");
      }
      entries.push({ id: family.id, status });
    }
  }
  for (const family of specialFamilies) {
    if (!isRecord(family) || typeof family.id !== "string") {
      throw new Error("Closed taxonomy special family is invalid");
    }
    entries.push({ id: family.id, status });
  }
  return entries;
}

export function buildConceptRegistryImportPlan(
  value: unknown,
): ConceptRegistryImportPlan {
  const registry = conceptRegistrySchema.parse(value);
  const conceptKeys = registry.entries.map((entry) => entry.id);
  if (new Set(conceptKeys).size !== conceptKeys.length) {
    throw new Error("Concept registry contains a duplicate concept identity");
  }
  const conceptKeySet = new Set(conceptKeys);
  for (const entry of registry.entries) {
    if (entry.replacedBy && !conceptKeySet.has(entry.replacedBy)) {
      throw new Error(
        `Concept registry references an unknown replacement concept: ${entry.replacedBy}`,
      );
    }
  }
  const concepts = registry.entries.map((entry) => ({
    id: uuidv5(`concept:${registry.language}:${entry.id}`, uuidv5.URL),
    targetLanguage: registry.language,
    key: entry.id,
    label: entry.label,
    aliases: entry.aliases,
    status: entry.status,
    replacedByKey: entry.replacedBy ?? null,
  }));

  return {
    registry: {
      id: registry.id,
      targetLanguage: registry.language,
      version: registry.version,
    },
    concepts,
    summary: {
      concepts: concepts.length,
    },
  };
}

export function buildCompetencyCatalogImportPlan(input: {
  catalog: unknown;
  conceptRegistry: unknown;
  taxonomyArtifacts: readonly unknown[];
}): CompetencyCatalogImportPlan {
  const catalog = competencyCatalogSchema.parse(input.catalog);
  const conceptRegistry = conceptRegistrySchema.parse(input.conceptRegistry);
  const competencyKeys = catalog.competencies.map(
    (competency) => competency.id,
  );
  if (new Set(competencyKeys).size !== competencyKeys.length) {
    throw new Error("Catalog contains a duplicate competency identity");
  }
  const taxonomyEntries = input.taxonomyArtifacts.flatMap(
    taxonomyEntriesFromArtifact,
  );
  const taxonomyKeys = taxonomyEntries.map((entry) => entry.id);
  if (new Set(taxonomyKeys).size !== taxonomyKeys.length) {
    throw new Error("Taxonomy artifacts contain a duplicate taxonomy identity");
  }
  const inactiveEntryIds = [...conceptRegistry.entries, ...taxonomyEntries]
    .filter((entry) => entry.status !== "active")
    .map((entry) => entry.id);
  const referenceIssues = validateCompetencyCatalogArtifacts({
    catalog,
    taxonomyEntryIds: taxonomyEntries.map((entry) => entry.id),
    conceptEntryIds: conceptRegistry.entries.map((entry) => entry.id),
    inactiveEntryIds,
  });

  if (referenceIssues.length > 0) {
    throw new Error(
      `Catalog has invalid references: ${referenceIssues
        .map((issue) => issue.code)
        .join(", ")}`,
    );
  }

  for (const competency of catalog.competencies) {
    const conceptKeys = [
      ...competency.componentConceptIds,
      ...competency.assumedConcepts.map(({ conceptId }) => conceptId),
      ...competency.supportingConceptIds,
    ];
    if (new Set(conceptKeys).size !== conceptKeys.length) {
      throw new Error(
        `Competency assigns multiple concept roles to the same concept: ${competency.id}`,
      );
    }
  }

  const catalogId = uuidv5(
    `competency-catalog:${catalog.language}:${catalog.version}`,
    uuidv5.URL,
  );
  const competencies = catalog.competencies.map((competency) => ({
    id: uuidv5(`competency:${catalogId}:${competency.id}`, uuidv5.URL),
    catalogId,
    key: competency.id,
    title: competency.title,
    description: competency.descriptor,
    family: competency.type,
    difficultyBand: competency.level,
    taxonomyId: competency.taxonomyId,
    estimatedDifficultyScore: competency.estimatedGseScore ?? null,
    status: competency.status,
    details: {
      searchTerms: competency.searchTerms,
      examples: competency.examples,
      sourceReferences: competency.sourceReferences,
    },
  }));
  const competencyIdByKey = new Map(
    competencies.map((competency) => [competency.key, competency.id]),
  );
  const conceptId = (key: string) =>
    uuidv5(`concept:${catalog.language}:${key}`, uuidv5.URL);
  const relationships = catalog.competencies.flatMap((competency) => {
    const competencyId = competencyIdByKey.get(competency.id);
    if (!competencyId) {
      throw new Error(
        `Missing runtime identity for competency ${competency.id}`,
      );
    }

    return [
      ...competency.componentConceptIds.map((key) => ({
        competencyId,
        conceptId: conceptId(key),
        role: "component" as const,
        requiredCapability: null,
      })),
      ...competency.assumedConcepts.map((assumed) => ({
        competencyId,
        conceptId: conceptId(assumed.conceptId),
        role: "assumed" as const,
        requiredCapability: assumed.requiredCapability,
      })),
      ...competency.supportingConceptIds.map((key) => ({
        competencyId,
        conceptId: conceptId(key),
        role: "supporting" as const,
        requiredCapability: null,
      })),
    ];
  });

  return {
    catalog: {
      id: catalogId,
      targetLanguage: catalog.language,
      version: catalog.version,
      status: catalog.publicationStatus,
      sourceChecksum: createHash("sha256")
        .update(JSON.stringify(catalog))
        .digest("hex"),
      metadata: {
        authorialCatalogId: catalog.id,
        schemaVersion: 1,
      },
    },
    competencies,
    relationships,
    summary: {
      competencies: competencies.length,
      relationships: {
        component: relationships.filter(({ role }) => role === "component")
          .length,
        assumed: relationships.filter(({ role }) => role === "assumed").length,
        supporting: relationships.filter(({ role }) => role === "supporting")
          .length,
      },
    },
  };
}

export async function importConceptRegistry(
  prisma: AuthorialCatalogPrismaClient,
  input: {
    registry: unknown;
    dryRun?: boolean;
    transactionTimeoutMs?: number;
  },
): Promise<ConceptRegistryImportSummary> {
  const plan = buildConceptRegistryImportPlan(input.registry);
  if (input.dryRun) {
    return {
      dryRun: true,
      registry: plan.registry,
      imported: plan.summary,
      totals: null,
    };
  }

  return prisma.$transaction(
    async (transaction) => {
      for (const concept of plan.concepts) {
        const { replacedByKey: _replacedByKey, ...conceptData } = concept;
        const details = {
          registryId: plan.registry.id,
          registryVersion: plan.registry.version,
        };
        await transaction.concept.upsert({
          where: {
            targetLanguage_key: {
              targetLanguage: concept.targetLanguage,
              key: concept.key,
            },
          },
          create: {
            ...conceptData,
            replacedByConceptId: null,
            details,
          },
          update: {
            label: concept.label,
            aliases: concept.aliases,
            status: concept.status,
            replacedByConceptId: null,
            details,
          },
        });
      }

      const conceptIdByKey = new Map(
        plan.concepts.map((concept) => [concept.key, concept.id]),
      );
      for (const concept of plan.concepts) {
        if (!concept.replacedByKey) continue;
        await transaction.concept.update({
          where: { id: concept.id },
          data: {
            replacedByConceptId: conceptIdByKey.get(concept.replacedByKey),
          },
        });
      }

      const totalConcepts = await transaction.concept.count({
        where: { targetLanguage: plan.registry.targetLanguage },
      });

      return {
        dryRun: false,
        registry: plan.registry,
        imported: plan.summary,
        totals: {
          concepts: totalConcepts,
        },
      };
    },
    { timeout: input.transactionTimeoutMs },
  );
}

export async function importCompetencyCatalog(
  prisma: AuthorialCatalogPrismaClient,
  input: {
    catalog: unknown;
    conceptRegistry: unknown;
    taxonomyArtifacts: readonly unknown[];
    dryRun?: boolean;
    transactionTimeoutMs?: number;
    now?: () => Date;
  },
): Promise<CompetencyCatalogImportSummary> {
  const plan = buildCompetencyCatalogImportPlan(input);
  const catalogSummary = {
    id: plan.catalog.id,
    targetLanguage: plan.catalog.targetLanguage,
    version: plan.catalog.version,
    status: plan.catalog.status,
  };
  if (input.dryRun) {
    return {
      dryRun: true,
      catalog: catalogSummary,
      imported: plan.summary,
      totals: null,
    };
  }

  return prisma.$transaction(
    async (transaction) => {
      const existingCatalog = (await transaction.competencyCatalog.findUnique({
        where: {
          targetLanguage_version: {
            targetLanguage: plan.catalog.targetLanguage,
            version: plan.catalog.version,
          },
        },
        select: {
          sourceChecksum: true,
          status: true,
          publishedAt: true,
        },
      })) as {
        sourceChecksum?: string | null;
        status?: string;
        publishedAt?: Date | null;
      } | null;
      if (
        existingCatalog?.status === "published" &&
        existingCatalog.sourceChecksum &&
        existingCatalog.sourceChecksum !== plan.catalog.sourceChecksum
      ) {
        throw new Error(
          "Published competency catalog content cannot change for the same version",
        );
      }

      const referencedConceptIds = [
        ...new Set(
          plan.relationships.map((relationship) => relationship.conceptId),
        ),
      ];
      const storedConcepts = await transaction.concept.findMany({
        where: {
          targetLanguage: plan.catalog.targetLanguage,
          id: { in: referencedConceptIds },
        },
        select: { id: true, key: true },
      });
      const storedConceptIds = new Set(
        storedConcepts.map((concept) => concept.id),
      );
      const missingStoredConcepts = referencedConceptIds.filter(
        (conceptId) => !storedConceptIds.has(conceptId),
      );
      if (missingStoredConcepts.length > 0) {
        throw new Error(
          `Catalog references ${missingStoredConcepts.length} concepts not imported into the database`,
        );
      }

      const publishedAt =
        plan.catalog.status === "published"
          ? (existingCatalog?.publishedAt ??
            (input.now ?? (() => new Date()))())
          : null;
      await transaction.competencyCatalog.upsert({
        where: {
          targetLanguage_version: {
            targetLanguage: plan.catalog.targetLanguage,
            version: plan.catalog.version,
          },
        },
        create: {
          ...plan.catalog,
          publishedAt,
        },
        update: {
          status: plan.catalog.status,
          publishedAt,
          sourceChecksum: plan.catalog.sourceChecksum,
          metadata: plan.catalog.metadata,
        },
      });

      for (const competency of plan.competencies) {
        const {
          id: _id,
          catalogId: _catalogId,
          ...mutableCompetency
        } = competency;
        await transaction.competency.upsert({
          where: {
            catalogId_key: {
              catalogId: competency.catalogId,
              key: competency.key,
            },
          },
          create: competency,
          update: mutableCompetency,
        });
      }

      const competencyIds = plan.competencies.map(({ id }) => id);
      await transaction.competencyConcept.deleteMany({
        where: { competencyId: { in: competencyIds } },
      });
      if (plan.relationships.length > 0) {
        await transaction.competencyConcept.createMany({
          data: plan.relationships,
        });
      }

      const [totalCompetencies, totalRelationships] = await Promise.all([
        transaction.competency.count({
          where: { catalogId: plan.catalog.id },
        }),
        transaction.competencyConcept.count({
          where: { competency: { catalogId: plan.catalog.id } },
        }),
      ]);

      return {
        dryRun: false,
        catalog: catalogSummary,
        imported: plan.summary,
        totals: {
          competencies: totalCompetencies,
          relationships: totalRelationships,
        },
      };
    },
    { timeout: input.transactionTimeoutMs },
  );
}
