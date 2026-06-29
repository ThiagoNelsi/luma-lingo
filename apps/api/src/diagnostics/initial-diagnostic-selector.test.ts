import { describe, expect, it } from "vitest";

import type { DiagnosticAttemptItem } from "./diagnostic-attempt.js";
import type {
  DiagnosticQuestionBank,
  DiagnosticQuestionBankItem,
} from "./diagnostic-question-bank.js";
import { selectNextInitialDiagnosticItem } from "./initial-diagnostic-selector.js";
import { initialDiagnosticSelectionPolicy } from "./initial-diagnostic-policy.js";

describe("selectNextInitialDiagnosticItem", () => {
  it("uses item key and then id as deterministic tie breakers", () => {
    const laterKeyCandidate = buildQuestionBankItem({
      id: "item-a",
      key: "en.diag.a1.zzz-candidate.001",
      primaryCompetencyId: "competency-1",
      primaryCompetencyKey: "en.a1.zzz-candidate",
      family: "grammar",
      mode: "reading",
    });
    const earlierKeyLaterIdCandidate = buildQuestionBankItem({
      id: "item-b",
      key: "en.diag.a1.aaa-candidate.001",
      primaryCompetencyId: "competency-2",
      primaryCompetencyKey: "en.a1.aaa-candidate",
      family: "grammar",
      mode: "reading",
    });
    const earlierKeyEarlierIdCandidate = buildQuestionBankItem({
      id: "item-a",
      key: "en.diag.a1.aaa-candidate.001",
      primaryCompetencyId: "competency-3",
      primaryCompetencyKey: "en.a1.aaa-candidate-other",
      family: "grammar",
      mode: "reading",
    });

    const firstSelection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        laterKeyCandidate,
        earlierKeyLaterIdCandidate,
      ]),
      attemptItems: [],
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });
    const secondSelection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        earlierKeyLaterIdCandidate,
        earlierKeyEarlierIdCandidate,
      ]),
      attemptItems: [],
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(firstSelection?.item.id).toBe(earlierKeyLaterIdCandidate.id);
    expect(secondSelection?.item.id).toBe(earlierKeyEarlierIdCandidate.id);
    expect(firstSelection?.selectionTrace).toMatchObject({
      tieBreakers: ["score_desc", "item_key_asc", "item_id_asc"],
    });
  });

  it("prefers a new primary competency over a repeated primary competency", () => {
    const repeatedItem = buildQuestionBankItem({
      id: "item-repeated",
      key: "en.diag.a1.aaa-repeated.001",
      primaryCompetencyId: "competency-1",
      primaryCompetencyKey: "en.a1.subject-pronouns",
      family: "grammar",
      mode: "reading",
    });
    const newItem = buildQuestionBankItem({
      id: "item-new",
      key: "en.diag.a1.zzz-new.001",
      primaryCompetencyId: "competency-2",
      primaryCompetencyKey: "en.a1.be-present",
      family: "grammar",
      mode: "reading",
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([repeatedItem, newItem]),
      attemptItems: [
        buildAttemptItem({
          id: "attempt-item-1",
          diagnosticItemId: repeatedItem.id,
          position: 1,
          score: 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
        }),
      ],
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(newItem.id);
    expect(selection?.selectedForRole).toBe("foundation");
  });

  it("stops selection when maxItems answered items have been reached", () => {
    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        buildQuestionBankItem({
          id: "item-1",
          key: "en.diag.a1.next.001",
          primaryCompetencyId: "competency-1",
          primaryCompetencyKey: "en.a1.next",
          family: "grammar",
          mode: "reading",
        }),
      ]),
      attemptItems: [
        buildAttemptItem({
          id: "attempt-item-1",
          diagnosticItemId: "item-answered",
          position: 1,
          score: 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
        }),
      ],
      policy: {
        ...initialDiagnosticSelectionPolicy,
        config: {
          ...initialDiagnosticSelectionPolicy.config,
          maxItems: 1,
        },
      },
      goals: [],
    });

    expect(selection).toBeNull();
  });

  it("disqualifies candidates after maxItemsPerCompetency attempts", () => {
    const answeredItem = buildQuestionBankItem({
      id: "item-answered",
      key: "en.diag.a1.subject-pronouns.001",
      primaryCompetencyId: "competency-1",
      primaryCompetencyKey: "en.a1.subject-pronouns",
      family: "grammar",
      mode: "reading",
    });
    const repeatedCandidate = buildQuestionBankItem({
      id: "item-repeated",
      key: "en.diag.a1.subject-pronouns.002",
      primaryCompetencyId: "competency-1",
      primaryCompetencyKey: "en.a1.subject-pronouns",
      family: "grammar",
      mode: "reading",
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([answeredItem, repeatedCandidate]),
      attemptItems: [
        buildAttemptItem({
          id: "attempt-item-1",
          diagnosticItemId: answeredItem.id,
          position: 1,
          score: 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
        }),
      ],
      policy: {
        ...initialDiagnosticSelectionPolicy,
        config: {
          ...initialDiagnosticSelectionPolicy.config,
          maxItemsPerCompetency: 1,
        },
      },
      goals: [],
    });

    expect(selection).toBeNull();
  });

  it("prefers higher-band items with unknown prerequisite coverage over already-covered prerequisites", () => {
    const knownPrerequisiteItem = buildQuestionBankItem({
      id: "item-known-prerequisite",
      key: "en.diag.a1.known-prerequisite.001",
      primaryCompetencyId: "competency-1",
      primaryCompetencyKey: "en.a1.known-prerequisite",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
    });
    const coveredPrerequisiteCandidate = buildQuestionBankItem({
      id: "item-covered-prerequisite-candidate",
      key: "en.diag.a2.aaa-covered-prerequisite.001",
      primaryCompetencyId: "competency-2",
      primaryCompetencyKey: "en.a2.covered-prerequisite-candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
      prerequisites: [
        {
          competencyId: "competency-1",
          competencyKey: "en.a1.known-prerequisite",
          strength: 90,
        },
      ],
    });
    const unknownPrerequisiteCandidate = buildQuestionBankItem({
      id: "item-unknown-prerequisite-candidate",
      key: "en.diag.a2.zzz-unknown-prerequisite.001",
      primaryCompetencyId: "competency-3",
      primaryCompetencyKey: "en.a2.unknown-prerequisite-candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
      prerequisites: [
        {
          competencyId: "competency-4",
          competencyKey: "en.a1.unknown-prerequisite",
          strength: 90,
        },
      ],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        knownPrerequisiteItem,
        coveredPrerequisiteCandidate,
        unknownPrerequisiteCandidate,
      ]),
      attemptItems: [
        buildAttemptItem({
          id: "attempt-item-1",
          diagnosticItemId: knownPrerequisiteItem.id,
          position: 1,
          score: 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
        }),
      ],
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(unknownPrerequisiteCandidate.id);
  });

  it("caps total repair selections", () => {
    const answeredRepairItem = buildQuestionBankItem({
      id: "item-answered-repair",
      key: "en.diag.a1.answered-repair.001",
      primaryCompetencyId: "competency-1",
      primaryCompetencyKey: "en.a1.answered-repair",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const repairCandidate = buildQuestionBankItem({
      id: "item-repair-candidate",
      key: "en.diag.a1.aaa-repair-candidate.001",
      primaryCompetencyId: "competency-2",
      primaryCompetencyKey: "en.a1.repair-candidate",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const foundationCandidate = buildQuestionBankItem({
      id: "item-foundation-candidate",
      key: "en.diag.a1.zzz-foundation-candidate.001",
      primaryCompetencyId: "competency-3",
      primaryCompetencyKey: "en.a1.foundation-candidate",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["foundation"],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        answeredRepairItem,
        repairCandidate,
        foundationCandidate,
      ]),
      attemptItems: [
        buildAttemptItem({
          id: "attempt-item-1",
          diagnosticItemId: answeredRepairItem.id,
          position: 1,
          score: 0,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
          selectedForRole: "repair",
        }),
      ],
      policy: {
        ...initialDiagnosticSelectionPolicy,
        config: {
          ...initialDiagnosticSelectionPolicy.config,
          maxRepairItems: 1,
        },
      },
      goals: [],
    });

    expect(selection?.item.id).toBe(foundationCandidate.id);
  });

  it("caps repair selections per primary competency", () => {
    const answeredRepairItem = buildQuestionBankItem({
      id: "item-answered-repair",
      key: "en.diag.a1.answered-repair.001",
      primaryCompetencyId: "competency-1",
      primaryCompetencyKey: "en.a1.repair",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const sameCompetencyRepairCandidate = buildQuestionBankItem({
      id: "item-same-competency-repair",
      key: "en.diag.a1.aaa-same-competency-repair.001",
      primaryCompetencyId: "competency-1",
      primaryCompetencyKey: "en.a1.repair",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const foundationCandidate = buildQuestionBankItem({
      id: "item-foundation-candidate",
      key: "en.diag.a1.zzz-foundation-candidate.001",
      primaryCompetencyId: "competency-2",
      primaryCompetencyKey: "en.a1.foundation",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["foundation"],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        answeredRepairItem,
        sameCompetencyRepairCandidate,
        foundationCandidate,
      ]),
      attemptItems: [
        buildAttemptItem({
          id: "attempt-item-1",
          diagnosticItemId: answeredRepairItem.id,
          position: 1,
          score: 0,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
          selectedForRole: "repair",
        }),
      ],
      policy: {
        ...initialDiagnosticSelectionPolicy,
        config: {
          ...initialDiagnosticSelectionPolicy.config,
          maxRepairItemsPerCompetency: 1,
        },
      },
      goals: [],
    });

    expect(selection?.item.id).toBe(foundationCandidate.id);
  });

  it("does not immediately drill repair after a first higher-band miss when another A2 region is available", () => {
    const missedA2Item = buildQuestionBankItem({
      id: "item-missed-a2",
      key: "en.diag.a2.missed.001",
      primaryCompetencyId: "competency-1",
      primaryCompetencyKey: "en.a2.missed",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
      diagnosticRoles: ["ceiling"],
    });
    const repairCandidate = buildQuestionBankItem({
      id: "item-repair",
      key: "en.diag.a1.aaa-repair.001",
      primaryCompetencyId: "competency-2",
      primaryCompetencyKey: "en.a1.repair",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
      diagnosticRoles: ["repair"],
    });
    const otherA2Candidate = buildQuestionBankItem({
      id: "item-other-a2",
      key: "en.diag.a2.zzz-other-region.001",
      primaryCompetencyId: "competency-3",
      primaryCompetencyKey: "en.a2.other-region",
      family: "situational",
      mode: "reading",
      difficultyBand: "A2",
      diagnosticRoles: ["ceiling"],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        missedA2Item,
        repairCandidate,
        otherA2Candidate,
      ]),
      attemptItems: [
        buildAttemptItem({
          id: "attempt-item-1",
          diagnosticItemId: missedA2Item.id,
          position: 1,
          score: 0,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
          selectedForRole: "ceiling",
        }),
      ],
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(otherA2Candidate.id);
  });

  it("uses goal priority as a deterministic close-call bonus", () => {
    const lowerGoalCandidate = buildQuestionBankItem({
      id: "item-lower-goal",
      key: "en.diag.a1.aaa-lower-goal.001",
      primaryCompetencyId: "competency-1",
      primaryCompetencyKey: "en.a1.lower-goal",
      family: "grammar",
      mode: "reading",
      goalPriorities: [{ goal: "travel", priority: 10 }],
    });
    const higherGoalCandidate = buildQuestionBankItem({
      id: "item-higher-goal",
      key: "en.diag.a1.zzz-higher-goal.001",
      primaryCompetencyId: "competency-2",
      primaryCompetencyKey: "en.a1.higher-goal",
      family: "grammar",
      mode: "reading",
      goalPriorities: [{ goal: "travel", priority: 100 }],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        lowerGoalCandidate,
        higherGoalCandidate,
      ]),
      attemptItems: [],
      policy: initialDiagnosticSelectionPolicy,
      goals: ["travel"],
    });

    expect(selection?.item.id).toBe(higherGoalCandidate.id);
  });

  it("keeps goal priority secondary to broad information gain", () => {
    const answeredItem = buildQuestionBankItem({
      id: "item-answered",
      key: "en.diag.a1.answered.001",
      primaryCompetencyId: "competency-1",
      primaryCompetencyKey: "en.a1.answered",
      family: "grammar",
      mode: "reading",
    });
    const repeatedGoalCandidate = buildQuestionBankItem({
      id: "item-repeated-goal",
      key: "en.diag.a1.aaa-repeated-goal.001",
      primaryCompetencyId: "competency-1",
      primaryCompetencyKey: "en.a1.answered",
      family: "grammar",
      mode: "reading",
      goalPriorities: [{ goal: "travel", priority: 100 }],
    });
    const newInformationCandidate = buildQuestionBankItem({
      id: "item-new-information",
      key: "en.diag.a1.zzz-new-information.001",
      primaryCompetencyId: "competency-2",
      primaryCompetencyKey: "en.a1.new-information",
      family: "grammar",
      mode: "reading",
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        answeredItem,
        repeatedGoalCandidate,
        newInformationCandidate,
      ]),
      attemptItems: [
        buildAttemptItem({
          id: "attempt-item-1",
          diagnosticItemId: answeredItem.id,
          position: 1,
          score: 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
        }),
      ],
      policy: initialDiagnosticSelectionPolicy,
      goals: ["travel"],
    });

    expect(selection?.item.id).toBe(newInformationCandidate.id);
  });

  it("uses family and mode diversity to break similar information-gain ties", () => {
    const answeredItem = buildQuestionBankItem({
      id: "item-answered",
      key: "en.diag.a1.answered.001",
      primaryCompetencyId: "competency-1",
      primaryCompetencyKey: "en.a1.answered",
      family: "grammar",
      mode: "reading",
    });
    const repeatedFamilyCandidate = buildQuestionBankItem({
      id: "item-repeated-family",
      key: "en.diag.a1.aaa-repeated-family.001",
      primaryCompetencyId: "competency-2",
      primaryCompetencyKey: "en.a1.repeated-family",
      family: "grammar",
      mode: "reading",
    });
    const diverseCandidate = buildQuestionBankItem({
      id: "item-diverse",
      key: "en.diag.a1.zzz-diverse.001",
      primaryCompetencyId: "competency-3",
      primaryCompetencyKey: "en.a1.diverse",
      family: "situational",
      mode: "listening",
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        answeredItem,
        repeatedFamilyCandidate,
        diverseCandidate,
      ]),
      attemptItems: [
        buildAttemptItem({
          id: "attempt-item-1",
          diagnosticItemId: answeredItem.id,
          position: 1,
          score: 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
        }),
      ],
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(diverseCandidate.id);
  });
});

function buildQuestionBank(
  items: DiagnosticQuestionBankItem[],
): DiagnosticQuestionBank {
  return {
    catalog: {
      id: "catalog-1",
      targetLanguage: "en",
      version: "2026.06.en.mvp",
      status: "published",
      publishedAt: new Date("2026-06-28T12:00:00.000Z"),
    },
    items,
  };
}

function buildQuestionBankItem(input: {
  id: string;
  key: string;
  primaryCompetencyId: string;
  primaryCompetencyKey: string;
  family: string;
  mode: string | null;
  difficultyBand?: string;
  diagnosticRoles?: [
    "foundation" | "ceiling" | "repair" | "confidence" | "goal_probe",
  ];
  prerequisites?: Array<{
    competencyId: string;
    competencyKey: string;
    strength: number | null;
  }>;
  goalPriorities?: Array<{ goal: string; priority: number }>;
}): DiagnosticQuestionBankItem {
  return {
    id: input.id,
    key: input.key,
    primaryCompetencyId: input.primaryCompetencyId,
    primaryCompetencyKey: input.primaryCompetencyKey,
    primaryCompetency: {
      id: input.primaryCompetencyId,
      key: input.primaryCompetencyKey,
      family: input.family,
      mode: input.mode,
      difficultyBand: input.difficultyBand ?? "A1",
      isCore: true,
      prerequisites: input.prerequisites ?? [],
      goalPriorities: input.goalPriorities ?? [],
    },
    difficultyBand: input.difficultyBand ?? "A1",
    responseFormat: "multiple_choice",
    status: "published",
    prompt: {
      schemaVersion: 1,
      kind: "multiple_choice",
      instructionLocalizations: {
        en: "Choose the best answer.",
      },
      contentLanguage: "en",
      stem: "Choose.",
      options: [
        { id: "option_a", text: "A" },
        { id: "option_b", text: "B" },
      ],
    },
    scoringRule: {
      schemaVersion: 1,
      kind: "multiple_choice",
      maxScore: 1,
      passingScore: 1,
      evidenceConfidence: 0.8,
      correctOptionIds: ["option_a"],
      distractors: {},
    },
    details: {
      schemaVersion: 1,
      diagnosticRoles: input.diagnosticRoles ?? ["foundation"],
      rationale: "Selector fixture.",
      safetyNotes: [],
      localizationNotes: [],
      distractorRationale: {},
    },
    reviewedAt: new Date("2026-06-28T11:00:00.000Z"),
    publishedAt: new Date("2026-06-28T12:00:00.000Z"),
    targets: [
      {
        competencyId: input.primaryCompetencyId,
        competencyKey: input.primaryCompetencyKey,
        role: "primary",
        weight: 100,
        details: { schemaVersion: 1 },
      },
    ],
  };
}

function buildAttemptItem(input: {
  id: string;
  diagnosticItemId: string;
  position: number;
  score: number | null;
  confidence: number | null;
  answeredAt: Date | null;
  selectedForRole?: string;
}): DiagnosticAttemptItem {
  return {
    id: input.id,
    attemptId: "attempt-1",
    diagnosticItemId: input.diagnosticItemId,
    position: input.position,
    selectedForRole: input.selectedForRole ?? "foundation",
    selectionRule: "initial-diagnostic-selection-v1",
    selectionTrace: { schemaVersion: 1 },
    response: input.answeredAt
      ? { schemaVersion: 1, kind: "multiple_choice" }
      : null,
    score: input.score,
    confidence: input.confidence,
    shownAt: new Date("2026-06-28T12:00:00.000Z"),
    answeredAt: input.answeredAt,
    details: {},
  };
}
