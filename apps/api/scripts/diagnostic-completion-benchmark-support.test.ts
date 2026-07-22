import { describe, expect, it, vi } from "vitest";

import {
  createBenchmarkQueryMetricsCollector,
  removeDiagnosticBenchmarkUsers,
  summarizeDiagnosticBenchmarkMeasurements,
  validateDiagnosticBenchmarkState,
} from "./diagnostic-completion-benchmark-support.js";

describe("diagnostic completion benchmark support", () => {
  it("collects query metrics only while measurement is active", () => {
    const collector = createBenchmarkQueryMetricsCollector();

    collector.record(50);
    collector.start();
    collector.record(30);
    collector.record(20);
    const measurement = collector.stop(125.678);
    collector.record(40);

    expect(measurement).toEqual({
      wallDurationMs: 125.68,
      databaseDurationMs: 50,
      sqlStatementCount: 2,
    });
  });

  it("summarizes median and range without mutating measurements", () => {
    const measurements = [
      {
        run: 1,
        wallDurationMs: 300,
        databaseDurationMs: 270,
        sqlStatementCount: 8,
      },
      {
        run: 2,
        wallDurationMs: 100,
        databaseDurationMs: 90,
        sqlStatementCount: 8,
      },
      {
        run: 3,
        wallDurationMs: 200,
        databaseDurationMs: 180,
        sqlStatementCount: 8,
      },
    ];

    expect(summarizeDiagnosticBenchmarkMeasurements(measurements)).toEqual({
      medianWallDurationMs: 200,
      minWallDurationMs: 100,
      maxWallDurationMs: 300,
      medianDatabaseDurationMs: 180,
      sqlStatementCount: 8,
    });
    expect(
      measurements.map((measurement) => measurement.wallDurationMs),
    ).toEqual([300, 100, 200]);
  });

  it("validates that sparse state counts preserve append-only evidence", () => {
    expect(
      validateDiagnosticBenchmarkState({
        expectedCompetencyEvidenceCount: 16,
        competencyEvidenceCount: 16,
        competencyStateEvidenceCounts: [3, 4, 9],
        conceptEvidenceCount: 49,
        conceptStateEvidenceCounts: [10, 12, 27],
      }),
    ).toEqual({
      competencyEvidenceCount: 16,
      competencyStateCount: 3,
      competencyStateEvidenceCount: 16,
      conceptEvidenceCount: 49,
      conceptStateCount: 3,
      conceptStateEvidenceCount: 49,
      evidenceHistoryPreserved: true,
    });
  });

  it("removes only the supplied benchmark users inside the trigger guard", async () => {
    const calls: string[] = [];
    const transaction = {
      $executeRaw: vi.fn(async () => {
        calls.push("trigger");
        return 1;
      }),
      user: {
        deleteMany: vi.fn(async ({ where }) => {
          calls.push(`delete:${where.id.in.join(",")}`);
          return { count: where.id.in.length };
        }),
      },
    };
    const client = {
      $transaction: vi.fn(async (callback) => callback(transaction)),
    };

    await removeDiagnosticBenchmarkUsers(client as never, ["user-1", "user-2"]);

    expect(calls).toEqual(["trigger", "delete:user-1,user-2", "trigger"]);
  });
});
