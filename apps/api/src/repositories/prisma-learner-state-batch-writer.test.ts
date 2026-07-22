import { describe, expect, it, vi } from "vitest";

import { writeLearnerStateBatch } from "./prisma-learner-state-batch-writer.js";

describe("writeLearnerStateBatch", () => {
  it("writes each non-empty state collection with one database command", async () => {
    const transaction = {
      $executeRaw: vi.fn(async () => 1),
    };
    const observedAt = new Date("2026-07-22T12:00:00.000Z");

    await writeLearnerStateBatch(transaction as never, {
      competencyStates: [
        {
          id: "019f8a51-d353-7943-ada0-e987a3828348",
          learningTrackId: "019f8a51-d353-7943-ada0-e987a3828349",
          competencyId: "019f8a51-d353-7943-ada0-e987a3828350",
          abilityEstimate: 0.9,
          confidence: 0.8,
          evidenceCount: 3,
          lastEvidenceAt: observedAt,
          details: { schemaVersion: 1 },
        },
      ],
      conceptStates: [
        {
          id: "019f8a51-d353-7943-ada0-e987a3828351",
          learningTrackId: "019f8a51-d353-7943-ada0-e987a3828349",
          conceptId: "019f8a51-d353-7943-ada0-e987a3828352",
          capability: "recognition",
          mastery: 0.9,
          confidence: 0.8,
          directEvidenceCount: 2,
          inferredEvidenceCount: 1,
          lastEvidenceAt: observedAt,
          details: { schemaVersion: 1 },
        },
      ],
    });

    expect(transaction.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it("does not issue database commands for an empty batch", async () => {
    const transaction = {
      $executeRaw: vi.fn(async () => 1),
    };

    await writeLearnerStateBatch(transaction as never, {
      competencyStates: [],
      conceptStates: [],
    });

    expect(transaction.$executeRaw).not.toHaveBeenCalled();
  });
});
