import { createId, PrismaClient } from "@luma-lingo/database";

import {
  createBenchmarkQueryMetricsCollector,
  type DiagnosticBenchmarkMeasurement,
  removeDiagnosticBenchmarkUsers,
  summarizeDiagnosticBenchmarkMeasurements,
  validateDiagnosticBenchmarkState,
} from "./diagnostic-completion-benchmark-support.js";
import { learnerConceptStateBatchRowSchema } from "../src/learning/learner-state-batch.js";
import { PrismaDiagnosticAttemptRepository } from "../src/repositories/prisma-diagnostic-attempt-repository.js";
import { writeLearnerStateBatch } from "../src/repositories/prisma-learner-state-batch-writer.js";

if (process.env.NODE_ENV === "production") {
  throw new Error("The diagnostic completion benchmark is development-only");
}

const runCount = 5;
const itemCount = 16;
const queryMetrics = createBenchmarkQueryMetricsCollector();
const client = new PrismaClient({
  log: [{ emit: "event", level: "query" }],
});

client.$on("query", (event) => {
  queryMetrics.record(event.duration);
});

const residualBenchmarkUsers = await client.user.findMany({
  where: {
    primaryEmail: {
      startsWith: "diagnostic-benchmark-",
    },
  },
  select: {
    id: true,
  },
});

await removeDiagnosticBenchmarkUsers(
  client,
  residualBenchmarkUsers.map((user) => user.id),
);

const catalog = await client.competencyCatalog.findFirst({
  where: {
    status: "published",
  },
  orderBy: {
    publishedAt: "desc",
  },
});

if (!catalog) {
  throw new Error(
    "A published competency catalog is required for the benchmark",
  );
}

const availableItems = await client.diagnosticItem.findMany({
  where: {
    catalogId: catalog.id,
    status: "published",
    primaryCompetencyId: {
      not: null,
    },
  },
  include: {
    conceptEvidenceMappings: true,
  },
  orderBy: {
    key: "asc",
  },
  take: itemCount,
});

if (availableItems.length !== itemCount) {
  throw new Error(`The benchmark requires ${itemCount} published items`);
}

const measurements: DiagnosticBenchmarkMeasurement[] = [];
let lastValidation: Record<string, number | boolean> = {};

for (let run = 1; run <= runCount; run += 1) {
  const userId = createId();
  const learnerId = createId();
  const learningTrackId = createId();
  const attemptId = createId();
  const benchmarkStartedAt = new Date("2026-07-22T12:00:00.000Z");

  try {
    await client.user.create({
      data: {
        id: userId,
        primaryEmail: `diagnostic-benchmark-${userId}@example.invalid`,
        emailVerifiedAt: benchmarkStartedAt,
        learner: {
          create: {
            id: learnerId,
            instructionLanguage: "pt-BR",
            learningTracks: {
              create: {
                id: learningTrackId,
                targetLanguage: catalog.targetLanguage,
                competencyCatalogId: catalog.id,
                onboardingStartingPoint: "diagnostic",
                onboardingStatus: "in_progress",
              },
            },
          },
        },
      },
    });

    await client.diagnosticAttempt.create({
      data: {
        id: attemptId,
        learningTrackId,
        catalogId: catalog.id,
        purpose: "onboarding_initial",
        status: "in_progress",
        selectionPolicyVersion: "benchmark-selection-v1",
        scoringPolicyVersion: "benchmark-scoring-v1",
        startedAt: benchmarkStartedAt,
        details: {
          benchmark: true,
        },
        items: {
          create: availableItems.map((item, index) => ({
            id: createId(),
            diagnosticItemId: item.id,
            position: index + 1,
            selectedForRole: "benchmark",
            selectionRule: "benchmark-deterministic-v1",
            selectionTrace: {
              benchmark: true,
            },
            response: {
              kind: "benchmark",
            },
            score: index % 4 === 0 ? 0.95 : 1,
            confidence: 0.8,
            shownAt: new Date(benchmarkStartedAt.getTime() + index * 2_000),
            answeredAt: new Date(
              benchmarkStartedAt.getTime() + index * 2_000 + 1_000,
            ),
            details: {
              schemaVersion: 1,
              responseKind: "multiple_choice",
              mistakeCodes: [],
            },
          })),
        },
      },
    });

    const repository = new PrismaDiagnosticAttemptRepository(client);
    queryMetrics.start();
    const startedAt = performance.now();

    await repository.completeAttempt({
      attemptId,
      completedAt: new Date("2026-07-22T12:10:00.000Z"),
      summary: {
        schemaVersion: 1,
        answeredItemCount: itemCount,
        stopReason: "max_items_reached",
      },
    });

    const queryMeasurement = queryMetrics.stop(performance.now() - startedAt);
    const [
      competencyEvidenceCount,
      conceptEvidenceCount,
      competencyStates,
      conceptStates,
    ] = await Promise.all([
      client.competencyEvidence.count({ where: { learningTrackId } }),
      client.conceptEvidence.count({ where: { learningTrackId } }),
      client.learnerCompetencyState.findMany({
        where: { learningTrackId },
        select: { evidenceCount: true },
      }),
      client.learnerConceptState.findMany({
        where: { learningTrackId },
        select: {
          directEvidenceCount: true,
          inferredEvidenceCount: true,
        },
      }),
    ]);
    lastValidation = validateDiagnosticBenchmarkState({
      expectedCompetencyEvidenceCount: itemCount,
      competencyEvidenceCount,
      competencyStateEvidenceCounts: competencyStates.map(
        (state) => state.evidenceCount,
      ),
      conceptEvidenceCount,
      conceptStateEvidenceCounts: conceptStates.map(
        (state) => state.directEvidenceCount + state.inferredEvidenceCount,
      ),
    });

    if (lastValidation.evidenceHistoryPreserved !== true) {
      throw new Error("Batch state counts do not match append-only evidence");
    }

    measurements.push({
      run,
      ...queryMeasurement,
    });

    if (run === runCount) {
      const directState = await client.learnerConceptState.findFirst({
        where: {
          learningTrackId,
          directEvidenceCount: {
            gt: 0,
          },
        },
      });

      if (!directState) {
        throw new Error(
          "A direct concept state is required for conflict validation",
        );
      }

      const inferredObservedAt = new Date("2026-07-22T12:11:00.000Z");
      const inferredStateRow = learnerConceptStateBatchRowSchema.parse({
        id: createId(),
        learningTrackId,
        conceptId: directState.conceptId,
        capability: directState.capability,
        mastery: 0.1,
        confidence: 0.1,
        directEvidenceCount: 0,
        inferredEvidenceCount: 1,
        lastEvidenceAt: inferredObservedAt,
        details: {
          schemaVersion: 1,
          lastUpdateReason: "benchmark-inference-only",
          scoringPolicyVersion: "benchmark-scoring-v1",
        },
      });

      await client.$transaction(async (transaction) => {
        await transaction.conceptEvidence.create({
          data: {
            id: createId(),
            learningTrackId,
            conceptId: directState.conceptId,
            capability: directState.capability,
            evidenceKind: "inferred",
            sourceType: "benchmark_conflict_validation",
            observedAt: inferredObservedAt,
            score: 0.1,
            confidence: 0.1,
            strength: 10,
            details: {
              benchmark: true,
            },
          },
        });
        await writeLearnerStateBatch(transaction, {
          competencyStates: [],
          conceptStates: [inferredStateRow],
        });
      });

      const stateAfterInference = await client.learnerConceptState.findUnique({
        where: {
          learningTrackId_conceptId_capability: {
            learningTrackId,
            conceptId: directState.conceptId,
            capability: directState.capability,
          },
        },
      });
      const inferenceOnlyConflictPreservedDirectMastery =
        stateAfterInference?.mastery === directState.mastery &&
        stateAfterInference.confidence === directState.confidence &&
        stateAfterInference.directEvidenceCount ===
          directState.directEvidenceCount &&
        stateAfterInference.inferredEvidenceCount ===
          directState.inferredEvidenceCount + 1;

      if (!inferenceOnlyConflictPreservedDirectMastery) {
        throw new Error(
          "Inference-only conflict overwrote direct concept mastery",
        );
      }

      lastValidation = {
        ...lastValidation,
        inferenceOnlyConflictPreservedDirectMastery,
      };
    }
  } finally {
    queryMetrics.stop(0);
    await removeDiagnosticBenchmarkUsers(client, [userId]);
  }
}

const conceptEvidenceMappingCount = availableItems.reduce(
  (total, item) => total + item.conceptEvidenceMappings.length,
  0,
);

console.log(
  JSON.stringify(
    {
      scenario: {
        runCount,
        itemCount,
        competencyEvidenceCount: itemCount,
        conceptEvidenceMappingCount,
        catalogStatus: catalog.status,
        deterministicItemOrder: "diagnostic_item.key ASC",
        databaseEndpoint: process.env.DATABASE_URL?.includes("-pooler")
          ? "Neon pooled"
          : "PostgreSQL",
      },
      measurements,
      validation: lastValidation,
      summary: summarizeDiagnosticBenchmarkMeasurements(measurements),
    },
    null,
    2,
  ),
);

await client.$disconnect();
