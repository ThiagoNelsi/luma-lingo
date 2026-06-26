#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");

const defaultGrammarPath = resolve(
  repoRoot,
  "data/catalogs/en/grammar-competencies.json",
);
const defaultNonGrammarPath = resolve(
  repoRoot,
  "data/catalogs/en/non-grammar-competencies.json",
);

const languageNameToCode = new Map([
  ["english", "en"],
  ["inglês", "en"],
  ["spanish", "es"],
  ["espanhol", "es"],
  ["french", "fr"],
  ["francês", "fr"],
  ["german", "de"],
  ["alemão", "de"],
  ["italian", "it"],
  ["italiano", "it"],
]);

const goalKeyMap = new Map([
  ["everydayConversation", "everyday_conversation"],
  ["work", "work"],
  ["travel", "travel"],
]);

const priorityScoreMap = new Map([
  ["low", 25],
  ["medium", 60],
  ["high", 100],
]);

function parseArgs(argv) {
  const options = {
    grammarPath: defaultGrammarPath,
    nonGrammarPath: defaultNonGrammarPath,
    status: "draft",
    version: null,
    targetLanguage: null,
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

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`${arg} requires a value`);
    }

    if (arg === "--grammar") options.grammarPath = resolve(process.cwd(), next);
    else if (arg === "--non-grammar")
      options.nonGrammarPath = resolve(process.cwd(), next);
    else if (arg === "--status") options.status = next;
    else if (arg === "--version") options.version = next;
    else if (arg === "--target-language") options.targetLanguage = next;
    else if (arg === "--transaction-timeout-ms") {
      const timeout = Number(next);
      if (!Number.isInteger(timeout) || timeout <= 0) {
        throw new Error("--transaction-timeout-ms must be a positive integer");
      }
      options.transactionTimeoutMs = timeout;
    } else if (arg === "--help") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }

    index += 1;
  }

  return options;
}

function printUsage() {
  console.log(`Usage:
  pnpm --filter @luma-lingo/database db:import:competencies -- [options]

Options:
  --grammar <path>          Grammar competency JSON path.
  --non-grammar <path>      Non-grammar competency JSON path.
  --version <version>       Runtime catalog version. Defaults to en-mvp-<schema>.
  --target-language <code>  Target language code. Defaults from the source file.
  --status <status>         Catalog status. Defaults to draft.
  --transaction-timeout-ms  Prisma transaction timeout. Defaults to 60000.
  --dry-run                 Validate and summarize without writing to the DB.
`);
}

async function readJsonFile(path) {
  const text = await readFile(path, "utf8");
  return {
    path,
    text,
    json: JSON.parse(text),
  };
}

function assertCatalogShape(name, catalog) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    throw new Error(`${name} catalog must be a JSON object`);
  }

  for (const field of [
    "schemaVersion",
    "catalogId",
    "targetLanguage",
    "competencyCount",
    "competencies",
  ]) {
    if (!(field in catalog)) {
      throw new Error(`${name} catalog is missing ${field}`);
    }
  }

  if (!Array.isArray(catalog.competencies)) {
    throw new Error(`${name} catalog competencies must be an array`);
  }

  if (catalog.competencies.length !== catalog.competencyCount) {
    throw new Error(
      `${name} catalog count mismatch: expected ${catalog.competencyCount}, got ${catalog.competencies.length}`,
    );
  }
}

function normalizeLanguage(value) {
  const raw = String(value).trim();
  const mapped = languageNameToCode.get(raw.toLowerCase());
  return mapped ?? raw.toLowerCase();
}

function normalizeFamily(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function deterministicUuid(namespace, value) {
  const hex = createHash("sha256")
    .update(`${namespace}:${value}`)
    .digest("hex")
    .slice(0, 32);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function combinedChecksum(files) {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.path);
    hash.update("\0");
    hash.update(file.text);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function compactJson(value) {
  if (Array.isArray(value)) return value.map(compactJson);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, compactJson(entry)]),
  );
}

function mapGrammarCompetency(source, catalogId, sourceCatalog) {
  return {
    id: deterministicUuid("competency", `${catalogId}:${source.id}`),
    catalogId,
    key: source.id,
    title: source.topic,
    description: source.canUse,
    family: "grammar",
    mode: null,
    difficultyBand: source.level,
    isCore: String(source.category ?? "")
      .toLowerCase()
      .includes("core"),
    details: compactJson({
      schemaVersion: 1,
      sourceType: "grammar",
      sourceCatalogId: sourceCatalog.catalogId,
      sourceSchemaVersion: sourceCatalog.schemaVersion,
      sequence: source.sequence,
      grammarArea: source.grammarArea,
      grammarFamily: source.grammarFamily,
      category: source.category,
      canExplain: source.canExplain,
      canUse: source.canUse,
      forms: source.forms ?? [],
      examples: source.examples ?? [],
      teaches: source.teaches ?? [],
      commonLearnerErrors: source.commonLearnerErrors ?? [],
      prerequisites: source.prerequisites ?? [],
      sourceAlignment: source.sourceAlignment ?? [],
    }),
  };
}

function mapNonGrammarCompetency(source, catalogId, sourceCatalog) {
  return {
    id: deterministicUuid("competency", `${catalogId}:${source.id}`),
    catalogId,
    key: source.id,
    title: source.topic,
    description: source.canDo,
    family: normalizeFamily(source.skill),
    mode: source.mode ?? null,
    difficultyBand: source.level,
    isCore: false,
    details: compactJson({
      schemaVersion: 1,
      sourceType: "non_grammar",
      sourceCatalogId: sourceCatalog.catalogId,
      sourceSchemaVersion: sourceCatalog.schemaVersion,
      source: source.source,
      skill: source.skill,
      category: source.category,
      canDo: source.canDo,
      tags: source.tags ?? [],
      languageFocus: source.languageFocus ?? [],
      scenarioFocus: source.scenarioFocus ?? [],
      teaches: source.teaches ?? [],
      reinforces: source.reinforces ?? [],
      suggestedModuleUse: source.suggestedModuleUse,
      mvpFit: source.mvpFit,
      speakingMvpPolicy: source.speakingMvpPolicy,
    }),
  };
}

function buildImportPlan(grammarFile, nonGrammarFile, options) {
  const grammarCatalog = grammarFile.json;
  const nonGrammarCatalog = nonGrammarFile.json;

  assertCatalogShape("Grammar", grammarCatalog);
  assertCatalogShape("Non-grammar", nonGrammarCatalog);

  const targetLanguage =
    options.targetLanguage ?? normalizeLanguage(grammarCatalog.targetLanguage);
  const version =
    options.version ?? `${targetLanguage}-mvp-${grammarCatalog.schemaVersion}`;
  const catalogId = deterministicUuid(
    "competency-catalog",
    `${targetLanguage}:${version}`,
  );

  const grammarCompetencies = grammarCatalog.competencies.map((competency) =>
    mapGrammarCompetency(competency, catalogId, grammarCatalog),
  );
  const nonGrammarCompetencies = nonGrammarCatalog.competencies.map(
    (competency) =>
      mapNonGrammarCompetency(competency, catalogId, nonGrammarCatalog),
  );
  const competencies = [...grammarCompetencies, ...nonGrammarCompetencies];
  const competencyByKey = new Map();

  for (const competency of competencies) {
    if (competencyByKey.has(competency.key)) {
      throw new Error(`Duplicate competency key: ${competency.key}`);
    }
    competencyByKey.set(competency.key, competency);
  }

  const prerequisites = [];
  for (const source of grammarCatalog.competencies) {
    const competency = competencyByKey.get(source.id);
    for (const prerequisiteKey of source.prerequisites ?? []) {
      const prerequisite = competencyByKey.get(prerequisiteKey);
      if (!prerequisite) {
        throw new Error(
          `Unknown prerequisite ${prerequisiteKey} for ${source.id}`,
        );
      }

      prerequisites.push({
        competencyId: competency.id,
        prerequisiteId: prerequisite.id,
        strength: null,
        details: {
          schemaVersion: 1,
          sourceType: "grammar_prerequisite",
          prerequisiteKey,
        },
      });
    }
  }

  const goalPriorities = [];
  for (const source of nonGrammarCatalog.competencies) {
    const competency = competencyByKey.get(source.id);
    for (const [sourceGoal, sourcePriority] of Object.entries(
      source.goalPriorities ?? {},
    )) {
      const goal = goalKeyMap.get(sourceGoal) ?? normalizeFamily(sourceGoal);
      const priority = priorityScoreMap.get(String(sourcePriority));
      if (priority === undefined) {
        throw new Error(
          `Unknown goal priority ${sourcePriority} for ${source.id}.${sourceGoal}`,
        );
      }

      goalPriorities.push({
        id: deterministicUuid(
          "competency-goal-priority",
          `${competency.id}:${goal}`,
        ),
        competencyId: competency.id,
        goal,
        priority,
        details: {
          schemaVersion: 1,
          sourcePriority,
        },
      });
    }
  }

  return {
    catalog: {
      id: catalogId,
      targetLanguage,
      version,
      status: options.status,
      publishedAt: options.status === "published" ? new Date() : null,
      sourceChecksum: combinedChecksum([grammarFile, nonGrammarFile]),
      metadata: {
        schemaVersion: 1,
        sourceCatalogs: [
          {
            kind: "grammar",
            catalogId: grammarCatalog.catalogId,
            schemaVersion: grammarCatalog.schemaVersion,
            competencyCount: grammarCatalog.competencyCount,
          },
          {
            kind: "non_grammar",
            catalogId: nonGrammarCatalog.catalogId,
            schemaVersion: nonGrammarCatalog.schemaVersion,
            competencyCount: nonGrammarCatalog.competencyCount,
          },
        ],
      },
    },
    competencies,
    prerequisites,
    goalPriorities,
  };
}

async function writePlan(plan, options) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.competencyCatalog.upsert({
          where: {
            targetLanguage_version: {
              targetLanguage: plan.catalog.targetLanguage,
              version: plan.catalog.version,
            },
          },
          create: plan.catalog,
          update: {
            status: plan.catalog.status,
            publishedAt: plan.catalog.publishedAt,
            sourceChecksum: plan.catalog.sourceChecksum,
            metadata: plan.catalog.metadata,
          },
        });

        for (const competency of plan.competencies) {
          await tx.competency.upsert({
            where: {
              catalogId_key: {
                catalogId: competency.catalogId,
                key: competency.key,
              },
            },
            create: competency,
            update: {
              title: competency.title,
              description: competency.description,
              family: competency.family,
              mode: competency.mode,
              difficultyBand: competency.difficultyBand,
              isCore: competency.isCore,
              details: competency.details,
            },
          });
        }

        const competencyIds = plan.competencies.map(({ id }) => id);
        await tx.competencyPrerequisite.deleteMany({
          where: { competencyId: { in: competencyIds } },
        });
        await tx.competencyGoalPriority.deleteMany({
          where: { competencyId: { in: competencyIds } },
        });

        if (plan.prerequisites.length > 0) {
          await tx.competencyPrerequisite.createMany({
            data: plan.prerequisites,
          });
        }

        if (plan.goalPriorities.length > 0) {
          await tx.competencyGoalPriority.createMany({
            data: plan.goalPriorities,
          });
        }
      },
      { timeout: options.transactionTimeoutMs },
    );
  } finally {
    await prisma.$disconnect();
  }
}

function printSummary(plan, dryRun) {
  console.log(
    JSON.stringify(
      {
        dryRun,
        catalog: {
          targetLanguage: plan.catalog.targetLanguage,
          version: plan.catalog.version,
          status: plan.catalog.status,
        },
        counts: {
          competencies: plan.competencies.length,
          prerequisites: plan.prerequisites.length,
          goalPriorities: plan.goalPriorities.length,
        },
      },
      null,
      2,
    ),
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const grammarFile = await readJsonFile(options.grammarPath);
  const nonGrammarFile = await readJsonFile(options.nonGrammarPath);
  const plan = buildImportPlan(grammarFile, nonGrammarFile, options);

  if (!options.dryRun) {
    await writePlan(plan, options);
  }

  printSummary(plan, options.dryRun);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
