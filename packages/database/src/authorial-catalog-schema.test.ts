import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  packageRoot,
  "prisma/migrations/20260720044000_replace_legacy_catalog_with_concepts/migration.sql",
);

describe("authorial catalog database schema", () => {
  it("requires a capability exactly for assumed competency-concept relationships", () => {
    const prismaSchema = readFileSync(
      resolve(packageRoot, "prisma/schema.prisma"),
      "utf8",
    );
    const migration = readFileSync(migrationPath, "utf8");

    expect(prismaSchema).toContain("model CompetencyConcept");
    expect(migration).toContain('CONSTRAINT "competency_concepts_role_check"');
    expect(migration).toContain(
      'CONSTRAINT "competency_concepts_assumed_capability_check"',
    );
    expect(migration).toContain(
      `("role" = 'assumed' AND "required_capability" IS NOT NULL)`,
    );
    expect(migration).toContain(
      `("role" IN ('component', 'supporting') AND "required_capability" IS NULL)`,
    );
  });
});
