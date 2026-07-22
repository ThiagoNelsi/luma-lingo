import { describe, expect, it } from "vitest";

import {
  evaluateActivityReadiness,
  inferAssumedConceptEvidence,
  projectCompetencyMastery,
  resolveCompetencyMastery,
} from "./knowledge-inference.js";

describe("evaluateActivityReadiness", () => {
  it("accepts a higher demonstrated capability for a lower activity requirement", () => {
    const readiness = evaluateActivityReadiness({
      requirements: [
        {
          conceptId: "concept.subject-pronoun",
          requiredCapability: "recognition",
        },
      ],
      conceptStates: [
        {
          conceptId: "concept.subject-pronoun",
          capability: "independent_use",
          mastery: 0.9,
          confidence: 0.9,
        },
      ],
    });

    expect(readiness).toMatchObject({
      isBlocked: false,
      readinessScore: 0.9,
      requirements: [
        {
          status: "satisfied",
          satisfiedByCapability: "independent_use",
        },
      ],
    });
  });

  it("blocks a conjunctive activity requirement when known evidence is below the required capability", () => {
    const readiness = evaluateActivityReadiness({
      requirements: [
        {
          conceptId: "concept.subject-pronoun",
          requiredCapability: "recognition",
        },
        {
          conceptId: "concept.question-form",
          requiredCapability: "contextualized_use",
        },
      ],
      conceptStates: [
        {
          conceptId: "concept.subject-pronoun",
          capability: "recognition",
          mastery: 0.9,
          confidence: 0.9,
        },
        {
          conceptId: "concept.question-form",
          capability: "controlled_production",
          mastery: 0.9,
          confidence: 0.9,
        },
      ],
    });

    expect(readiness).toMatchObject({
      canAttempt: false,
      isBlocked: true,
      readinessScore: 0,
      requirements: [
        { status: "satisfied" },
        { status: "blocked", satisfiedByCapability: null },
      ],
    });
  });

  it("keeps unknown knowledge attemptable with a strong readiness penalty", () => {
    const readiness = evaluateActivityReadiness({
      requirements: [
        {
          conceptId: "concept.unobserved",
          requiredCapability: "recognition",
        },
      ],
      conceptStates: [],
    });

    expect(readiness).toMatchObject({
      canAttempt: true,
      isBlocked: false,
      readinessScore: 0.25,
      requirements: [{ status: "unknown" }],
    });
  });
});

describe("inferAssumedConceptEvidence", () => {
  it("infers weaker positive evidence for assumed concepts after strong direct evidence", () => {
    const inferred = inferAssumedConceptEvidence({
      directEvidence: {
        conceptId: "concept.observed-performance",
        capability: "independent_use",
        score: 1,
        confidence: 0.8,
      },
      assumedRequirements: [
        {
          conceptId: "concept.assumed-foundation",
          requiredCapability: "controlled_production",
        },
      ],
    });

    expect(inferred).toEqual([
      {
        conceptId: "concept.assumed-foundation",
        capability: "controlled_production",
        score: 0.8,
        confidence: 0.6,
        evidenceKind: "inferred",
      },
    ]);
  });

  it.each([
    {
      name: "an incorrect response",
      directEvidence: {
        conceptId: "concept.observed-performance",
        capability: "independent_use" as const,
        score: 0,
        confidence: 0.8,
      },
    },
    {
      name: "a weak response",
      directEvidence: {
        conceptId: "concept.observed-performance",
        capability: "independent_use" as const,
        score: 0.8,
        confidence: 0.8,
      },
    },
    {
      name: "an explicit unknown response",
      directEvidence: {
        conceptId: "concept.observed-performance",
        capability: "independent_use" as const,
        score: 1,
        confidence: 1,
        isExplicitUnknown: true,
      },
    },
    {
      name: "a non-exact word-bank response",
      directEvidence: {
        conceptId: "concept.observed-performance",
        capability: "independent_use" as const,
        score: 1,
        confidence: 1,
        hasExactResponse: false,
      },
    },
  ])("does not infer negative evidence from $name", ({ directEvidence }) => {
    const inferred = inferAssumedConceptEvidence({
      directEvidence,
      assumedRequirements: [
        {
          conceptId: "concept.assumed-foundation",
          requiredCapability: "recognition",
        },
      ],
    });

    expect(inferred).toEqual([]);
  });

  it("uses configurable thresholds before inferring assumed knowledge", () => {
    const inferred = inferAssumedConceptEvidence({
      directEvidence: {
        conceptId: "concept.observed-performance",
        capability: "independent_use",
        score: 0.9,
        confidence: 0.8,
      },
      assumedRequirements: [
        {
          conceptId: "concept.assumed-foundation",
          requiredCapability: "recognition",
        },
      ],
      policy: {
        strongPositiveMinScore: 0.95,
      },
    });

    expect(inferred).toEqual([]);
  });
});

describe("projectCompetencyMastery", () => {
  it("averages known component mastery and reports unknown coverage separately", () => {
    const projection = projectCompetencyMastery({
      componentConceptIds: ["concept.known", "concept.unknown"],
      conceptStates: [
        {
          conceptId: "concept.known",
          mastery: 0.75,
          confidence: 0.75,
        },
      ],
    });

    expect(projection).toEqual({
      kind: "projection",
      projectedMastery: 0.75,
      coverage: 0.5,
      projectedConfidence: 0.375,
      knownComponentCount: 1,
      componentCount: 2,
    });
  });

  it("uses the highest known capability when a component has multiple states", () => {
    const projection = projectCompetencyMastery({
      componentConceptIds: ["concept.known"],
      conceptStates: [
        {
          conceptId: "concept.known",
          capability: "recognition",
          mastery: 0.5,
          confidence: 0.9,
        },
        {
          conceptId: "concept.known",
          capability: "independent_use",
          mastery: 0.75,
          confidence: 0.8,
        },
      ],
    });

    expect(projection).toMatchObject({
      projectedMastery: 0.75,
      projectedConfidence: 0.8,
    });
  });

  it("uses direct integrated evidence for a componentless competency", () => {
    const mastery = resolveCompetencyMastery({
      componentConceptIds: [],
      conceptStates: [],
      directIntegratedState: {
        mastery: 0.9,
        confidence: 0.8,
      },
    });

    expect(mastery).toEqual({
      kind: "direct",
      mastery: 0.9,
      confidence: 0.8,
    });
  });
});
