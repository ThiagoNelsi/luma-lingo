import { z } from "zod";

export const competencyTypeValues = [
  "grammar",
  "function",
  "vocabulary",
  "discourse",
] as const;
export const cefrLevelValues = [
  "pre_a1",
  "a1",
  "a2",
  "b1",
  "b2",
  "c1",
  "c2",
] as const;
export const capabilityValues = [
  "recognition",
  "controlled_production",
  "contextualized_use",
  "independent_use",
] as const;
export const lifecycleStatusValues = [
  "draft",
  "active",
  "deprecated",
  "replaced",
] as const;
export const publicationStatusValues = [
  "draft",
  "reviewed",
  "published",
] as const;

const semanticVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const languageSchema = z.string().regex(/^[a-z]{2,3}$/);
const conceptIdSchema = z
  .string()
  .regex(/^(form|meaning|function|discourse|vocabulary)(\.[a-z][a-z0-9_]*)+$/);
const taxonomyIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);

export const sourceReferenceSchema = z.object({
  source: z.string().trim().min(1),
  sourceVersion: z.string().trim().min(1),
  recordId: z.string().trim().min(1),
  codes: z.array(z.string().trim().min(1)).default([]),
});

export const assumedConceptSchema = z.object({
  conceptId: conceptIdSchema,
  requiredCapability: z.enum(capabilityValues),
});

export const competencySchema = z
  .object({
    id: z.string().trim().min(1),
    status: z.enum(lifecycleStatusValues),
    type: z.enum(competencyTypeValues),
    level: z.enum(cefrLevelValues),
    taxonomyId: taxonomyIdSchema,
    title: z.string().trim().min(1),
    descriptor: z.string().trim().min(1),
    estimatedGseScore: z.number().min(10).max(90).optional(),
    searchTerms: z.array(z.string().trim().min(1)),
    examples: z.array(z.string().trim().min(1)),
    sourceReferences: z.array(sourceReferenceSchema).min(1),
    componentConceptIds: z.array(conceptIdSchema),
    assumedConcepts: z.array(assumedConceptSchema),
    supportingConceptIds: z.array(conceptIdSchema),
  })
  .superRefine((competency, context) => {
    const parts = competency.id.split(".");
    if (parts.length < 3 || parts.at(-1) !== competency.level) {
      context.addIssue({
        code: "custom",
        message: "competency_id_level_mismatch",
        path: ["id"],
      });
    }
  });

export const competencyCatalogSchema = z
  .object({
    id: z.string().trim().min(1),
    language: languageSchema,
    version: semanticVersionSchema,
    publicationStatus: z.enum(publicationStatusValues),
    competencies: z.array(competencySchema),
  })
  .superRefine((catalog, context) => {
    for (const [index, competency] of catalog.competencies.entries()) {
      if (!competency.id.startsWith(`${catalog.language}.`)) {
        context.addIssue({
          code: "custom",
          message: "competency_id_language_mismatch",
          path: ["competencies", index, "id"],
        });
      }
    }
  });

export const controlledEntrySchema = z
  .object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    aliases: z.array(z.string().trim().min(1)).default([]),
    status: z.enum(lifecycleStatusValues),
    replacedBy: z.string().trim().min(1).optional(),
  })
  .superRefine((entry, context) => {
    if (entry.status === "replaced" && !entry.replacedBy) {
      context.addIssue({
        code: "custom",
        message: "replaced_entry_requires_replaced_by",
        path: ["replacedBy"],
      });
    }
  });

export const versionedControlledArtifactSchema = z.object({
  id: z.string().trim().min(1),
  language: languageSchema,
  version: semanticVersionSchema,
  entries: z.array(controlledEntrySchema),
});

export const conceptRegistrySchema = versionedControlledArtifactSchema.extend({
  entries: z.array(controlledEntrySchema.safeExtend({ id: conceptIdSchema })),
});

export const competencyIdRegistrySchema = z.object({
  language: languageSchema,
  entries: z.array(
    z.object({
      id: z.string().trim().min(1),
      status: z.enum(lifecycleStatusValues),
      firstIntroducedIn: semanticVersionSchema,
      replacedBy: z.string().trim().min(1).optional(),
    }),
  ),
});

export const migrationDispositionValues = [
  "mapped",
  "merged",
  "decomposed",
  "excluded",
  "pending_review",
] as const;
export const migrationManifestSchema = z.object({
  language: languageSchema,
  source: z.string().trim().min(1),
  entries: z.array(
    z
      .object({
        sourceRecordId: z.string().trim().min(1),
        disposition: z.enum(migrationDispositionValues),
        competencyIds: z.array(z.string().trim().min(1)),
        rationale: z.string().trim().min(1).optional(),
      })
      .superRefine((entry, context) => {
        const hasTargets = entry.competencyIds.length > 0;
        const mustHaveTargets = ["mapped", "merged", "decomposed"].includes(
          entry.disposition,
        );
        if (hasTargets !== mustHaveTargets) {
          context.addIssue({
            code: "custom",
            message: "migration_disposition_target_mismatch",
            path: ["competencyIds"],
          });
        }
      }),
  ),
});

export interface CatalogValidationIssue {
  code: string;
  entityId: string;
  referenceId: string;
}

export function validateCompetencyCatalogArtifacts(input: {
  catalog: unknown;
  taxonomyEntryIds: readonly string[];
  conceptEntryIds: readonly string[];
  inactiveEntryIds?: readonly string[];
}): CatalogValidationIssue[] {
  const catalog = competencyCatalogSchema.parse(input.catalog);
  const taxonomyIds = new Set(input.taxonomyEntryIds);
  const conceptIds = new Set(input.conceptEntryIds);
  const inactiveIds = new Set(input.inactiveEntryIds ?? []);
  const issues: CatalogValidationIssue[] = [];

  for (const competency of catalog.competencies) {
    if (!taxonomyIds.has(competency.taxonomyId)) {
      issues.push({
        code: "missing_taxonomy_entry",
        entityId: competency.id,
        referenceId: competency.taxonomyId,
      });
    }
    const referencedConceptIds = [
      ...competency.componentConceptIds,
      ...competency.assumedConcepts.map(({ conceptId }) => conceptId),
      ...competency.supportingConceptIds,
    ];
    for (const conceptId of referencedConceptIds) {
      if (!conceptIds.has(conceptId)) {
        issues.push({
          code: "missing_concept_entry",
          entityId: competency.id,
          referenceId: conceptId,
        });
      }
    }
    if (catalog.publicationStatus === "published") {
      for (const referenceId of [
        competency.taxonomyId,
        ...referencedConceptIds,
      ]) {
        if (inactiveIds.has(referenceId)) {
          issues.push({
            code: "published_reference_must_be_active",
            entityId: competency.id,
            referenceId,
          });
        }
      }
    }
  }

  return issues;
}

export function validateMigrationManifestCoverage(
  sourceRecordIds: readonly string[],
  input: unknown,
): CatalogValidationIssue[] {
  const manifest = migrationManifestSchema.parse(input);
  const expected = new Set(sourceRecordIds);
  const counts = new Map<string, number>();
  const issues: CatalogValidationIssue[] = [];

  for (const entry of manifest.entries) {
    counts.set(
      entry.sourceRecordId,
      (counts.get(entry.sourceRecordId) ?? 0) + 1,
    );
  }
  for (const sourceRecordId of expected) {
    if (!counts.has(sourceRecordId)) {
      issues.push({
        code: "missing_source_record",
        entityId: manifest.source,
        referenceId: sourceRecordId,
      });
    }
  }
  for (const [sourceRecordId, count] of counts) {
    if (count > 1) {
      issues.push({
        code: "duplicate_source_record",
        entityId: manifest.source,
        referenceId: sourceRecordId,
      });
    }
    if (!expected.has(sourceRecordId)) {
      issues.push({
        code: "unknown_source_record",
        entityId: manifest.source,
        referenceId: sourceRecordId,
      });
    }
  }

  return issues;
}

export type Competency = z.infer<typeof competencySchema>;
export type CompetencyCatalog = z.infer<typeof competencyCatalogSchema>;

export function generateCompetencyCatalogJsonSchemas(): Record<string, object> {
  const schemas = {
    "competency-catalog.schema.json": competencyCatalogSchema,
    "competency-id-registry.schema.json": competencyIdRegistrySchema,
    "concept-registry.schema.json": conceptRegistrySchema,
    "migration-manifest.schema.json": migrationManifestSchema,
    "controlled-artifact.schema.json": versionedControlledArtifactSchema,
  };

  return Object.fromEntries(
    Object.entries(schemas).map(([filename, schema]) => [
      filename,
      z.toJSONSchema(schema, { target: "draft-2020-12" }),
    ]),
  );
}
