import { describe, expect, it } from "vitest";

import {
  competencyCatalogSchema,
  controlledEntrySchema,
  migrationManifestSchema,
  validateCompetencyCatalogArtifacts,
  validateMigrationManifestCoverage,
} from "./competency-catalog.js";

const validCompetency = {
  id: "en.check-understanding.b1",
  status: "active",
  type: "function",
  level: "b1",
  taxonomyId: "information_exchange.check_understanding",
  title: "Checking understanding",
  descriptor: "Can check understanding in routine conversation.",
  searchTerms: ["checking understanding"],
  examples: [],
  sourceReferences: [
    {
      source: "eaquals",
      sourceVersion: "2015",
      recordId: "legacy:functions:checking-understanding:b1",
      codes: ["41"],
    },
  ],
  componentConceptIds: ["function.check_understanding.confirm"],
  assumedConcepts: [],
  supportingConceptIds: [],
};

describe("competency catalog contracts", () => {
  it("accepts a level-specific competency with explicit provenance", () => {
    expect(
      competencyCatalogSchema.safeParse({
        id: "en-catalog",
        language: "en",
        version: "1.0.0",
        publicationStatus: "draft",
        competencies: [validCompetency],
      }).success,
    ).toBe(true);
  });

  it("rejects an ID whose language or level disagrees with the competency", () => {
    expect(
      competencyCatalogSchema.safeParse({
        id: "en-catalog",
        language: "en",
        version: "1.0.0",
        publicationStatus: "draft",
        competencies: [{ ...validCompetency, id: "pt.check-understanding.b2" }],
      }).success,
    ).toBe(false);
  });

  it("rejects a published catalog that references a missing taxonomy leaf", () => {
    const issues = validateCompetencyCatalogArtifacts({
      catalog: {
        id: "en-catalog",
        language: "en",
        version: "1.0.0",
        publicationStatus: "published",
        competencies: [validCompetency],
      },
      taxonomyEntryIds: [],
      conceptEntryIds: ["function.check_understanding.confirm"],
    });

    expect(issues).toContainEqual({
      code: "missing_taxonomy_entry",
      entityId: "en.check-understanding.b1",
      referenceId: "information_exchange.check_understanding",
    });
  });

  it("rejects inactive references in a new published catalog", () => {
    const issues = validateCompetencyCatalogArtifacts({
      catalog: {
        id: "en-catalog",
        language: "en",
        version: "1.0.0",
        publicationStatus: "published",
        competencies: [validCompetency],
      },
      taxonomyEntryIds: ["information_exchange.check_understanding"],
      conceptEntryIds: ["function.check_understanding.confirm"],
      inactiveEntryIds: ["function.check_understanding.confirm"],
    });

    expect(issues).toContainEqual({
      code: "published_reference_must_be_active",
      entityId: "en.check-understanding.b1",
      referenceId: "function.check_understanding.confirm",
    });
  });

  it("reports duplicate and missing source records in a migration manifest", () => {
    const issues = validateMigrationManifestCoverage(
      ["legacy:functions:greetings:a1", "legacy:functions:requests:a2"],
      {
        language: "en",
        source: "legacy-authoral-catalog",
        entries: [
          {
            sourceRecordId: "legacy:functions:greetings:a1",
            disposition: "mapped",
            competencyIds: ["en.greetings.a1"],
          },
          {
            sourceRecordId: "legacy:functions:greetings:a1",
            disposition: "merged",
            competencyIds: ["en.greetings.a1"],
          },
        ],
      },
    );

    expect(issues.map(({ code }) => code).sort()).toEqual([
      "duplicate_source_record",
      "missing_source_record",
    ]);
  });

  it("requires replacement metadata only for replaced entries", () => {
    expect(
      controlledEntrySchema.safeParse({
        id: "function.request",
        label: "Request",
        aliases: [],
        status: "replaced",
      }).success,
    ).toBe(false);
  });

  it("enforces migration disposition cardinality", () => {
    expect(
      migrationManifestSchema.safeParse({
        language: "en",
        source: "legacy-authoral-catalog",
        entries: [
          {
            sourceRecordId: "legacy:functions:greetings:a1",
            disposition: "excluded",
            competencyIds: ["en.greetings.a1"],
            rationale: "Not canonical.",
          },
        ],
      }).success,
    ).toBe(false);
  });
});
