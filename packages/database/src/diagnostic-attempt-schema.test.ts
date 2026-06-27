import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const packageRoot = resolve(import.meta.dirname, "..");

describe("diagnostic attempt database schema", () => {
  it("keeps attempt item order and diagnostic item uniqueness enforceable in the database", () => {
    const prismaSchema = readFileSync(
      resolve(packageRoot, "prisma/schema.prisma"),
      "utf8",
    );
    const migration = readFileSync(
      resolve(
        packageRoot,
        "prisma/migrations/20260627223000_add_diagnostic_attempts/migration.sql",
      ),
      "utf8",
    );

    expect(prismaSchema).toContain("@@unique([attemptId, position])");
    expect(prismaSchema).toContain("@@unique([attemptId, diagnosticItemId])");
    expect(migration).toContain(
      'UNIQUE INDEX "diagnostic_attempt_items_attempt_id_position_key"',
    );
    expect(migration).toContain(
      'UNIQUE INDEX "diagnostic_attempt_items_attempt_id_diagnostic_item_id_key"',
    );
    expect(migration).toContain(
      'CONSTRAINT "diagnostic_attempt_items_score_check"',
    );
    expect(migration).toContain(
      'CONSTRAINT "diagnostic_attempt_items_confidence_check"',
    );
  });
});
