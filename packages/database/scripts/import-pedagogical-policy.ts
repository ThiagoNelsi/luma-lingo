#!/usr/bin/env tsx

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

import { importPedagogicalPolicy } from "../src/pedagogical-policy-import.js";

export function parsePedagogicalPolicyImportArgs(argv: string[]) {
  const options: {
    policyPath: string | null;
    transactionTimeoutMs: 60000;
    dryRun: false;
  } = { policyPath: null, transactionTimeoutMs: 60000, dryRun: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value`);
    }
    if (argument === "--policy")
      options.policyPath = resolve(process.cwd(), value);
    else if (argument === "--transaction-timeout-ms") {
      const timeout = Number(value);
      if (!Number.isInteger(timeout) || timeout <= 0) {
        throw new Error("--transaction-timeout-ms must be a positive integer");
      }
      options.transactionTimeoutMs = timeout;
    } else throw new Error(`Unknown argument: ${argument}`);
    index += 1;
  }
  if (!options.policyPath) throw new Error("--policy is required");
  return { ...options, policyPath: options.policyPath };
}

async function main() {
  const options = parsePedagogicalPolicyImportArgs(process.argv.slice(2));
  const policy: unknown = JSON.parse(
    await readFile(options.policyPath, "utf8"),
  );
  const prisma = new PrismaClient();
  try {
    const summary = await importPedagogicalPolicy(prisma as never, {
      policy,
      dryRun: options.dryRun,
      transactionTimeoutMs: options.transactionTimeoutMs,
    });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
