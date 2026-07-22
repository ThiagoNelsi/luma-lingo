import { describe, expect, it } from "vitest";

import { parsePedagogicalPolicyImportArgs } from "./import-pedagogical-policy.js";

describe("parsePedagogicalPolicyImportArgs", () => {
  it("accepts a private policy path, dry run, and transaction timeout", () => {
    expect(
      parsePedagogicalPolicyImportArgs([
        "--policy",
        "private-policy.json",
        "--dry-run",
        "--transaction-timeout-ms",
        "120000",
      ]),
    ).toMatchObject({
      policyPath: expect.stringMatching(/private-policy\.json$/),
      dryRun: true,
      transactionTimeoutMs: 120000,
    });
  });

  it("rejects unknown and incomplete arguments", () => {
    expect(() => parsePedagogicalPolicyImportArgs([])).toThrow(
      "--policy is required",
    );
    expect(() =>
      parsePedagogicalPolicyImportArgs(["--unknown", "value"]),
    ).toThrow("Unknown argument: --unknown");
    expect(() =>
      parsePedagogicalPolicyImportArgs(["--transaction-timeout-ms", "0"]),
    ).toThrow("--transaction-timeout-ms must be a positive integer");
  });
});
