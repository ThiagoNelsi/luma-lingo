import { describe, expect, it } from "vitest";
import { v5 as uuidv5 } from "uuid";

import {
  buildCompetencyCatalogImportPlan,
  buildConceptRegistryImportPlan,
  importCompetencyCatalog,
  importConceptRegistry,
} from "./authorial-catalog-import.js";

const syntheticConceptRegistry = {
  id: "synthetic-concept-registry",
  language: "en",
  version: "1.0.0",
  entries: [
    {
      id: "function.request.polite",
      label: "Polite request",
      aliases: [],
      status: "active",
    },
    {
      id: "form.modal.could",
      label: "Could",
      aliases: [],
      status: "active",
    },
  ],
};

const syntheticTaxonomy = {
  id: "synthetic-function-taxonomy",
  language: "en",
  version: "1.0.0",
  entries: [
    {
      id: "requests.polite",
      label: "Polite requests",
      aliases: [],
      status: "active",
    },
  ],
};

function syntheticCatalog() {
  return {
    id: "synthetic-a1-catalog",
    language: "en",
    version: "1.0.0",
    publicationStatus: "published",
    competencies: [
      {
        id: "en.make-polite-requests.a1",
        status: "active",
        type: "function",
        level: "a1",
        taxonomyId: "requests.polite",
        title: "Make polite requests",
        descriptor: "Can make a short polite request.",
        estimatedGseScore: 24,
        searchTerms: ["polite request"],
        examples: ["Could you help?"],
        sourceReferences: [
          {
            source: "synthetic",
            sourceVersion: "1",
            recordId: "source-1",
            codes: [],
          },
        ],
        componentConceptIds: ["function.request.polite"],
        assumedConcepts: [
          {
            conceptId: "form.modal.could",
            requiredCapability: "recognition",
          },
        ],
        supportingConceptIds: [],
      },
    ],
  };
}

describe("authorial catalog import", () => {
  it("maps a valid concept registry to deterministic runtime identities", () => {
    const plan = buildConceptRegistryImportPlan({
      id: "synthetic-concept-registry",
      language: "en",
      version: "1.0.0",
      entries: [
        {
          id: "function.request.polite",
          label: "Polite request",
          aliases: ["courteous request"],
          status: "active",
        },
      ],
    });

    expect(plan).toEqual({
      registry: {
        id: "synthetic-concept-registry",
        targetLanguage: "en",
        version: "1.0.0",
      },
      concepts: [
        {
          id: uuidv5("concept:en:function.request.polite", uuidv5.URL),
          targetLanguage: "en",
          key: "function.request.polite",
          label: "Polite request",
          aliases: ["courteous request"],
          status: "active",
          replacedByKey: null,
        },
      ],
      summary: {
        concepts: 1,
      },
    });
  });

  it("rejects duplicate concept identities before import", () => {
    expect(() =>
      buildConceptRegistryImportPlan({
        id: "synthetic-concept-registry",
        language: "en",
        version: "1.0.0",
        entries: [
          {
            id: "function.request.polite",
            label: "Polite request",
            aliases: [],
            status: "active",
          },
          {
            id: "function.request.polite",
            label: "Duplicate request",
            aliases: [],
            status: "active",
          },
        ],
      }),
    ).toThrow(/duplicate concept identity/i);
  });

  it("rejects replacement references outside the concept registry", () => {
    expect(() =>
      buildConceptRegistryImportPlan({
        id: "synthetic-concept-registry",
        language: "en",
        version: "1.0.0",
        entries: [
          {
            id: "function.request.polite",
            label: "Polite request",
            aliases: [],
            status: "replaced",
            replacedBy: "function.request.unknown",
          },
        ],
      }),
    ).toThrow(/unknown replacement concept/i);
  });

  it("persists a concept replacement after both identities exist", async () => {
    const registry = {
      id: "synthetic-concept-registry",
      language: "en",
      version: "1.0.0",
      entries: [
        {
          id: "function.request.old",
          label: "Old request",
          aliases: [],
          status: "replaced",
          replacedBy: "function.request.polite",
        },
        {
          id: "function.request.polite",
          label: "Polite request",
          aliases: [],
          status: "active",
        },
      ],
    };
    const updates: unknown[] = [];
    const transaction = {
      concept: {
        upsert: async () => ({}),
        update: async (input: unknown) => {
          updates.push(input);
          return {};
        },
        count: async () => 2,
      },
    };
    const prisma = {
      $transaction: async <T>(
        callback: (client: typeof transaction) => Promise<T>,
      ) => callback(transaction),
    };

    await importConceptRegistry(prisma as never, { registry });

    expect(updates).toEqual([
      {
        where: {
          id: uuidv5("concept:en:function.request.old", uuidv5.URL),
        },
        data: {
          replacedByConceptId: uuidv5(
            "concept:en:function.request.polite",
            uuidv5.URL,
          ),
        },
      },
    ]);
  });

  it("maps an authorial catalog to normalized runtime competency relationships", () => {
    const plan = buildCompetencyCatalogImportPlan({
      catalog: syntheticCatalog(),
      conceptRegistry: syntheticConceptRegistry,
      taxonomyArtifacts: [syntheticTaxonomy],
    });
    const catalogId = uuidv5("competency-catalog:en:1.0.0", uuidv5.URL);
    const competencyId = uuidv5(
      `competency:${catalogId}:en.make-polite-requests.a1`,
      uuidv5.URL,
    );

    expect(plan.catalog).toEqual(
      expect.objectContaining({
        id: catalogId,
        targetLanguage: "en",
        version: "1.0.0",
        status: "published",
      }),
    );
    expect(plan.competencies).toEqual([
      expect.objectContaining({
        id: competencyId,
        catalogId,
        key: "en.make-polite-requests.a1",
        title: "Make polite requests",
        description: "Can make a short polite request.",
        family: "function",
        difficultyBand: "a1",
        taxonomyId: "requests.polite",
        estimatedDifficultyScore: 24,
        status: "active",
      }),
    ]);
    expect(plan.relationships).toEqual([
      {
        competencyId,
        conceptId: uuidv5("concept:en:function.request.polite", uuidv5.URL),
        role: "component",
        requiredCapability: null,
      },
      {
        competencyId,
        conceptId: uuidv5("concept:en:form.modal.could", uuidv5.URL),
        role: "assumed",
        requiredCapability: "recognition",
      },
    ]);
    expect(plan.summary).toEqual({
      competencies: 1,
      relationships: {
        component: 1,
        assumed: 1,
        supporting: 0,
      },
    });
  });

  it("rejects catalog references to unknown concepts", () => {
    const catalog = syntheticCatalog();
    catalog.competencies[0]!.componentConceptIds = ["function.request.unknown"];

    expect(() =>
      buildCompetencyCatalogImportPlan({
        catalog,
        conceptRegistry: syntheticConceptRegistry,
        taxonomyArtifacts: [syntheticTaxonomy],
      }),
    ).toThrow(/missing_concept_entry/);
  });

  it("rejects duplicate competency identities before import", () => {
    const catalog = syntheticCatalog();
    catalog.competencies.push(structuredClone(catalog.competencies[0]!));

    expect(() =>
      buildCompetencyCatalogImportPlan({
        catalog,
        conceptRegistry: syntheticConceptRegistry,
        taxonomyArtifacts: [syntheticTaxonomy],
      }),
    ).toThrow(/duplicate competency identity/i);
  });

  it("rejects duplicate taxonomy identities across artifacts", () => {
    expect(() =>
      buildCompetencyCatalogImportPlan({
        catalog: syntheticCatalog(),
        conceptRegistry: syntheticConceptRegistry,
        taxonomyArtifacts: [syntheticTaxonomy, syntheticTaxonomy],
      }),
    ).toThrow(/duplicate taxonomy identity/i);
  });

  it("rejects inactive references from a published catalog", () => {
    const conceptRegistry = structuredClone(syntheticConceptRegistry);
    conceptRegistry.entries[0]!.status = "draft";

    expect(() =>
      buildCompetencyCatalogImportPlan({
        catalog: syntheticCatalog(),
        conceptRegistry,
        taxonomyArtifacts: [syntheticTaxonomy],
      }),
    ).toThrow(/published_reference_must_be_active/);
  });

  it("rejects a concept assigned to multiple roles in one competency", () => {
    const catalog = syntheticCatalog();
    catalog.competencies[0]!.assumedConcepts = [
      {
        conceptId: "function.request.polite",
        requiredCapability: "recognition",
      },
    ];

    expect(() =>
      buildCompetencyCatalogImportPlan({
        catalog,
        conceptRegistry: syntheticConceptRegistry,
        taxonomyArtifacts: [syntheticTaxonomy],
      }),
    ).toThrow(/multiple concept roles/i);
  });

  it("keeps componentless competencies without inventing relationships", () => {
    const catalog = syntheticCatalog();
    catalog.competencies[0]!.componentConceptIds = [];
    catalog.competencies[0]!.assumedConcepts = [];

    const plan = buildCompetencyCatalogImportPlan({
      catalog,
      conceptRegistry: syntheticConceptRegistry,
      taxonomyArtifacts: [syntheticTaxonomy],
    });

    expect(plan.competencies).toHaveLength(1);
    expect(plan.relationships).toEqual([]);
  });

  it("inherits lifecycle status from a closed grammar taxonomy", () => {
    const catalog = syntheticCatalog();
    catalog.competencies[0]!.type = "grammar";
    catalog.competencies[0]!.taxonomyId = "verb_forms.modals";
    const grammarTaxonomy = {
      id: "synthetic-grammar-taxonomy",
      version: "1.0.0",
      status: "active",
      closed: true,
      selectionRule: "Use the narrowest matching family.",
      fallbackFamilyId: "grammar.other",
      areas: [
        {
          id: "verb_forms",
          label: "Verb forms",
          families: [{ id: "verb_forms.modals", label: "Modals" }],
        },
      ],
      specialFamilies: [{ id: "grammar.other", label: "Other" }],
    };

    expect(
      buildCompetencyCatalogImportPlan({
        catalog,
        conceptRegistry: syntheticConceptRegistry,
        taxonomyArtifacts: [grammarTaxonomy],
      }).competencies[0]?.taxonomyId,
    ).toBe("verb_forms.modals");
  });

  it("validates a concept registry dry run without opening a transaction", async () => {
    const prisma = {
      $transaction: async () => {
        throw new Error("dry run must not open a transaction");
      },
    };

    await expect(
      importConceptRegistry(prisma, {
        registry: syntheticConceptRegistry,
        dryRun: true,
      }),
    ).resolves.toEqual({
      dryRun: true,
      registry: {
        id: "synthetic-concept-registry",
        targetLanguage: "en",
        version: "1.0.0",
      },
      imported: {
        concepts: 2,
      },
      totals: null,
    });
  });

  it("imports a concept registry idempotently", async () => {
    const concepts = new Map<string, Record<string, unknown>>();
    const transaction = {
      concept: {
        upsert: async (rawInput: unknown) => {
          const input = rawInput as {
            where: {
              targetLanguage_key: { targetLanguage: string; key: string };
            };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          };
          const identity = `${input.where.targetLanguage_key.targetLanguage}:${input.where.targetLanguage_key.key}`;
          concepts.set(identity, {
            ...(concepts.get(identity) ?? input.create),
            ...input.update,
          });
          return concepts.get(identity);
        },
        update: async () => ({}),
        count: async () => concepts.size,
      },
    };
    const prisma = {
      $transaction: async <T>(
        callback: (client: typeof transaction) => Promise<T>,
      ) => callback(transaction),
    };

    await importConceptRegistry(prisma as never, {
      registry: syntheticConceptRegistry,
    });
    const second = await importConceptRegistry(prisma as never, {
      registry: syntheticConceptRegistry,
    });

    expect(concepts).toHaveLength(2);
    expect(second).toEqual({
      dryRun: false,
      registry: {
        id: "synthetic-concept-registry",
        targetLanguage: "en",
        version: "1.0.0",
      },
      imported: {
        concepts: 2,
      },
      totals: {
        concepts: 2,
      },
    });
  });

  it("validates a competency catalog dry run without opening a transaction", async () => {
    const prisma = {
      $transaction: async () => {
        throw new Error("dry run must not open a transaction");
      },
    };

    await expect(
      importCompetencyCatalog(prisma, {
        catalog: syntheticCatalog(),
        conceptRegistry: syntheticConceptRegistry,
        taxonomyArtifacts: [syntheticTaxonomy],
        dryRun: true,
      }),
    ).resolves.toEqual({
      dryRun: true,
      catalog: {
        id: uuidv5("competency-catalog:en:1.0.0", uuidv5.URL),
        targetLanguage: "en",
        version: "1.0.0",
        status: "published",
      },
      imported: {
        competencies: 1,
        relationships: {
          component: 1,
          assumed: 1,
          supporting: 0,
        },
      },
      totals: null,
    });
  });

  it("imports a competency catalog and its relationships idempotently", async () => {
    const conceptPlan = buildConceptRegistryImportPlan(
      syntheticConceptRegistry,
    );
    const concepts = new Map(
      conceptPlan.concepts.map((concept) => [concept.key, concept]),
    );
    const catalogs = new Map<string, Record<string, unknown>>();
    const competencies = new Map<string, Record<string, unknown>>();
    const relationships = new Map<string, Record<string, unknown>>();
    const transaction = {
      competencyCatalog: {
        findUnique: async (rawInput: unknown) => {
          const input = rawInput as {
            where: {
              targetLanguage_version: {
                targetLanguage: string;
                version: string;
              };
            };
          };
          const identity = `${input.where.targetLanguage_version.targetLanguage}:${input.where.targetLanguage_version.version}`;
          return catalogs.get(identity) ?? null;
        },
        upsert: async (rawInput: unknown) => {
          const input = rawInput as {
            where: {
              targetLanguage_version: {
                targetLanguage: string;
                version: string;
              };
            };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          };
          const identity = `${input.where.targetLanguage_version.targetLanguage}:${input.where.targetLanguage_version.version}`;
          const row = {
            ...(catalogs.get(identity) ?? input.create),
            ...input.update,
          };
          catalogs.set(identity, row);
          return row;
        },
      },
      concept: {
        upsert: async () => ({}),
        update: async () => ({}),
        count: async () => concepts.size,
        findMany: async () =>
          [...concepts.values()].map(({ id, key }) => ({ id, key })),
      },
      competency: {
        upsert: async (rawInput: unknown) => {
          const input = rawInput as {
            where: { catalogId_key: { catalogId: string; key: string } };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          };
          const identity = `${input.where.catalogId_key.catalogId}:${input.where.catalogId_key.key}`;
          const row = {
            ...(competencies.get(identity) ?? input.create),
            ...input.update,
          };
          competencies.set(identity, row);
          return row;
        },
        count: async () => competencies.size,
      },
      competencyConcept: {
        deleteMany: async (rawInput: unknown) => {
          const input = rawInput as {
            where: { competencyId: { in: string[] } };
          };
          for (const [identity, row] of relationships) {
            if (
              input.where.competencyId.in.includes(String(row.competencyId))
            ) {
              relationships.delete(identity);
            }
          }
          return {};
        },
        createMany: async (rawInput: unknown) => {
          const input = rawInput as { data: Array<Record<string, unknown>> };
          for (const row of input.data) {
            relationships.set(`${row.competencyId}:${row.conceptId}`, row);
          }
          return {};
        },
        count: async () => relationships.size,
      },
    };
    const prisma = {
      $transaction: async <T>(
        callback: (client: typeof transaction) => Promise<T>,
      ) => callback(transaction),
    };
    const input = {
      catalog: syntheticCatalog(),
      conceptRegistry: syntheticConceptRegistry,
      taxonomyArtifacts: [syntheticTaxonomy],
      now: () => new Date("2026-07-20T04:00:00.000Z"),
    };

    await importCompetencyCatalog(prisma, input);
    const second = await importCompetencyCatalog(prisma, input);

    expect(catalogs).toHaveLength(1);
    expect(competencies).toHaveLength(1);
    expect(relationships).toHaveLength(2);
    expect(second.totals).toEqual({
      competencies: 1,
      relationships: 2,
    });
  });
});
