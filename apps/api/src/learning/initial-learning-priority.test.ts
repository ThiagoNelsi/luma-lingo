import { describe, expect, it } from "vitest";

import { rankInitialLearningPriorities } from "./initial-learning-priority.js";

const policy = {
  version: "1.0.0",
  competencyWeights: [
    { competencyId: "foundation", basePriority: 40, foundationWeight: 100 },
    { competencyId: "goal-fit", basePriority: 90, foundationWeight: 100 },
  ],
  competencyGoalWeights: [
    { competencyId: "goal-fit", goal: "travel", weight: 100 },
  ],
  conceptGoalWeights: [{ conceptId: "component", goal: "travel", weight: 100 }],
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
} as const;

describe("rankInitialLearningPriorities", () => {
  it("chooses eligible Pre-A1 foundations for a beginner before A1 goal fit", () => {
    const priorities = rankInitialLearningPriorities({
      onboardingStartingPoint: "beginner",
      primaryGoal: "travel",
      additionalGoals: [],
      policy,
      now: new Date("2026-07-22T12:00:00.000Z"),
      competencies: [
        {
          id: "foundation",
          key: "en.synthetic.foundation.pre_a1",
          difficultyBand: "pre_a1",
          componentConceptIds: [],
          assumedConcepts: [],
        },
        {
          id: "goal-fit",
          key: "en.synthetic.goal-fit.a1",
          difficultyBand: "a1",
          componentConceptIds: ["component"],
          assumedConcepts: [],
        },
      ],
      conceptStates: [],
      competencyStates: [],
    });

    expect(priorities.map((priority) => priority.competencyId)).toEqual([
      "foundation",
    ]);
    expect(priorities[0]).toMatchObject({
      goalFit: 0,
      selectionReason: "beginner_pre_a1_foundation",
    });
  });

  it("uses explicit goal weights over inherited component relevance and supports diagnostic learners", () => {
    const priorities = rankInitialLearningPriorities({
      onboardingStartingPoint: "diagnostic",
      primaryGoal: "travel",
      additionalGoals: ["work"],
      policy,
      now: new Date("2026-07-22T12:00:00.000Z"),
      competencies: [
        {
          id: "foundation",
          key: "en.synthetic.foundation.pre_a1",
          difficultyBand: "pre_a1",
          componentConceptIds: ["component"],
          assumedConcepts: [],
        },
        {
          id: "goal-fit",
          key: "en.synthetic.goal-fit.a1",
          difficultyBand: "a1",
          componentConceptIds: ["component"],
          assumedConcepts: [],
        },
      ],
      conceptStates: [
        {
          conceptId: "component",
          capability: "recognition",
          mastery: 0.2,
          confidence: 0.8,
          lastEvidenceAt: new Date("2026-06-01T12:00:00.000Z"),
        },
      ],
      competencyStates: [],
    });

    expect(priorities[0]).toMatchObject({
      competencyId: "goal-fit",
      goalFit: 100,
      selectionReason: "diagnostic_ranking",
    });
    expect(priorities[1]).toMatchObject({
      competencyId: "foundation",
      goalFit: 100,
    });
  });

  it("does not let goal fit select a candidate with blocked assumed knowledge", () => {
    const priorities = rankInitialLearningPriorities({
      onboardingStartingPoint: "diagnostic",
      primaryGoal: "travel",
      additionalGoals: [],
      policy,
      now: new Date("2026-07-22T12:00:00.000Z"),
      competencies: [
        {
          id: "foundation",
          key: "en.synthetic.foundation.a1",
          difficultyBand: "a1",
          componentConceptIds: [],
          assumedConcepts: [],
        },
        {
          id: "goal-fit",
          key: "en.synthetic.goal-fit.a1",
          difficultyBand: "a1",
          componentConceptIds: [],
          assumedConcepts: [
            { conceptId: "blocked", requiredCapability: "recognition" },
          ],
        },
      ],
      conceptStates: [
        {
          conceptId: "blocked",
          capability: "recognition",
          mastery: 0.1,
          confidence: 0.9,
          lastEvidenceAt: null,
        },
      ],
      competencyStates: [],
    });

    expect(priorities.map((priority) => priority.competencyId)).toEqual([
      "foundation",
    ]);
  });

  it("derives sparse component relevance with missing weights as zero and halves additional goals", () => {
    const priorities = rankInitialLearningPriorities({
      onboardingStartingPoint: "diagnostic",
      primaryGoal: "work",
      additionalGoals: ["travel"],
      policy: {
        ...policy,
        competencyGoalWeights: [],
      },
      now: new Date("2026-07-22T12:00:00.000Z"),
      competencies: [
        {
          id: "foundation",
          key: "en.synthetic.foundation.a1",
          difficultyBand: "a1",
          componentConceptIds: ["component", "missing"],
          assumedConcepts: [],
        },
      ],
      conceptStates: [],
      competencyStates: [],
    });

    // Inherited travel relevance is 0.7 * 100 + 0.3 * 50 = 85; an
    // additional goal contributes its strongest relevance at factor 0.5.
    expect(priorities[0]?.goalFit).toBe(42.5);
  });

  it("changes a deterministic simulation when configured scoring weights change", () => {
    const input = {
      onboardingStartingPoint: "diagnostic" as const,
      primaryGoal: "travel" as const,
      additionalGoals: [],
      now: new Date("2026-07-22T12:00:00.000Z"),
      competencies: [
        {
          id: "foundation",
          key: "en.synthetic.foundation.a1",
          difficultyBand: "a1",
          componentConceptIds: [],
          assumedConcepts: [],
        },
        {
          id: "goal-fit",
          key: "en.synthetic.goal-fit.a1",
          difficultyBand: "a1",
          componentConceptIds: ["component"],
          assumedConcepts: [],
        },
      ],
      conceptStates: [],
      competencyStates: [],
    };

    const basePriorityFirst = rankInitialLearningPriorities({
      ...input,
      policy: {
        ...policy,
        competencyWeights: [
          {
            competencyId: "foundation",
            basePriority: 90,
            foundationWeight: 100,
          },
          { competencyId: "goal-fit", basePriority: 40, foundationWeight: 100 },
        ],
        ranking: { ...policy.ranking, basePriority: 100, goalFit: 0 },
      },
    });
    const goalFitFirst = rankInitialLearningPriorities({
      ...input,
      policy: {
        ...policy,
        competencyWeights: [
          {
            competencyId: "foundation",
            basePriority: 90,
            foundationWeight: 100,
          },
          { competencyId: "goal-fit", basePriority: 40, foundationWeight: 100 },
        ],
        ranking: { ...policy.ranking, basePriority: 0, goalFit: 100 },
      },
    });

    expect(basePriorityFirst[0]?.competencyId).toBe("foundation");
    expect(goalFitFirst[0]?.competencyId).toBe("goal-fit");
  });
});
