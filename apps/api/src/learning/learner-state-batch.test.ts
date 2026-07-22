import { describe, expect, it } from "vitest";

import { buildLearnerStateBatch } from "./learner-state-batch.js";

describe("buildLearnerStateBatch", () => {
  it("consolidates repeated competency evidence into one final state", () => {
    const firstObservedAt = new Date("2026-07-22T12:00:00.000Z");
    const lastObservedAt = new Date("2026-07-22T12:01:00.000Z");

    const batch = buildLearnerStateBatch({
      scoringPolicyVersion: "scoring-v1",
      competencyEvidence: [
        {
          learningTrackId: "track-1",
          competencyId: "competency-1",
          sourceType: "initial_diagnostic",
          observedAt: firstObservedAt,
          score: 0.4,
          confidence: 0.6,
        },
        {
          learningTrackId: "track-1",
          competencyId: "competency-1",
          sourceType: "initial_diagnostic",
          observedAt: lastObservedAt,
          score: 0.9,
          confidence: 0.8,
        },
      ],
      conceptEvidence: [],
    });

    expect(batch.competencyStates).toEqual([
      {
        id: expect.any(String),
        learningTrackId: "track-1",
        competencyId: "competency-1",
        abilityEstimate: 0.9,
        confidence: 0.8,
        evidenceCount: 2,
        lastEvidenceAt: lastObservedAt,
        details: {
          schemaVersion: 1,
          lastUpdateReason: "initial_diagnostic",
          scoringPolicyVersion: "scoring-v1",
        },
      },
    ]);
    expect(batch.conceptStates).toEqual([]);
  });

  it("consolidates concept evidence while direct evidence controls mastery", () => {
    const firstObservedAt = new Date("2026-07-22T12:00:00.000Z");
    const directObservedAt = new Date("2026-07-22T12:01:00.000Z");
    const lastObservedAt = new Date("2026-07-22T12:02:00.000Z");

    const batch = buildLearnerStateBatch({
      scoringPolicyVersion: "scoring-v1",
      competencyEvidence: [],
      conceptEvidence: [
        {
          learningTrackId: "track-1",
          conceptId: "concept-1",
          capability: "recognition",
          evidenceKind: "inferred",
          sourceType: "initial_diagnostic",
          observedAt: firstObservedAt,
          score: 0.5,
          confidence: 0.3,
        },
        {
          learningTrackId: "track-1",
          conceptId: "concept-1",
          capability: "recognition",
          evidenceKind: "direct",
          sourceType: "initial_diagnostic",
          observedAt: directObservedAt,
          score: 0.9,
          confidence: 0.8,
        },
        {
          learningTrackId: "track-1",
          conceptId: "concept-1",
          capability: "recognition",
          evidenceKind: "inferred",
          sourceType: "initial_diagnostic",
          observedAt: lastObservedAt,
          score: 0.6,
          confidence: 0.4,
        },
      ],
    });

    expect(batch.conceptStates).toEqual([
      {
        id: expect.any(String),
        learningTrackId: "track-1",
        conceptId: "concept-1",
        capability: "recognition",
        mastery: 0.9,
        confidence: 0.8,
        directEvidenceCount: 1,
        inferredEvidenceCount: 2,
        lastEvidenceAt: lastObservedAt,
        details: {
          schemaVersion: 1,
          lastUpdateReason: "knowledge-inference-v1",
          scoringPolicyVersion: "scoring-v1",
        },
      },
    ]);
  });

  it("keeps capability-specific states independent for the same concept", () => {
    const observedAt = new Date("2026-07-22T12:00:00.000Z");

    const batch = buildLearnerStateBatch({
      scoringPolicyVersion: "scoring-v1",
      competencyEvidence: [],
      conceptEvidence: [
        {
          learningTrackId: "track-1",
          conceptId: "concept-1",
          capability: "recognition",
          evidenceKind: "direct",
          sourceType: "initial_diagnostic",
          observedAt,
          score: 0.9,
          confidence: 0.8,
        },
        {
          learningTrackId: "track-1",
          conceptId: "concept-1",
          capability: "controlled_production",
          evidenceKind: "direct",
          sourceType: "initial_diagnostic",
          observedAt,
          score: 0.4,
          confidence: 0.6,
        },
      ],
    });

    expect(batch.conceptStates).toEqual([
      expect.objectContaining({
        capability: "recognition",
        mastery: 0.9,
      }),
      expect.objectContaining({
        capability: "controlled_production",
        mastery: 0.4,
      }),
    ]);
  });
});
