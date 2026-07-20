#!/usr/bin/env tsx

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

import { importCompetencyCatalog } from "../src/authorial-catalog-import.js";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const dryRun = args.includes("--dry-run");
const unsupportedArgs = args.filter((arg) => arg !== "--dry-run");
if (unsupportedArgs.length > 0) {
  throw new Error(`Unknown arguments: ${unsupportedArgs.join(", ")}`);
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, "../../..");
const authorialRoot = resolve(repoRoot, "data/catalogs/en/authoral");
const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(resolve(authorialRoot, path), "utf8"));
const [catalog, conceptRegistry, ...taxonomyArtifacts] = await Promise.all([
  readJson("catalogs/competency-catalog-a1-a2-v1.json"),
  readJson("registries/concept-registry-v1.json"),
  readJson("taxonomies/grammar-taxonomy-v1.json"),
  readJson("taxonomies/function-taxonomy-v1.json"),
  readJson("taxonomies/discourse-taxonomy-v1.json"),
  readJson("taxonomies/vocabulary-taxonomy-v1.json"),
]);
const prisma = new PrismaClient();

try {
  const summary = await importCompetencyCatalog(prisma as never, {
    catalog,
    conceptRegistry,
    taxonomyArtifacts,
    dryRun,
    transactionTimeoutMs: 120000,
  });
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await prisma.$disconnect();
}
