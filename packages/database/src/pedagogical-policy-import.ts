import { createHash } from "node:crypto";

import { pedagogicalPolicySchema } from "@luma-lingo/shared";
import { v5 as uuidv5 } from "uuid";

export type PedagogicalPolicyImportCatalog = {
  id: string;
  targetLanguage: string;
  version: string;
  competencies: Array<{ id: string; key: string }>;
};

export type PedagogicalPolicyImportConcept = {
  id: string;
  key: string;
};

export type PedagogicalPolicyImportPlan = {
  policy: {
    id: string;
    catalogId: string;
    sourcePolicyId: string;
    version: string;
    sourceChecksum: string;
    metadata: Record<string, unknown>;
  };
  competencyWeights: Array<{
    policyId: string;
    competencyId: string;
    basePriority: number | null;
    foundationWeight: number | null;
  }>;
  competencyGoalWeights: Array<{
    policyId: string;
    competencyId: string;
    goal: string;
    weight: number;
  }>;
  conceptGoalWeights: Array<{
    policyId: string;
    conceptId: string;
    goal: string;
    weight: number;
  }>;
  ranking: Record<string, unknown>;
  summary: {
    competencyWeights: number;
    competencyGoalWeights: number;
    conceptGoalWeights: number;
  };
};

export interface PedagogicalPolicyImportTransaction {
  competencyCatalog: {
    findUnique(input: unknown): Promise<PedagogicalPolicyImportCatalog | null>;
  };
  concept: {
    findMany(input: unknown): Promise<PedagogicalPolicyImportConcept[]>;
  };
  pedagogicalPolicy: {
    upsert(input: unknown): Promise<unknown>;
  };
  pedagogicalCompetencyWeight: {
    deleteMany(input: unknown): Promise<unknown>;
    createMany(input: unknown): Promise<unknown>;
    count(input: unknown): Promise<number>;
  };
  pedagogicalCompetencyGoalWeight: {
    deleteMany(input: unknown): Promise<unknown>;
    createMany(input: unknown): Promise<unknown>;
    count(input: unknown): Promise<number>;
  };
  pedagogicalConceptGoalWeight: {
    deleteMany(input: unknown): Promise<unknown>;
    createMany(input: unknown): Promise<unknown>;
    count(input: unknown): Promise<number>;
  };
}

export interface PedagogicalPolicyPrismaClient {
  $transaction<T>(
    callback: (transaction: PedagogicalPolicyImportTransaction) => Promise<T>,
    options?: { timeout?: number },
  ): Promise<T>;
}

export type PedagogicalPolicyImportSummary = {
  dryRun: boolean;
  policy: {
    version: string;
    targetLanguage: string;
    catalogVersion: string;
  };
  imported: PedagogicalPolicyImportPlan["summary"];
  totals: PedagogicalPolicyImportPlan["summary"] | null;
};

export function buildPedagogicalPolicyImportPlan(input: {
  policy: unknown;
  catalog: PedagogicalPolicyImportCatalog;
  concepts: PedagogicalPolicyImportConcept[];
}): PedagogicalPolicyImportPlan {
  const policy = pedagogicalPolicySchema.parse(input.policy);
  if (
    policy.language !== input.catalog.targetLanguage ||
    policy.catalogVersion !== input.catalog.version
  ) {
    throw new Error("pedagogical_policy_catalog_mismatch");
  }

  const competencyIdByKey = new Map(
    input.catalog.competencies.map((competency) => [
      competency.key,
      competency.id,
    ]),
  );
  const conceptIdByKey = new Map(
    input.concepts.map((concept) => [concept.key, concept.id]),
  );
  const referencedCompetencyKeys = [
    ...policy.competencyWeights.map((weight) => weight.competencyId),
    ...policy.competencyGoalWeights.map((weight) => weight.competencyId),
  ];
  if (referencedCompetencyKeys.some((key) => !competencyIdByKey.has(key))) {
    throw new Error("pedagogical_policy_unknown_competency_reference");
  }
  if (
    policy.conceptGoalWeights.some(
      (weight) => !conceptIdByKey.has(weight.conceptId),
    )
  ) {
    throw new Error("pedagogical_policy_unknown_concept_reference");
  }

  const policyId = uuidv5(
    `pedagogical-policy:${input.catalog.id}:${policy.version}`,
    uuidv5.URL,
  );
  const competencyWeights = policy.competencyWeights.map((weight) => ({
    policyId,
    competencyId: requiredId(competencyIdByKey, weight.competencyId),
    basePriority: weight.basePriority ?? null,
    foundationWeight: weight.foundationWeight ?? null,
  }));
  const competencyGoalWeights = policy.competencyGoalWeights.map((weight) => ({
    policyId,
    competencyId: requiredId(competencyIdByKey, weight.competencyId),
    goal: weight.goal,
    weight: weight.weight,
  }));
  const conceptGoalWeights = policy.conceptGoalWeights.map((weight) => ({
    policyId,
    conceptId: requiredId(conceptIdByKey, weight.conceptId),
    goal: weight.goal,
    weight: weight.weight,
  }));

  return {
    policy: {
      id: policyId,
      catalogId: input.catalog.id,
      sourcePolicyId: policy.id,
      version: policy.version,
      sourceChecksum: createHash("sha256")
        .update(JSON.stringify(policy))
        .digest("hex"),
      metadata: { schemaVersion: 1 },
    },
    competencyWeights,
    competencyGoalWeights,
    conceptGoalWeights,
    ranking: policy.ranking ?? {},
    summary: {
      competencyWeights: competencyWeights.length,
      competencyGoalWeights: competencyGoalWeights.length,
      conceptGoalWeights: conceptGoalWeights.length,
    },
  };
}

export async function importPedagogicalPolicy(
  prisma: PedagogicalPolicyPrismaClient,
  input: {
    policy: unknown;
    dryRun?: boolean;
    transactionTimeoutMs?: number;
  },
): Promise<PedagogicalPolicyImportSummary> {
  return prisma.$transaction(
    async (transaction) => writePedagogicalPolicy(transaction, input),
    { timeout: input.transactionTimeoutMs },
  );
}

async function writePedagogicalPolicy(
  transaction: PedagogicalPolicyImportTransaction,
  input: { policy: unknown; dryRun?: boolean },
): Promise<PedagogicalPolicyImportSummary> {
  const parsedPolicy = pedagogicalPolicySchema.parse(input.policy);
  const catalog = await transaction.competencyCatalog.findUnique({
    where: {
      targetLanguage_version: {
        targetLanguage: parsedPolicy.language,
        version: parsedPolicy.catalogVersion,
      },
    },
    include: { competencies: { select: { id: true, key: true } } },
  });
  if (!catalog) throw new Error("pedagogical_policy_catalog_not_found");
  const concepts = await transaction.concept.findMany({
    where: { targetLanguage: parsedPolicy.language },
    select: { id: true, key: true },
  });
  const plan = buildPedagogicalPolicyImportPlan({
    policy: parsedPolicy,
    catalog,
    concepts,
  });

  if (!input.dryRun) {
    await transaction.pedagogicalPolicy.upsert({
      where: {
        catalogId_version: {
          catalogId: plan.policy.catalogId,
          version: plan.policy.version,
        },
      },
      create: {
        ...plan.policy,
        metadata: { ...plan.policy.metadata, ranking: plan.ranking },
      },
      update: {
        sourcePolicyId: plan.policy.sourcePolicyId,
        sourceChecksum: plan.policy.sourceChecksum,
        metadata: { ...plan.policy.metadata, ranking: plan.ranking },
      },
    });
    await transaction.pedagogicalCompetencyWeight.deleteMany({
      where: { policyId: plan.policy.id },
    });
    await transaction.pedagogicalCompetencyGoalWeight.deleteMany({
      where: { policyId: plan.policy.id },
    });
    await transaction.pedagogicalConceptGoalWeight.deleteMany({
      where: { policyId: plan.policy.id },
    });
    if (plan.competencyWeights.length > 0) {
      await transaction.pedagogicalCompetencyWeight.createMany({
        data: plan.competencyWeights,
      });
    }
    if (plan.competencyGoalWeights.length > 0) {
      await transaction.pedagogicalCompetencyGoalWeight.createMany({
        data: plan.competencyGoalWeights,
      });
    }
    if (plan.conceptGoalWeights.length > 0) {
      await transaction.pedagogicalConceptGoalWeight.createMany({
        data: plan.conceptGoalWeights,
      });
    }
  }

  return {
    dryRun: input.dryRun ?? false,
    policy: {
      version: parsedPolicy.version,
      targetLanguage: parsedPolicy.language,
      catalogVersion: parsedPolicy.catalogVersion,
    },
    imported: plan.summary,
    totals: input.dryRun
      ? null
      : {
          competencyWeights:
            await transaction.pedagogicalCompetencyWeight.count({
              where: { policyId: plan.policy.id },
            }),
          competencyGoalWeights:
            await transaction.pedagogicalCompetencyGoalWeight.count({
              where: { policyId: plan.policy.id },
            }),
          conceptGoalWeights:
            await transaction.pedagogicalConceptGoalWeight.count({
              where: { policyId: plan.policy.id },
            }),
        },
  };
}

function requiredId(ids: Map<string, string>, key: string): string {
  const id = ids.get(key);
  if (!id) throw new Error("pedagogical_policy_reference_not_found");
  return id;
}
