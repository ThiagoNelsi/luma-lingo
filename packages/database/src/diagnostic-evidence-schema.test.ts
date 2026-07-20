import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  packageRoot,
  "prisma/migrations/20260720100000_record_concept_evidence_q_matrix/migration.sql",
);

describe("diagnostic evidence database schema", () => {
  it("stores one primary target, capability-specific concept state, and append-only evidence", () => {
    const prismaSchema = readFileSync(
      resolve(packageRoot, "prisma/schema.prisma"),
      "utf8",
    );
    const migration = readFileSync(migrationPath, "utf8");

    expect(prismaSchema).toContain(
      "model DiagnosticItemConceptEvidenceMapping",
    );
    expect(prismaSchema).toContain("model LearnerConceptState");
    expect(prismaSchema).toContain("model ConceptEvidence");
    expect(migration).toContain(
      'CONSTRAINT "diagnostic_items_exactly_one_primary_target_check"',
    );
    expect(migration).toContain(
      'PRIMARY KEY ("diagnostic_item_id", "concept_id", "capability")',
    );
    expect(migration).toContain(
      '"direct_evidence_count" INTEGER NOT NULL DEFAULT 0',
    );
    expect(migration).toContain(
      '"inferred_evidence_count" INTEGER NOT NULL DEFAULT 0',
    );
    expect(migration).toContain("\"evidence_kind\" IN ('direct', 'inferred')");
    expect(migration).toContain(
      'CREATE TRIGGER "concept_evidence_append_only"',
    );
  });
});
