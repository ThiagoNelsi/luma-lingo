import { describe, expect, it } from "vitest";

import {
  buildPedagogicalPolicyImportPlan,
  importPedagogicalPolicy,
} from "./pedagogical-policy-import.js";

const catalog = {
  id: "catalog-1",
  targetLanguage: "en",
  version: "1.0.0",
  competencies: [{ id: "competency-1", key: "en.greet.a1" }],
};
const concepts = [{ id: "concept-1", key: "function.greeting" }];

function syntheticPolicy() {
  return {
    id: "synthetic-policy",
    language: "en",
    version: "1.0.0",
    catalogVersion: "1.0.0",
    competencyWeights: [
      { competencyId: "en.greet.a1", basePriority: 80, foundationWeight: 90 },
    ],
    competencyGoalWeights: [
      { competencyId: "en.greet.a1", goal: "travel", weight: 70 },
    ],
    conceptGoalWeights: [
      { conceptId: "function.greeting", goal: "travel", weight: 60 },
    ],
  };
}

describe("pedagogical policy import", () => {
  it("creates a deterministic normalized plan from private policy input", () => {
    const first = buildPedagogicalPolicyImportPlan({
      policy: syntheticPolicy(),
      catalog,
      concepts,
    });
    const second = buildPedagogicalPolicyImportPlan({
      policy: syntheticPolicy(),
      catalog,
      concepts,
    });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      competencyWeights: [
        {
          competencyId: "competency-1",
          basePriority: 80,
          foundationWeight: 90,
        },
      ],
      competencyGoalWeights: [
        { competencyId: "competency-1", goal: "travel", weight: 70 },
      ],
      conceptGoalWeights: [
        { conceptId: "concept-1", goal: "travel", weight: 60 },
      ],
    });
  });

  it("rejects references not present in the published catalog or concept registry", () => {
    const unknownCompetency = syntheticPolicy();
    unknownCompetency.competencyWeights[0]!.competencyId = "en.unknown.a1";
    expect(() =>
      buildPedagogicalPolicyImportPlan({
        policy: unknownCompetency,
        catalog,
        concepts,
      }),
    ).toThrow("pedagogical_policy_unknown_competency_reference");

    const unknownConcept = syntheticPolicy();
    unknownConcept.conceptGoalWeights[0]!.conceptId = "function.unknown";
    expect(() =>
      buildPedagogicalPolicyImportPlan({
        policy: unknownConcept,
        catalog,
        concepts,
      }),
    ).toThrow("pedagogical_policy_unknown_concept_reference");
  });

  it("supports dry runs without writes and repeated imports without duplicate rows", async () => {
    const rows = {
      competencyWeights: [] as unknown[],
      competencyGoalWeights: [] as unknown[],
      conceptGoalWeights: [] as unknown[],
    };
    const transaction = {
      competencyCatalog: { findUnique: async () => catalog },
      concept: { findMany: async () => concepts },
      pedagogicalPolicy: { upsert: async () => ({}) },
      pedagogicalCompetencyWeight: {
        deleteMany: async () => {
          rows.competencyWeights = [];
        },
        createMany: async (input: { data: unknown[] }) => {
          rows.competencyWeights.push(...input.data);
        },
        count: async () => rows.competencyWeights.length,
      },
      pedagogicalCompetencyGoalWeight: {
        deleteMany: async () => {
          rows.competencyGoalWeights = [];
        },
        createMany: async (input: { data: unknown[] }) => {
          rows.competencyGoalWeights.push(...input.data);
        },
        count: async () => rows.competencyGoalWeights.length,
      },
      pedagogicalConceptGoalWeight: {
        deleteMany: async () => {
          rows.conceptGoalWeights = [];
        },
        createMany: async (input: { data: unknown[] }) => {
          rows.conceptGoalWeights.push(...input.data);
        },
        count: async () => rows.conceptGoalWeights.length,
      },
    };
    const prisma = {
      $transaction: async <T>(
        callback: (tx: typeof transaction) => Promise<T>,
      ) => callback(transaction),
    };

    const dryRun = await importPedagogicalPolicy(prisma, {
      policy: syntheticPolicy(),
      dryRun: true,
    });
    expect(dryRun.totals).toBeNull();
    expect(rows.competencyWeights).toEqual([]);

    await importPedagogicalPolicy(prisma, { policy: syntheticPolicy() });
    const repeated = await importPedagogicalPolicy(prisma, {
      policy: syntheticPolicy(),
    });
    expect(repeated.totals).toEqual({
      competencyWeights: 1,
      competencyGoalWeights: 1,
      conceptGoalWeights: 1,
    });
  });
});
