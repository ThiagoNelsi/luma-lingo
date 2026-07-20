#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const catalog = await prisma.competencyCatalog.findUnique({
    where: {
      targetLanguage_version: {
        targetLanguage: "en",
        version: "1.1.0",
      },
    },
    select: {
      id: true,
      status: true,
      sourceChecksum: true,
    },
  });
  if (!catalog || catalog.status !== "published" || !catalog.sourceChecksum) {
    throw new Error("The published English authorial catalog is missing");
  }

  const [
    conceptStatuses,
    competencyStatuses,
    relationshipRoles,
    componentlessCompetencies,
    invalidConceptReplacements,
    invalidRelationships,
    validatedConstraints,
    legacyTables,
    legacyColumns,
  ] = await Promise.all([
    prisma.concept.groupBy({
      by: ["status"],
      where: { targetLanguage: "en" },
      _count: true,
    }),
    prisma.competency.groupBy({
      by: ["status"],
      where: { catalogId: catalog.id },
      _count: true,
    }),
    prisma.competencyConcept.groupBy({
      by: ["role"],
      where: { competency: { catalogId: catalog.id } },
      _count: true,
    }),
    prisma.competency.count({
      where: {
        catalogId: catalog.id,
        conceptRelationships: { none: {} },
      },
    }),
    prisma.concept.count({
      where: {
        targetLanguage: "en",
        status: "replaced",
        replacedByConceptId: null,
      },
    }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS "count"
      FROM "competency_concepts"
      WHERE NOT (
        ("role" = 'assumed' AND "required_capability" IS NOT NULL)
        OR (
          "role" IN ('component', 'supporting')
          AND "required_capability" IS NULL
        )
      )
    `,
    prisma.$queryRaw<Array<{ constraintName: string }>>`
      SELECT conname AS "constraintName"
      FROM pg_constraint
      WHERE convalidated
        AND conname IN (
          'competencies_estimated_difficulty_score_check',
          'concepts_replacement_not_self_check',
          'competency_concepts_role_check',
          'competency_concepts_capability_check',
          'competency_concepts_assumed_capability_check'
        )
      ORDER BY conname
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS "count"
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'competency_prerequisites',
          'competency_goal_priorities'
        )
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS "count"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'competencies'
        AND column_name IN ('mode', 'is_core')
    `,
  ]);

  const conceptStatusCounts = Object.fromEntries(
    conceptStatuses.map(({ status, _count }) => [status, _count]),
  );
  const competencyStatusCounts = Object.fromEntries(
    competencyStatuses.map(({ status, _count }) => [status, _count]),
  );
  const relationshipRoleCounts = Object.fromEntries(
    relationshipRoles.map(({ role, _count }) => [role, _count]),
  );
  const conceptCount = Object.values(conceptStatusCounts).reduce(
    (total, count) => total + count,
    0,
  );
  const competencyCount = Object.values(competencyStatusCounts).reduce(
    (total, count) => total + count,
    0,
  );
  const relationshipCount = Object.values(relationshipRoleCounts).reduce(
    (total, count) => total + count,
    0,
  );
  const invalidRelationshipCount = Number(invalidRelationships[0]?.count ?? 0n);
  const legacyTableCount = Number(legacyTables[0]?.count ?? 0n);
  const legacyColumnCount = Number(legacyColumns[0]?.count ?? 0n);

  if (
    conceptCount !== 141 ||
    competencyCount !== 132 ||
    relationshipCount !== 261 ||
    relationshipRoleCounts.component !== 249 ||
    relationshipRoleCounts.assumed !== 12 ||
    (relationshipRoleCounts.supporting ?? 0) !== 0 ||
    componentlessCompetencies !== 2 ||
    invalidConceptReplacements !== 0 ||
    invalidRelationshipCount !== 0 ||
    validatedConstraints.length !== 5 ||
    legacyTableCount !== 0 ||
    legacyColumnCount !== 0
  ) {
    throw new Error("The authorial catalog database invariants do not match");
  }

  console.log(
    JSON.stringify(
      {
        catalog: {
          targetLanguage: "en",
          version: "1.1.0",
          status: catalog.status,
        },
        concepts: {
          total: conceptCount,
          statuses: conceptStatusCounts,
          invalidReplacements: invalidConceptReplacements,
        },
        competencies: {
          total: competencyCount,
          statuses: competencyStatusCounts,
          componentless: componentlessCompetencies,
        },
        relationships: {
          total: relationshipCount,
          roles: {
            component: relationshipRoleCounts.component ?? 0,
            assumed: relationshipRoleCounts.assumed ?? 0,
            supporting: relationshipRoleCounts.supporting ?? 0,
          },
          invalid: invalidRelationshipCount,
        },
        schema: {
          validatedConstraints: validatedConstraints.length,
          legacyTables: legacyTableCount,
          legacyColumns: legacyColumnCount,
        },
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
