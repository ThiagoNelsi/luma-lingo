import type { PrismaClient } from "@luma-lingo/database";

export type DiagnosticBenchmarkMeasurement = {
  run: number;
  wallDurationMs: number;
  databaseDurationMs: number;
  sqlStatementCount: number;
};

type DiagnosticBenchmarkQueryMeasurement = Omit<
  DiagnosticBenchmarkMeasurement,
  "run"
>;

export function createBenchmarkQueryMetricsCollector(): {
  start: () => void;
  record: (durationMs: number) => void;
  stop: (wallDurationMs: number) => DiagnosticBenchmarkQueryMeasurement;
} {
  let isMeasuring = false;
  let sqlStatementCount = 0;
  let databaseDurationMs = 0;

  return {
    start() {
      isMeasuring = true;
      sqlStatementCount = 0;
      databaseDurationMs = 0;
    },
    record(durationMs) {
      if (!isMeasuring) return;
      sqlStatementCount += 1;
      databaseDurationMs += durationMs;
    },
    stop(wallDurationMs) {
      isMeasuring = false;
      return {
        wallDurationMs: Number(wallDurationMs.toFixed(2)),
        databaseDurationMs,
        sqlStatementCount,
      };
    },
  };
}

export function summarizeDiagnosticBenchmarkMeasurements(
  measurements: readonly DiagnosticBenchmarkMeasurement[],
): {
  medianWallDurationMs: number | undefined;
  minWallDurationMs: number | undefined;
  maxWallDurationMs: number | undefined;
  medianDatabaseDurationMs: number | undefined;
  sqlStatementCount: number | undefined;
} {
  const sortedWallDurations = measurements
    .map((measurement) => measurement.wallDurationMs)
    .sort((left, right) => left - right);
  const sortedDatabaseDurations = measurements
    .map((measurement) => measurement.databaseDurationMs)
    .sort((left, right) => left - right);
  const middleIndex = Math.floor(measurements.length / 2);

  return {
    medianWallDurationMs: sortedWallDurations[middleIndex],
    minWallDurationMs: sortedWallDurations[0],
    maxWallDurationMs: sortedWallDurations.at(-1),
    medianDatabaseDurationMs: sortedDatabaseDurations[middleIndex],
    sqlStatementCount: measurements[0]?.sqlStatementCount,
  };
}

export function validateDiagnosticBenchmarkState(input: {
  expectedCompetencyEvidenceCount: number;
  competencyEvidenceCount: number;
  competencyStateEvidenceCounts: readonly number[];
  conceptEvidenceCount: number;
  conceptStateEvidenceCounts: readonly number[];
}): {
  competencyEvidenceCount: number;
  competencyStateCount: number;
  competencyStateEvidenceCount: number;
  conceptEvidenceCount: number;
  conceptStateCount: number;
  conceptStateEvidenceCount: number;
  evidenceHistoryPreserved: boolean;
} {
  const competencyStateEvidenceCount =
    input.competencyStateEvidenceCounts.reduce(
      (total, count) => total + count,
      0,
    );
  const conceptStateEvidenceCount = input.conceptStateEvidenceCounts.reduce(
    (total, count) => total + count,
    0,
  );

  return {
    competencyEvidenceCount: input.competencyEvidenceCount,
    competencyStateCount: input.competencyStateEvidenceCounts.length,
    competencyStateEvidenceCount,
    conceptEvidenceCount: input.conceptEvidenceCount,
    conceptStateCount: input.conceptStateEvidenceCounts.length,
    conceptStateEvidenceCount,
    evidenceHistoryPreserved:
      input.competencyEvidenceCount === input.expectedCompetencyEvidenceCount &&
      competencyStateEvidenceCount === input.competencyEvidenceCount &&
      conceptStateEvidenceCount === input.conceptEvidenceCount,
  };
}

export async function removeDiagnosticBenchmarkUsers(
  client: Pick<PrismaClient, "$transaction">,
  userIds: readonly string[],
): Promise<void> {
  if (userIds.length === 0) return;

  await client.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      ALTER TABLE "concept_evidence"
      DISABLE TRIGGER "concept_evidence_append_only"
    `;
    await transaction.user.deleteMany({
      where: {
        id: {
          in: [...userIds],
        },
      },
    });
    await transaction.$executeRaw`
      ALTER TABLE "concept_evidence"
      ENABLE TRIGGER "concept_evidence_append_only"
    `;
  });
}
