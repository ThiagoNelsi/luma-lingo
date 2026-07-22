import { describe, expect, it } from "vitest";

import { pedagogicalPolicySchema } from "./pedagogical-policy.js";

describe("pedagogicalPolicySchema", () => {
  it("accepts sparse integer policy weights and configurable ranking", () => {
    expect(
      pedagogicalPolicySchema.parse({
        id: "synthetic-policy",
        language: "en",
        version: "1.0.0",
        catalogVersion: "1.0.0",
        competencyWeights: [
          { competencyId: "en.ask-for-help.a1", basePriority: 80 },
          { competencyId: "en.greet.a1", foundationWeight: 90 },
        ],
        competencyGoalWeights: [
          {
            competencyId: "en.ask-for-help.a1",
            goal: "travel",
            weight: 75,
          },
        ],
        conceptGoalWeights: [
          {
            conceptId: "function.request.help",
            goal: "travel",
            weight: 65,
          },
        ],
        ranking: {
          readiness: 100,
          foundation: 30,
          basePriority: 20,
          goalFit: 25,
          knowledgeGap: 40,
          uncertainty: 15,
          reviewNeed: 10,
          recentRepetition: 20,
          recentRepetitionWindowDays: 7,
        },
      }),
    ).toMatchObject({
      competencyWeights: expect.arrayContaining([
        { competencyId: "en.ask-for-help.a1", basePriority: 80 },
      ]),
    });
  });

  it("rejects duplicate references and non-integer or out-of-range weights", () => {
    expect(() =>
      pedagogicalPolicySchema.parse({
        id: "synthetic-policy",
        language: "en",
        version: "1.0.0",
        catalogVersion: "1.0.0",
        competencyWeights: [
          { competencyId: "en.greet.a1", basePriority: 10 },
          { competencyId: "en.greet.a1", foundationWeight: 20 },
        ],
        competencyGoalWeights: [],
        conceptGoalWeights: [],
      }),
    ).toThrow(/duplicate_competency_weight/i);

    expect(() =>
      pedagogicalPolicySchema.parse({
        id: "synthetic-policy",
        language: "en",
        version: "1.0.0",
        catalogVersion: "1.0.0",
        competencyWeights: [
          { competencyId: "en.greet.a1", basePriority: 10.5 },
        ],
        competencyGoalWeights: [],
        conceptGoalWeights: [],
      }),
    ).toThrow();
  });
});
