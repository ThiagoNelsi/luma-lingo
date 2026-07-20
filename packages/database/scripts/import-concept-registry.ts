#!/usr/bin/env tsx

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

import { importConceptRegistry } from "../src/authorial-catalog-import.js";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const dryRun = args.includes("--dry-run");
const unsupportedArgs = args.filter((arg) => arg !== "--dry-run");
if (unsupportedArgs.length > 0) {
  throw new Error(`Unknown arguments: ${unsupportedArgs.join(", ")}`);
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "../../..");
const registryPath = resolve(
  repoRoot,
  "data/catalogs/en/authoral/registries/concept-registry-v1.json",
);
const registry: unknown = JSON.parse(await readFile(registryPath, "utf8"));
const prisma = new PrismaClient();

try {
  const summary = await importConceptRegistry(prisma as never, {
    registry,
    dryRun,
    transactionTimeoutMs: 120000,
  });
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await prisma.$disconnect();
}
