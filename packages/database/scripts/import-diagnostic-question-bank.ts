#!/usr/bin/env tsx

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

import {
  importDiagnosticQuestionBank,
  readDiagnosticQuestionBankFile,
} from "../src/diagnostic-question-bank-import.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
export const defaultDiagnosticQuestionBankPath = resolve(
  repoRoot,
  "data/catalogs/en/authoral/onboarding-diagnostic-question-bank-a1-mvp.json",
);

export function parseDiagnosticQuestionBankImportArgs(argv: string[]) {
  const options = {
    questionBankPath: defaultDiagnosticQuestionBankPath,
    transactionTimeoutMs: 60000,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--help") {
      printUsage();
      process.exit(0);
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`${arg} requires a value`);
    }

    if (arg === "--question-bank") {
      options.questionBankPath = resolve(process.cwd(), next);
    } else if (arg === "--transaction-timeout-ms") {
      const timeout = Number(next);
      if (!Number.isInteger(timeout) || timeout <= 0) {
        throw new Error("--transaction-timeout-ms must be a positive integer");
      }
      options.transactionTimeoutMs = timeout;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }

    index += 1;
  }

  return options;
}

function printUsage() {
  console.log(`Usage:
  pnpm --filter @luma-lingo/database db:import:diagnostic-questions -- [options]

Options:
  --question-bank <path>   Authored diagnostic question-bank JSON path.
  --transaction-timeout-ms Prisma transaction timeout. Defaults to 60000.
  --dry-run                Validate, resolve catalog data, and summarize without writing.
`);
}

async function main() {
  const options = parseDiagnosticQuestionBankImportArgs(process.argv.slice(2));
  const { questionBank } = await readDiagnosticQuestionBankFile(
    options.questionBankPath,
  );
  const prisma = new PrismaClient();

  try {
    const summary = await importDiagnosticQuestionBank(prisma, {
      questionBank,
      dryRun: options.dryRun,
      sourceFile: options.questionBankPath,
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
