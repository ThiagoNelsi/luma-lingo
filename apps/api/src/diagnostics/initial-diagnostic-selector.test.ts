import { describe, expect, it } from "vitest";

import type { DiagnosticAttemptItem } from "./diagnostic-attempt.js";
import type {
  DiagnosticQuestionBank,
  DiagnosticQuestionBankItem,
} from "./diagnostic-question-bank.js";
import { selectNextInitialDiagnosticItem } from "./initial-diagnostic-selector.js";
import { initialDiagnosticSelectionPolicy } from "./initial-diagnostic-policy.js";

describe("selectNextInitialDiagnosticItem", () => {
  it("uses a concept primary target when limiting repeated diagnostic targets", () => {
    const answeredConceptItem: DiagnosticQuestionBankItem = {
      ...buildQuestionBankItem({
        id: "item-concept-answered",
        key: "en.diag.a1.concept.answered.001",
        primaryCompetencyId: "placeholder-competency",
        primaryCompetencyKey: "en.a1.placeholder",
        family: "grammar",
        mode: "reading",
      }),
      primaryCompetencyId: null,
      primaryCompetencyKey: null,
      primaryConceptId: "concept-1",
      primaryConceptKey: "form.synthetic.subject_pronoun",
      primaryCompetency: undefined,
      targets: [],
    };
    const repeatedConceptItem: DiagnosticQuestionBankItem = {
      ...answeredConceptItem,
      id: "item-concept-repeat",
      key: "en.diag.a1.concept.repeat.001",
    };
    const competencyItem = buildQuestionBankItem({
      id: "item-competency-new",
      key: "en.diag.a1.competency.new.001",
      primaryCompetencyId: "competency-2",
      primaryCompetencyKey: "en.a1.new",
      family: "grammar",
      mode: "reading",
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        answeredConceptItem,
        repeatedConceptItem,
        competencyItem,
      ]),
      attemptItems: [
        buildAttemptItem({
          id: "attempt-item-1",
          diagnosticItemId: answeredConceptItem.id,
          position: 1,
          score: 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
        }),
      ],
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(competencyItem.id);
  });

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

  it("prefers a question that directly observes more unknown component evidence", () => {
    const isolatedItem = buildQuestionBankItem({
      id: "item-isolated",
      key: "en.diag.a1.aaa-isolated.001",
      primaryCompetencyId: "competency-isolated",
      primaryCompetencyKey: "en.a1.isolated",
      family: "grammar",
      mode: "reading",
      evidenceMappings: [
        {
          conceptId: "concept-isolated",
          conceptKey: "form.synthetic.isolated",
          capability: "recognition",
          strength: 100,
        },
      ],
    });
    const componentHubItem = buildQuestionBankItem({
      id: "item-component-hub",
      key: "en.diag.a1.zzz-component-hub.001",
      primaryCompetencyId: "competency-component-hub",
      primaryCompetencyKey: "en.a1.component-hub",
      family: "grammar",
      mode: "reading",
      evidenceMappings: [
        {
          conceptId: "concept-form",
          conceptKey: "form.synthetic.be_present",
          capability: "recognition",
          strength: 100,
        },
        {
          conceptId: "concept-meaning",
          conceptKey: "meaning.synthetic.be_present",
          capability: "recognition",
          strength: 100,
        },
        {
          conceptId: "concept-use",
          conceptKey: "function.synthetic.be_present",
          capability: "controlled_production",
          strength: 100,
        },
      ],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([isolatedItem, componentHubItem]),
      attemptItems: [],
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(componentHubItem.id);
  });

  it("devalues direct concept evidence already observed at the same capability", () => {
    const answeredItem = buildQuestionBankItem({
      id: "item-answered",
      key: "en.diag.a1.answered.001",
      primaryCompetencyId: "competency-answered",
      primaryCompetencyKey: "en.a1.answered",
      family: "grammar",
      mode: "reading",
      evidenceMappings: [
        {
          conceptId: "concept-covered",
          conceptKey: "form.synthetic.covered",
          capability: "recognition",
          strength: 100,
        },
      ],
    });
    const coveredCandidate = buildQuestionBankItem({
      id: "item-covered",
      key: "en.diag.a1.aaa-covered.001",
      primaryCompetencyId: "competency-covered",
      primaryCompetencyKey: "en.a1.covered",
      family: "grammar",
      mode: "reading",
      evidenceMappings: answeredItem.evidenceMappings,
    });
    const novelCandidate = buildQuestionBankItem({
      id: "item-novel",
      key: "en.diag.a1.zzz-novel.001",
      primaryCompetencyId: "competency-novel",
      primaryCompetencyKey: "en.a1.novel",
      family: "grammar",
      mode: "reading",
      evidenceMappings: [
        {
          conceptId: "concept-novel",
          conceptKey: "form.synthetic.novel",
          capability: "recognition",
          strength: 100,
        },
      ],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        answeredItem,
        coveredCandidate,
        novelCandidate,
      ]),
      attemptItems: buildAttemptItemsFor([answeredItem]),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(novelCandidate.id);
  });

  it("gives a larger inferred-information bonus to higher assumed capabilities", () => {
    const recognitionAssumptionItem = buildQuestionBankItem({
      id: "item-recognition-assumption",
      key: "en.diag.a1.aaa-recognition-assumption.001",
      primaryCompetencyId: "competency-recognition-assumption",
      primaryCompetencyKey: "en.a1.recognition-assumption",
      family: "grammar",
      mode: "reading",
      assumedConcepts: [
        {
          conceptId: "concept-assumed-recognition",
          conceptKey: "form.synthetic.assumed_recognition",
          requiredCapability: "recognition",
        },
      ],
    });
    const independentUseAssumptionItem = buildQuestionBankItem({
      id: "item-independent-use-assumption",
      key: "en.diag.a1.zzz-independent-use-assumption.001",
      primaryCompetencyId: "competency-independent-use-assumption",
      primaryCompetencyKey: "en.a1.independent-use-assumption",
      family: "grammar",
      mode: "reading",
      assumedConcepts: [
        {
          conceptId: "concept-assumed-independent-use",
          conceptKey: "form.synthetic.assumed_independent_use",
          requiredCapability: "independent_use",
        },
      ],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        recognitionAssumptionItem,
        independentUseAssumptionItem,
      ]),
      attemptItems: [],
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(independentUseAssumptionItem.id);
  });

  it("does not advance from Pre-A1 before reaching the Pre-A1 success balance", () => {
    const answeredPreA1Item = buildQuestionBankItem({
      id: "item-pre-a1-answered",
      key: "en.diag.pre-a1.answered.001",
      primaryCompetencyId: "competency-pre-a1-answered",
      primaryCompetencyKey: "en.pre-a1.answered",
      family: "grammar",
      mode: "reading",
      difficultyBand: "Pre-A1",
    });
    const preA1Candidate = buildQuestionBankItem({
      id: "item-pre-a1-candidate",
      key: "en.diag.pre-a1.zzz-candidate.001",
      primaryCompetencyId: "competency-pre-a1-candidate",
      primaryCompetencyKey: "en.pre-a1.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "Pre-A1",
    });
    const a1CeilingCandidate = buildQuestionBankItem({
      id: "item-a1-ceiling",
      key: "en.diag.a1.aaa-ceiling.001",
      primaryCompetencyId: "competency-a1-ceiling",
      primaryCompetencyKey: "en.a1.ceiling",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
      diagnosticRoles: ["ceiling"],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        answeredPreA1Item,
        preA1Candidate,
        a1CeilingCandidate,
      ]),
      attemptItems: [
        buildAttemptItem({
          id: "attempt-item-1",
          diagnosticItemId: answeredPreA1Item.id,
          position: 1,
          score: 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
        }),
      ],
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(preA1Candidate.id);
    expect(selection?.selectionTrace).toMatchObject({
      targetLevel: "Pre-A1",
    });
  });

  it("does not advance from A1 before reaching the A1 success balance", () => {
    const answeredA1Item = buildQuestionBankItem({
      id: "item-a1-answered",
      key: "en.diag.a1.answered.001",
      primaryCompetencyId: "competency-a1-answered",
      primaryCompetencyKey: "en.a1.answered",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
    });
    const a1Candidate = buildQuestionBankItem({
      id: "item-a1-candidate",
      key: "en.diag.a1.zzz-candidate.001",
      primaryCompetencyId: "competency-a1-candidate",
      primaryCompetencyKey: "en.a1.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
    });
    const a2CeilingCandidate = buildQuestionBankItem({
      id: "item-a2-ceiling",
      key: "en.diag.a2.aaa-ceiling.001",
      primaryCompetencyId: "competency-a2-ceiling",
      primaryCompetencyKey: "en.a2.ceiling",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
      diagnosticRoles: ["ceiling"],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        answeredA1Item,
        a1Candidate,
        a2CeilingCandidate,
      ]),
      attemptItems: [
        buildAttemptItem({
          id: "attempt-item-1",
          diagnosticItemId: answeredA1Item.id,
          position: 1,
          score: 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
        }),
      ],
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(a1Candidate.id);
    expect(selection?.selectionTrace).toMatchObject({
      targetLevel: "A1",
    });
  });

  it("does not select ceiling roles below A2", () => {
    const answeredA1Item = buildQuestionBankItem({
      id: "item-a1-answered",
      key: "en.diag.a1.answered.001",
      primaryCompetencyId: "competency-a1-answered",
      primaryCompetencyKey: "en.a1.answered",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
    });
    const a1FoundationCandidate = buildQuestionBankItem({
      id: "item-a1-foundation",
      key: "en.diag.a1.zzz-foundation.001",
      primaryCompetencyId: "competency-a1-foundation",
      primaryCompetencyKey: "en.a1.foundation",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
      diagnosticRoles: ["foundation"],
    });
    const a1CeilingCandidate = buildQuestionBankItem({
      id: "item-a1-ceiling",
      key: "en.diag.a1.aaa-ceiling.001",
      primaryCompetencyId: "competency-a1-ceiling",
      primaryCompetencyKey: "en.a1.ceiling",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
      diagnosticRoles: ["ceiling"],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        answeredA1Item,
        a1FoundationCandidate,
        a1CeilingCandidate,
      ]),
      attemptItems: [
        buildAttemptItem({
          id: "attempt-item-1",
          diagnosticItemId: answeredA1Item.id,
          position: 1,
          score: 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
        }),
      ],
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(a1FoundationCandidate.id);
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

  it("prefers higher-band items with unknown direct concept coverage", () => {
    const knownPrerequisiteItem = buildQuestionBankItem({
      id: "item-known-prerequisite",
      key: "en.diag.a1.known-prerequisite.001",
      primaryCompetencyId: "competency-1",
      primaryCompetencyKey: "en.a1.known-prerequisite",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
      evidenceMappings: [
        {
          conceptId: "concept-covered",
          conceptKey: "form.synthetic.covered",
          capability: "recognition",
          strength: 100,
        },
      ],
    });
    const a1ProgressItemA = buildQuestionBankItem({
      id: "item-a1-progress-a",
      key: "en.diag.a1.progress-a.001",
      primaryCompetencyId: "competency-a1-progress-a",
      primaryCompetencyKey: "en.a1.progress-a",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
    });
    const a1ProgressItemB = buildQuestionBankItem({
      id: "item-a1-progress-b",
      key: "en.diag.a1.progress-b.001",
      primaryCompetencyId: "competency-a1-progress-b",
      primaryCompetencyKey: "en.a1.progress-b",
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
      evidenceMappings: [
        {
          conceptId: "concept-covered",
          conceptKey: "form.synthetic.covered",
          capability: "recognition",
          strength: 100,
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
      evidenceMappings: [
        {
          conceptId: "concept-unknown",
          conceptKey: "form.synthetic.unknown",
          capability: "recognition",
          strength: 100,
        },
      ],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        knownPrerequisiteItem,
        a1ProgressItemA,
        a1ProgressItemB,
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
        buildAttemptItem({
          id: "attempt-item-2",
          diagnosticItemId: a1ProgressItemA.id,
          position: 2,
          score: 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:02:00.000Z"),
        }),
        buildAttemptItem({
          id: "attempt-item-3",
          diagnosticItemId: a1ProgressItemB.id,
          position: 3,
          score: 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:03:00.000Z"),
        }),
      ],
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(unknownPrerequisiteCandidate.id);
  });

  it("starts with foundation before ceiling even when ceiling covers prerequisites", () => {
    const ceilingCandidate = buildQuestionBankItem({
      id: "item-ceiling",
      key: "en.diag.a2.aaa-ceiling.001",
      primaryCompetencyId: "competency-1",
      primaryCompetencyKey: "en.a2.ceiling",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
      diagnosticRoles: ["ceiling"],
      prerequisites: [
        {
          competencyId: "competency-2",
          competencyKey: "en.a1.unknown-prerequisite-a",
          strength: 90,
        },
        {
          competencyId: "competency-3",
          competencyKey: "en.a1.unknown-prerequisite-b",
          strength: 90,
        },
      ],
    });
    const foundationCandidate = buildQuestionBankItem({
      id: "item-foundation",
      key: "en.diag.a1.zzz-foundation.001",
      primaryCompetencyId: "competency-4",
      primaryCompetencyKey: "en.a1.foundation",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["foundation"],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([ceilingCandidate, foundationCandidate]),
      attemptItems: [],
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(foundationCandidate.id);
    expect(selection?.selectedForRole).toBe("foundation");
    expect(selection?.selectionTrace).toMatchObject({
      selectedScoreBreakdown: {
        selectedForRole: "foundation",
      },
    });
  });

  it("unlocks ceiling after a strong correct answer while preserving prerequisite value", () => {
    const answeredFoundationItem = buildQuestionBankItem({
      id: "item-answered-foundation",
      key: "en.diag.a1.answered-foundation.001",
      primaryCompetencyId: "competency-1",
      primaryCompetencyKey: "en.a1.answered-foundation",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["foundation"],
    });
    const answeredFoundationItemA = buildQuestionBankItem({
      id: "item-answered-foundation-a",
      key: "en.diag.a1.answered-foundation-a.001",
      primaryCompetencyId: "competency-answered-foundation-a",
      primaryCompetencyKey: "en.a1.answered-foundation-a",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["foundation"],
    });
    const answeredFoundationItemB = buildQuestionBankItem({
      id: "item-answered-foundation-b",
      key: "en.diag.a1.answered-foundation-b.001",
      primaryCompetencyId: "competency-answered-foundation-b",
      primaryCompetencyKey: "en.a1.answered-foundation-b",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["foundation"],
    });
    const foundationCandidate = buildQuestionBankItem({
      id: "item-foundation",
      key: "en.diag.a1.aaa-foundation.001",
      primaryCompetencyId: "competency-2",
      primaryCompetencyKey: "en.a1.foundation",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["foundation"],
    });
    const ceilingCandidate = buildQuestionBankItem({
      id: "item-ceiling",
      key: "en.diag.a2.zzz-ceiling.001",
      primaryCompetencyId: "competency-3",
      primaryCompetencyKey: "en.a2.ceiling",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
      diagnosticRoles: ["ceiling"],
      prerequisites: [
        {
          competencyId: "competency-4",
          competencyKey: "en.a1.unknown-prerequisite-a",
          strength: 90,
        },
        {
          competencyId: "competency-5",
          competencyKey: "en.a1.unknown-prerequisite-b",
          strength: 90,
        },
      ],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        answeredFoundationItem,
        answeredFoundationItemA,
        answeredFoundationItemB,
        foundationCandidate,
        ceilingCandidate,
      ]),
      attemptItems: [
        buildAttemptItem({
          id: "attempt-item-1",
          diagnosticItemId: answeredFoundationItem.id,
          position: 1,
          score: 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
          selectedForRole: "foundation",
        }),
        buildAttemptItem({
          id: "attempt-item-2",
          diagnosticItemId: answeredFoundationItemA.id,
          position: 2,
          score: 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:02:00.000Z"),
          selectedForRole: "foundation",
        }),
        buildAttemptItem({
          id: "attempt-item-3",
          diagnosticItemId: answeredFoundationItemB.id,
          position: 3,
          score: 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:03:00.000Z"),
          selectedForRole: "foundation",
        }),
      ],
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(ceilingCandidate.id);
    expect(selection?.selectedForRole).toBe("ceiling");
  });

  it("advances the target level after the current level reaches its success balance", () => {
    const answeredItems = [
      buildQuestionBankItem({
        id: "item-a1-1",
        key: "en.diag.a1.answered-1.001",
        primaryCompetencyId: "competency-a1-1",
        primaryCompetencyKey: "en.a1.answered-1",
        family: "grammar",
        mode: "reading",
        difficultyBand: "A1",
      }),
      buildQuestionBankItem({
        id: "item-a1-2",
        key: "en.diag.a1.answered-2.001",
        primaryCompetencyId: "competency-a1-2",
        primaryCompetencyKey: "en.a1.answered-2",
        family: "grammar",
        mode: "reading",
        difficultyBand: "A1",
      }),
      buildQuestionBankItem({
        id: "item-a1-3",
        key: "en.diag.a1.answered-3.001",
        primaryCompetencyId: "competency-a1-3",
        primaryCompetencyKey: "en.a1.answered-3",
        family: "grammar",
        mode: "reading",
        difficultyBand: "A1",
      }),
    ];
    const a1Candidate = buildQuestionBankItem({
      id: "item-a1-candidate",
      key: "en.diag.a1.aaa-candidate.001",
      primaryCompetencyId: "competency-a1-candidate",
      primaryCompetencyKey: "en.a1.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
    });
    const a2Candidate = buildQuestionBankItem({
      id: "item-a2-candidate",
      key: "en.diag.a2.zzz-candidate.001",
      primaryCompetencyId: "competency-a2-candidate",
      primaryCompetencyKey: "en.a2.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        ...answeredItems,
        a1Candidate,
        a2Candidate,
      ]),
      attemptItems: answeredItems.map((item, index) =>
        buildAttemptItem({
          id: `attempt-item-${index + 1}`,
          diagnosticItemId: item.id,
          position: index + 1,
          score: 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
        }),
      ),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(a2Candidate.id);
    expect(selection?.selectionTrace).toMatchObject({
      targetLevel: "A2",
    });
  });

  it("counts correct lower-confidence answers toward level advancement", () => {
    const answeredItems = [
      buildQuestionBankItem({
        id: "item-a1-low-confidence-1",
        key: "en.diag.a1.low-confidence-1.001",
        primaryCompetencyId: "competency-a1-low-confidence-1",
        primaryCompetencyKey: "en.a1.low-confidence-1",
        family: "grammar",
        mode: "reading",
        difficultyBand: "A1",
      }),
      buildQuestionBankItem({
        id: "item-a1-low-confidence-2",
        key: "en.diag.a1.low-confidence-2.001",
        primaryCompetencyId: "competency-a1-low-confidence-2",
        primaryCompetencyKey: "en.a1.low-confidence-2",
        family: "grammar",
        mode: "reading",
        difficultyBand: "A1",
      }),
      buildQuestionBankItem({
        id: "item-a1-low-confidence-3",
        key: "en.diag.a1.low-confidence-3.001",
        primaryCompetencyId: "competency-a1-low-confidence-3",
        primaryCompetencyKey: "en.a1.low-confidence-3",
        family: "grammar",
        mode: "reading",
        difficultyBand: "A1",
      }),
    ];
    const a2Candidate = buildQuestionBankItem({
      id: "item-a2-candidate",
      key: "en.diag.a2.candidate.001",
      primaryCompetencyId: "competency-a2-candidate",
      primaryCompetencyKey: "en.a2.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([...answeredItems, a2Candidate]),
      attemptItems: answeredItems.map((item, index) =>
        buildAttemptItem({
          id: `attempt-item-${index + 1}`,
          diagnosticItemId: item.id,
          position: index + 1,
          score: 1,
          confidence: 0.6,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
        }),
      ),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(a2Candidate.id);
    expect(selection?.selectionTrace).toMatchObject({
      targetLevel: "A2",
    });
  });

  it("advances from Pre-A1 to A1 after exactly two Pre-A1 correct answers", () => {
    const answeredItems = [
      buildQuestionBankItem({
        id: "item-pre-a1-1",
        key: "en.diag.pre-a1.answered-1.001",
        primaryCompetencyId: "competency-pre-a1-1",
        primaryCompetencyKey: "en.pre-a1.answered-1",
        family: "grammar",
        mode: "reading",
        difficultyBand: "Pre-A1",
      }),
      buildQuestionBankItem({
        id: "item-pre-a1-2",
        key: "en.diag.pre-a1.answered-2.001",
        primaryCompetencyId: "competency-pre-a1-2",
        primaryCompetencyKey: "en.pre-a1.answered-2",
        family: "grammar",
        mode: "reading",
        difficultyBand: "Pre-A1",
      }),
    ];
    const preA1Candidate = buildQuestionBankItem({
      id: "item-pre-a1-candidate",
      key: "en.diag.pre-a1.aaa-candidate.001",
      primaryCompetencyId: "competency-pre-a1-candidate",
      primaryCompetencyKey: "en.pre-a1.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "Pre-A1",
    });
    const a1Candidate = buildQuestionBankItem({
      id: "item-a1-candidate",
      key: "en.diag.a1.zzz-candidate.001",
      primaryCompetencyId: "competency-a1-candidate",
      primaryCompetencyKey: "en.a1.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        ...answeredItems,
        preA1Candidate,
        a1Candidate,
      ]),
      attemptItems: buildAttemptItemsFor(answeredItems, { score: 1 }),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(a1Candidate.id);
    expect(selection?.selectionTrace).toMatchObject({
      targetLevel: "A1",
    });
  });

  it("advances from A2 to B1 after exactly three A2 correct answers", () => {
    const answeredItems = buildFillerQuestionBankItems({
      count: 3,
      idPrefix: "item-a2-answered",
      competencyPrefix: "competency-a2-answered",
      difficultyBand: "A2",
    });
    const a2Candidate = buildQuestionBankItem({
      id: "item-a2-candidate",
      key: "en.diag.a2.aaa-candidate.001",
      primaryCompetencyId: "competency-a2-candidate",
      primaryCompetencyKey: "en.a2.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
    });
    const b1Candidate = buildQuestionBankItem({
      id: "item-b1-candidate",
      key: "en.diag.b1.zzz-candidate.001",
      primaryCompetencyId: "competency-b1-candidate",
      primaryCompetencyKey: "en.b1.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "B1",
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        ...answeredItems,
        a2Candidate,
        b1Candidate,
      ]),
      attemptItems: buildAttemptItemsFor(answeredItems, { score: 1 }),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(b1Candidate.id);
    expect(selection?.selectionTrace).toMatchObject({
      targetLevel: "B1",
    });
  });

  it("advances from B1 to B2 after exactly three B1 correct answers", () => {
    const answeredItems = buildFillerQuestionBankItems({
      count: 3,
      idPrefix: "item-b1-answered",
      competencyPrefix: "competency-b1-answered",
      difficultyBand: "B1",
    });
    const b1Candidate = buildQuestionBankItem({
      id: "item-b1-candidate",
      key: "en.diag.b1.aaa-candidate.001",
      primaryCompetencyId: "competency-b1-candidate",
      primaryCompetencyKey: "en.b1.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "B1",
    });
    const b2Candidate = buildQuestionBankItem({
      id: "item-b2-candidate",
      key: "en.diag.b2.zzz-candidate.001",
      primaryCompetencyId: "competency-b2-candidate",
      primaryCompetencyKey: "en.b2.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "B2",
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        ...answeredItems,
        b1Candidate,
        b2Candidate,
      ]),
      attemptItems: buildAttemptItemsFor(answeredItems, { score: 1 }),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(b2Candidate.id);
    expect(selection?.selectionTrace).toMatchObject({
      targetLevel: "B2",
    });
  });

  it("does not advance beyond B2 after positive B2 balance", () => {
    const answeredItems = buildFillerQuestionBankItems({
      count: 3,
      idPrefix: "item-b2-answered",
      competencyPrefix: "competency-b2-answered",
      difficultyBand: "B2",
    });
    const b2Candidate = buildQuestionBankItem({
      id: "item-b2-candidate",
      key: "en.diag.b2.candidate.001",
      primaryCompetencyId: "competency-b2-candidate",
      primaryCompetencyKey: "en.b2.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "B2",
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([...answeredItems, b2Candidate]),
      attemptItems: buildAttemptItemsFor(answeredItems, { score: 1 }),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(b2Candidate.id);
    expect(selection?.selectionTrace).toMatchObject({
      targetLevel: "B2",
    });
  });

  it("regresses the target level after the current level reaches its miss balance", () => {
    const answeredItems = [
      buildQuestionBankItem({
        id: "item-a2-1",
        key: "en.diag.a2.answered-1.001",
        primaryCompetencyId: "competency-a2-1",
        primaryCompetencyKey: "en.a2.answered-1",
        family: "grammar",
        mode: "reading",
        difficultyBand: "A2",
      }),
      buildQuestionBankItem({
        id: "item-a2-2",
        key: "en.diag.a2.answered-2.001",
        primaryCompetencyId: "competency-a2-2",
        primaryCompetencyKey: "en.a2.answered-2",
        family: "grammar",
        mode: "reading",
        difficultyBand: "A2",
      }),
    ];
    const a2Candidate = buildQuestionBankItem({
      id: "item-a2-candidate",
      key: "en.diag.a2.aaa-candidate.001",
      primaryCompetencyId: "competency-a2-candidate",
      primaryCompetencyKey: "en.a2.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
    });
    const a1Candidate = buildQuestionBankItem({
      id: "item-a1-candidate",
      key: "en.diag.a1.zzz-candidate.001",
      primaryCompetencyId: "competency-a1-candidate",
      primaryCompetencyKey: "en.a1.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        ...answeredItems,
        a2Candidate,
        a1Candidate,
      ]),
      attemptItems: answeredItems.map((item, index) =>
        buildAttemptItem({
          id: `attempt-item-${index + 1}`,
          diagnosticItemId: item.id,
          position: index + 1,
          score: 0,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
        }),
      ),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(a1Candidate.id);
    expect(selection?.selectionTrace).toMatchObject({
      targetLevel: "A1",
    });
  });

  it("regresses from A1 to Pre-A1 after exactly two A1 misses", () => {
    const answeredItems = buildFillerQuestionBankItems({
      count: 2,
      idPrefix: "item-a1-missed",
      competencyPrefix: "competency-a1-missed",
      difficultyBand: "A1",
    });
    const a1Candidate = buildQuestionBankItem({
      id: "item-a1-candidate",
      key: "en.diag.a1.aaa-candidate.001",
      primaryCompetencyId: "competency-a1-candidate",
      primaryCompetencyKey: "en.a1.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
    });
    const preA1Candidate = buildQuestionBankItem({
      id: "item-pre-a1-candidate",
      key: "en.diag.pre-a1.zzz-candidate.001",
      primaryCompetencyId: "competency-pre-a1-candidate",
      primaryCompetencyKey: "en.pre-a1.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "Pre-A1",
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        ...answeredItems,
        a1Candidate,
        preA1Candidate,
      ]),
      attemptItems: buildAttemptItemsFor(answeredItems, { score: 0 }),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(preA1Candidate.id);
    expect(selection?.selectionTrace).toMatchObject({
      targetLevel: "Pre-A1",
    });
  });

  it("regresses from B1 to A2 after exactly two B1 misses", () => {
    const answeredItems = buildFillerQuestionBankItems({
      count: 2,
      idPrefix: "item-b1-missed",
      competencyPrefix: "competency-b1-missed",
      difficultyBand: "B1",
    });
    const b1Candidate = buildQuestionBankItem({
      id: "item-b1-candidate",
      key: "en.diag.b1.aaa-candidate.001",
      primaryCompetencyId: "competency-b1-candidate",
      primaryCompetencyKey: "en.b1.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "B1",
    });
    const a2Candidate = buildQuestionBankItem({
      id: "item-a2-candidate",
      key: "en.diag.a2.zzz-candidate.001",
      primaryCompetencyId: "competency-a2-candidate",
      primaryCompetencyKey: "en.a2.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        ...answeredItems,
        b1Candidate,
        a2Candidate,
      ]),
      attemptItems: buildAttemptItemsFor(answeredItems, { score: 0 }),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(a2Candidate.id);
    expect(selection?.selectionTrace).toMatchObject({
      targetLevel: "A2",
    });
  });

  it("regresses from B2 to B1 after exactly two B2 misses", () => {
    const answeredItems = buildFillerQuestionBankItems({
      count: 2,
      idPrefix: "item-b2-missed",
      competencyPrefix: "competency-b2-missed",
      difficultyBand: "B2",
    });
    const b2Candidate = buildQuestionBankItem({
      id: "item-b2-candidate",
      key: "en.diag.b2.aaa-candidate.001",
      primaryCompetencyId: "competency-b2-candidate",
      primaryCompetencyKey: "en.b2.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "B2",
    });
    const b1Candidate = buildQuestionBankItem({
      id: "item-b1-candidate",
      key: "en.diag.b1.zzz-candidate.001",
      primaryCompetencyId: "competency-b1-candidate",
      primaryCompetencyKey: "en.b1.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "B1",
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        ...answeredItems,
        b2Candidate,
        b1Candidate,
      ]),
      attemptItems: buildAttemptItemsFor(answeredItems, { score: 0 }),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(b1Candidate.id);
    expect(selection?.selectionTrace).toMatchObject({
      targetLevel: "B1",
    });
  });

  it("resets level balance when the learner changes level", () => {
    const a1AnsweredItems = buildFillerQuestionBankItems({
      count: 3,
      idPrefix: "item-a1-answered",
      competencyPrefix: "competency-a1-answered",
      difficultyBand: "A1",
    });
    const a2MissedItem = buildQuestionBankItem({
      id: "item-a2-missed",
      key: "en.diag.a2.missed.001",
      primaryCompetencyId: "competency-a2-missed",
      primaryCompetencyKey: "en.a2.missed",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
    });
    const a1Candidate = buildQuestionBankItem({
      id: "item-a1-candidate",
      key: "en.diag.a1.aaa-candidate.001",
      primaryCompetencyId: "competency-a1-candidate",
      primaryCompetencyKey: "en.a1.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
    });
    const a2Candidate = buildQuestionBankItem({
      id: "item-a2-candidate",
      key: "en.diag.a2.zzz-candidate.001",
      primaryCompetencyId: "competency-a2-candidate",
      primaryCompetencyKey: "en.a2.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
    });
    const answeredItems = [...a1AnsweredItems, a2MissedItem];

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        ...answeredItems,
        a1Candidate,
        a2Candidate,
      ]),
      attemptItems: buildAttemptItemsFor(answeredItems, {
        score: (item) => (item.id === a2MissedItem.id ? 0 : 1),
      }),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(a2Candidate.id);
    expect(selection?.selectionTrace).toMatchObject({
      targetLevel: "A2",
    });
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

  it("caps total repair selections during final validation", () => {
    const previousRepairItem = buildQuestionBankItem({
      id: "item-previous-repair",
      key: "en.diag.a1.previous-repair.001",
      primaryCompetencyId: "competency-previous-repair",
      primaryCompetencyKey: "en.a1.previous-repair",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const missedItem = buildQuestionBankItem({
      id: "item-missed",
      key: "en.diag.a1.missed.001",
      primaryCompetencyId: "competency-missed",
      primaryCompetencyKey: "en.a1.missed",
      family: "grammar",
      mode: "reading",
    });
    const repairCandidate = buildQuestionBankItem({
      id: "item-repair-candidate",
      key: "en.diag.a1.aaa-repair-candidate.001",
      primaryCompetencyId: "competency-missed",
      primaryCompetencyKey: "en.a1.missed",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const fallbackConfidence = buildQuestionBankItem({
      id: "item-fallback-confidence",
      key: "en.diag.a1.zzz-fallback-confidence.001",
      primaryCompetencyId: "competency-fallback-confidence",
      primaryCompetencyKey: "en.a1.fallback-confidence",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["confidence"],
    });
    const fillerItems = buildFillerQuestionBankItems({
      count: 12,
      idPrefix: "item-repair-cap-filler",
      competencyPrefix: "competency-repair-cap-filler",
    });
    const answeredItems = [previousRepairItem, missedItem, ...fillerItems];

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        ...answeredItems,
        repairCandidate,
        fallbackConfidence,
      ]),
      attemptItems: buildAttemptItemsFor(answeredItems, {
        score: (item) => (item.id === missedItem.id ? 0 : 1),
        selectedForRole: (item) =>
          item.id === previousRepairItem.id ? "repair" : "foundation",
      }),
      policy: {
        ...initialDiagnosticSelectionPolicy,
        config: {
          ...initialDiagnosticSelectionPolicy.config,
          maxRepairItems: 1,
        },
      },
      goals: [],
    });

    expect(selection?.item.id).toBe(fallbackConfidence.id);
    expect(selection?.selectedForRole).toBe("confidence");
    expect(selection?.selectionTrace).toMatchObject({
      phase: "final_validation",
    });
  });

  it("caps repair selections per primary competency during final validation", () => {
    const previousRepairItem = buildQuestionBankItem({
      id: "item-previous-repair",
      key: "en.diag.a1.previous-repair.001",
      primaryCompetencyId: "competency-target",
      primaryCompetencyKey: "en.a1.target",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const missedItem = buildQuestionBankItem({
      id: "item-missed",
      key: "en.diag.a1.missed.001",
      primaryCompetencyId: "competency-target",
      primaryCompetencyKey: "en.a1.target",
      family: "grammar",
      mode: "reading",
    });
    const sameCompetencyRepair = buildQuestionBankItem({
      id: "item-same-competency-repair",
      key: "en.diag.a1.aaa-same-competency-repair.001",
      primaryCompetencyId: "competency-target",
      primaryCompetencyKey: "en.a1.target",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const fallbackConfidence = buildQuestionBankItem({
      id: "item-fallback-confidence",
      key: "en.diag.a1.zzz-fallback-confidence.001",
      primaryCompetencyId: "competency-fallback-confidence",
      primaryCompetencyKey: "en.a1.fallback-confidence",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["confidence"],
    });
    const fillerItems = buildFillerQuestionBankItems({
      count: 12,
      idPrefix: "item-repair-competency-cap-filler",
      competencyPrefix: "competency-repair-competency-cap-filler",
    });
    const answeredItems = [previousRepairItem, missedItem, ...fillerItems];

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        ...answeredItems,
        sameCompetencyRepair,
        fallbackConfidence,
      ]),
      attemptItems: buildAttemptItemsFor(answeredItems, {
        score: (item) => (item.id === missedItem.id ? 0 : 1),
        selectedForRole: (item) =>
          item.id === previousRepairItem.id ? "repair" : "foundation",
      }),
      policy: {
        ...initialDiagnosticSelectionPolicy,
        config: {
          ...initialDiagnosticSelectionPolicy.config,
          maxRepairItemsPerCompetency: 1,
        },
      },
      goals: [],
    });

    expect(selection?.item.id).toBe(fallbackConfidence.id);
    expect(selection?.selectedForRole).toBe("confidence");
    expect(selection?.selectionTrace).toMatchObject({
      phase: "final_validation",
    });
  });

  it("defers repair during exploration after a higher-band miss", () => {
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
    expect(selection?.selectedForRole).toBe("ceiling");
  });

  it("uses the final validation phase for the missed competency with the highest impact", () => {
    const lowImpactMiss = buildQuestionBankItem({
      id: "item-low-impact-miss",
      key: "en.diag.a1.low-impact-miss.001",
      primaryCompetencyId: "competency-low-impact",
      primaryCompetencyKey: "en.a1.low-impact",
      family: "grammar",
      mode: "reading",
    });
    const highImpactMiss = buildQuestionBankItem({
      id: "item-high-impact-miss",
      key: "en.diag.a1.high-impact-miss.001",
      primaryCompetencyId: "competency-high-impact",
      primaryCompetencyKey: "en.a1.high-impact",
      family: "grammar",
      mode: "reading",
      evidenceMappings: [
        {
          conceptId: "concept-high-impact-form",
          conceptKey: "form.synthetic.high_impact",
          capability: "recognition",
          strength: 100,
        },
        {
          conceptId: "concept-high-impact-function",
          conceptKey: "function.synthetic.high_impact",
          capability: "controlled_production",
          strength: 100,
        },
      ],
    });
    const lowImpactRepair = buildQuestionBankItem({
      id: "item-low-impact-repair",
      key: "en.diag.a1.aaa-low-impact-repair.001",
      primaryCompetencyId: "competency-low-impact",
      primaryCompetencyKey: "en.a1.low-impact",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const highImpactRepair = buildQuestionBankItem({
      id: "item-high-impact-repair",
      key: "en.diag.a1.zzz-high-impact-repair.001",
      primaryCompetencyId: "competency-high-impact",
      primaryCompetencyKey: "en.a1.high-impact",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const fillerItems = Array.from({ length: 12 }, (_, index) =>
      buildQuestionBankItem({
        id: `item-filler-${index + 1}`,
        key: `en.diag.a1.filler-${String(index + 1).padStart(2, "0")}.001`,
        primaryCompetencyId: `competency-filler-${index + 1}`,
        primaryCompetencyKey: `en.a1.filler-${index + 1}`,
        family: "grammar",
        mode: "reading",
      }),
    );
    const answeredItems = [lowImpactMiss, ...fillerItems, highImpactMiss];

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        ...answeredItems,
        lowImpactRepair,
        highImpactRepair,
      ]),
      attemptItems: answeredItems.map((item, index) =>
        buildAttemptItem({
          id: `attempt-item-${index + 1}`,
          diagnosticItemId: item.id,
          position: index + 1,
          score:
            item.id === lowImpactMiss.id || item.id === highImpactMiss.id
              ? 0
              : 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
        }),
      ),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(highImpactRepair.id);
    expect(selection?.selectedForRole).toBe("repair");
    expect(selection?.selectionTrace).toMatchObject({
      phase: "final_validation",
    });
  });

  it("skips low-confidence correct answers and missed competencies without repair when choosing final repair", () => {
    const highImpactLowConfidenceCorrect = buildQuestionBankItem({
      id: "item-high-impact-low-confidence-correct",
      key: "en.diag.a2.high-impact-low-confidence-correct.001",
      primaryCompetencyId: "competency-high-impact-low-confidence-correct",
      primaryCompetencyKey: "en.a2.high-impact-low-confidence-correct",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
      diagnosticRoles: ["ceiling"],
      prerequisites: [
        {
          competencyId: "prerequisite-1",
          competencyKey: "en.a1.prerequisite-1",
          strength: 90,
        },
        {
          competencyId: "prerequisite-2",
          competencyKey: "en.a1.prerequisite-2",
          strength: 90,
        },
      ],
    });
    const missedWithoutRepair = buildQuestionBankItem({
      id: "item-missed-without-repair",
      key: "en.diag.a2.missed-without-repair.001",
      primaryCompetencyId: "competency-missed-without-repair",
      primaryCompetencyKey: "en.a2.missed-without-repair",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
      prerequisites: [
        {
          competencyId: "prerequisite-3",
          competencyKey: "en.a1.prerequisite-3",
          strength: 90,
        },
      ],
    });
    const missedWithRepair = buildQuestionBankItem({
      id: "item-missed-with-repair",
      key: "en.diag.a2.missed-with-repair.001",
      primaryCompetencyId: "competency-missed-with-repair",
      primaryCompetencyKey: "en.a2.missed-with-repair",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
    });
    const repairCandidate = buildQuestionBankItem({
      id: "item-repair",
      key: "en.diag.a2.repair.001",
      primaryCompetencyId: "competency-missed-with-repair",
      primaryCompetencyKey: "en.a2.missed-with-repair",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
      diagnosticRoles: ["repair"],
    });
    const fallbackConfidence = buildQuestionBankItem({
      id: "item-fallback-confidence",
      key: "en.diag.a2.fallback-confidence.001",
      primaryCompetencyId: "competency-fallback-confidence",
      primaryCompetencyKey: "en.a2.fallback-confidence",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
      diagnosticRoles: ["confidence"],
    });
    const fillerItems = Array.from({ length: 11 }, (_, index) =>
      buildQuestionBankItem({
        id: `item-filler-${index + 1}`,
        key: `en.diag.a2.filler-${String(index + 1).padStart(2, "0")}.001`,
        primaryCompetencyId: `competency-filler-${index + 1}`,
        primaryCompetencyKey: `en.a2.filler-${index + 1}`,
        family: "grammar",
        mode: "reading",
        difficultyBand: "A2",
      }),
    );
    const answeredItems = [
      missedWithRepair,
      missedWithoutRepair,
      ...fillerItems,
      highImpactLowConfidenceCorrect,
    ];

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        ...answeredItems,
        repairCandidate,
        fallbackConfidence,
      ]),
      attemptItems: answeredItems.map((item, index) =>
        buildAttemptItem({
          id: `attempt-item-${index + 1}`,
          diagnosticItemId: item.id,
          position: index + 1,
          score:
            item.id === missedWithRepair.id ||
            item.id === missedWithoutRepair.id
              ? 0
              : 1,
          confidence:
            item.id === highImpactLowConfidenceCorrect.id ? 0.68 : 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
        }),
      ),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(repairCandidate.id);
    expect(selection?.selectedForRole).toBe("repair");
    expect(selection?.selectionTrace).toMatchObject({
      phase: "final_validation",
    });
  });

  it("uses the second final validation item for confidence after a successful repair", () => {
    const missedItem = buildQuestionBankItem({
      id: "item-missed",
      key: "en.diag.a1.missed.001",
      primaryCompetencyId: "competency-target",
      primaryCompetencyKey: "en.a1.target",
      family: "grammar",
      mode: "reading",
    });
    const repairItem = buildQuestionBankItem({
      id: "item-repair",
      key: "en.diag.a1.repair.001",
      primaryCompetencyId: "competency-target",
      primaryCompetencyKey: "en.a1.target",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const confidenceItem = buildQuestionBankItem({
      id: "item-confidence",
      key: "en.diag.a1.confidence.001",
      primaryCompetencyId: "competency-target",
      primaryCompetencyKey: "en.a1.target",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["confidence"],
    });
    const fillerItems = Array.from({ length: 13 }, (_, index) =>
      buildQuestionBankItem({
        id: `item-filler-${index + 1}`,
        key: `en.diag.a1.filler-${String(index + 1).padStart(2, "0")}.001`,
        primaryCompetencyId: `competency-filler-${index + 1}`,
        primaryCompetencyKey: `en.a1.filler-${index + 1}`,
        family: "grammar",
        mode: "reading",
      }),
    );
    const answeredItems = [missedItem, ...fillerItems, repairItem];

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([...answeredItems, confidenceItem]),
      attemptItems: answeredItems.map((item, index) =>
        buildAttemptItem({
          id: `attempt-item-${index + 1}`,
          diagnosticItemId: item.id,
          position: index + 1,
          score: item.id === missedItem.id ? 0 : 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
          selectedForRole: item.id === repairItem.id ? "repair" : "foundation",
        }),
      ),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(confidenceItem.id);
    expect(selection?.selectedForRole).toBe("confidence");
  });

  it("allows confidence after a successful repair even when the repair cap is reached", () => {
    const missedItem = buildQuestionBankItem({
      id: "item-missed",
      key: "en.diag.a1.missed.001",
      primaryCompetencyId: "competency-target",
      primaryCompetencyKey: "en.a1.target",
      family: "grammar",
      mode: "reading",
    });
    const repairItem = buildQuestionBankItem({
      id: "item-repair",
      key: "en.diag.a1.repair.001",
      primaryCompetencyId: "competency-target",
      primaryCompetencyKey: "en.a1.target",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const confidenceItem = buildQuestionBankItem({
      id: "item-confidence",
      key: "en.diag.a1.confidence.001",
      primaryCompetencyId: "competency-target",
      primaryCompetencyKey: "en.a1.target",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["confidence"],
    });
    const fillerItems = buildFillerQuestionBankItems({
      count: 13,
      idPrefix: "item-repair-confidence-filler",
      competencyPrefix: "competency-repair-confidence-filler",
    });
    const answeredItems = [missedItem, ...fillerItems, repairItem];

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([...answeredItems, confidenceItem]),
      attemptItems: buildAttemptItemsFor(answeredItems, {
        score: (item) => (item.id === missedItem.id ? 0 : 1),
        selectedForRole: (item) =>
          item.id === repairItem.id ? "repair" : "foundation",
      }),
      policy: {
        ...initialDiagnosticSelectionPolicy,
        config: {
          ...initialDiagnosticSelectionPolicy.config,
          maxRepairItems: 1,
        },
      },
      goals: [],
    });

    expect(selection?.item.id).toBe(confidenceItem.id);
    expect(selection?.selectedForRole).toBe("confidence");
  });

  it("falls back to confidence in final validation when there are no misses", () => {
    const answeredItems = buildFillerQuestionBankItems({
      count: 14,
      idPrefix: "item-correct",
      competencyPrefix: "competency-correct",
    });
    const repairCandidate = buildQuestionBankItem({
      id: "item-repair-candidate",
      key: "en.diag.a1.aaa-repair-candidate.001",
      primaryCompetencyId: "competency-repair-candidate",
      primaryCompetencyKey: "en.a1.repair-candidate",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const confidenceCandidate = buildQuestionBankItem({
      id: "item-confidence-candidate",
      key: "en.diag.a1.zzz-confidence-candidate.001",
      primaryCompetencyId: "competency-confidence-candidate",
      primaryCompetencyKey: "en.a1.confidence-candidate",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["confidence"],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        ...answeredItems,
        repairCandidate,
        confidenceCandidate,
      ]),
      attemptItems: buildAttemptItemsFor(answeredItems, { score: 1 }),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(confidenceCandidate.id);
    expect(selection?.selectedForRole).toBe("confidence");
    expect(selection?.selectionTrace).toMatchObject({
      phase: "final_validation",
    });
  });

  it("falls back to confidence in final validation when misses have no repair candidate", () => {
    const missedItem = buildQuestionBankItem({
      id: "item-missed",
      key: "en.diag.a1.missed.001",
      primaryCompetencyId: "competency-missed",
      primaryCompetencyKey: "en.a1.missed",
      family: "grammar",
      mode: "reading",
    });
    const fillerItems = buildFillerQuestionBankItems({
      count: 13,
      idPrefix: "item-no-repair-filler",
      competencyPrefix: "competency-no-repair-filler",
    });
    const confidenceCandidate = buildQuestionBankItem({
      id: "item-confidence-candidate",
      key: "en.diag.a1.confidence-candidate.001",
      primaryCompetencyId: "competency-confidence-candidate",
      primaryCompetencyKey: "en.a1.confidence-candidate",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["confidence"],
    });
    const answeredItems = [missedItem, ...fillerItems];

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([...answeredItems, confidenceCandidate]),
      attemptItems: buildAttemptItemsFor(answeredItems, {
        score: (item) => (item.id === missedItem.id ? 0 : 1),
      }),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(confidenceCandidate.id);
    expect(selection?.selectedForRole).toBe("confidence");
    expect(selection?.selectionTrace).toMatchObject({
      phase: "final_validation",
    });
  });

  it("returns null after a successful final repair when no same-competency confidence item is available", () => {
    const missedItem = buildQuestionBankItem({
      id: "item-missed",
      key: "en.diag.a1.missed.001",
      primaryCompetencyId: "competency-target",
      primaryCompetencyKey: "en.a1.target",
      family: "grammar",
      mode: "reading",
    });
    const repairItem = buildQuestionBankItem({
      id: "item-repair",
      key: "en.diag.a1.repair.001",
      primaryCompetencyId: "competency-target",
      primaryCompetencyKey: "en.a1.target",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const otherConfidenceItem = buildQuestionBankItem({
      id: "item-other-confidence",
      key: "en.diag.a1.other-confidence.001",
      primaryCompetencyId: "competency-other",
      primaryCompetencyKey: "en.a1.other",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["confidence"],
    });
    const fillerItems = buildFillerQuestionBankItems({
      count: 13,
      idPrefix: "item-no-confidence-filler",
      competencyPrefix: "competency-no-confidence-filler",
    });
    const answeredItems = [missedItem, ...fillerItems, repairItem];

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([...answeredItems, otherConfidenceItem]),
      attemptItems: buildAttemptItemsFor(answeredItems, {
        score: (item) => (item.id === missedItem.id ? 0 : 1),
        selectedForRole: (item) =>
          item.id === repairItem.id ? "repair" : "foundation",
      }),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection).toBeNull();
  });

  it("ends final validation after a failed final repair", () => {
    const missedItem = buildQuestionBankItem({
      id: "item-missed",
      key: "en.diag.a1.missed.001",
      primaryCompetencyId: "competency-target",
      primaryCompetencyKey: "en.a1.target",
      family: "grammar",
      mode: "reading",
    });
    const repairItem = buildQuestionBankItem({
      id: "item-repair",
      key: "en.diag.a1.repair.001",
      primaryCompetencyId: "competency-target",
      primaryCompetencyKey: "en.a1.target",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const confidenceItem = buildQuestionBankItem({
      id: "item-confidence",
      key: "en.diag.a1.confidence.001",
      primaryCompetencyId: "competency-target",
      primaryCompetencyKey: "en.a1.target",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["confidence"],
    });
    const fillerItems = Array.from({ length: 13 }, (_, index) =>
      buildQuestionBankItem({
        id: `item-filler-${index + 1}`,
        key: `en.diag.a1.filler-${String(index + 1).padStart(2, "0")}.001`,
        primaryCompetencyId: `competency-filler-${index + 1}`,
        primaryCompetencyKey: `en.a1.filler-${index + 1}`,
        family: "grammar",
        mode: "reading",
      }),
    );
    const answeredItems = [missedItem, ...fillerItems, repairItem];

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([...answeredItems, confidenceItem]),
      attemptItems: answeredItems.map((item, index) =>
        buildAttemptItem({
          id: `attempt-item-${index + 1}`,
          diagnosticItemId: item.id,
          position: index + 1,
          score: item.id === missedItem.id || item.id === repairItem.id ? 0 : 1,
          confidence: 0.8,
          answeredAt: new Date("2026-06-28T12:01:00.000Z"),
          selectedForRole: item.id === repairItem.id ? "repair" : "foundation",
        }),
      ),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection).toBeNull();
  });

  it("stays in exploration when finalValidationItems is zero", () => {
    const missedItem = buildQuestionBankItem({
      id: "item-missed",
      key: "en.diag.a1.missed.001",
      primaryCompetencyId: "competency-missed",
      primaryCompetencyKey: "en.a1.missed",
      family: "grammar",
      mode: "reading",
    });
    const fillerItems = buildFillerQuestionBankItems({
      count: 13,
      idPrefix: "item-no-final-validation-filler",
      competencyPrefix: "competency-no-final-validation-filler",
    });
    const repairCandidate = buildQuestionBankItem({
      id: "item-repair-candidate",
      key: "en.diag.a1.aaa-repair-candidate.001",
      primaryCompetencyId: "competency-missed",
      primaryCompetencyKey: "en.a1.missed",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const foundationCandidate = buildQuestionBankItem({
      id: "item-foundation-candidate",
      key: "en.diag.a1.zzz-foundation-candidate.001",
      primaryCompetencyId: "competency-foundation",
      primaryCompetencyKey: "en.a1.foundation",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["foundation"],
    });
    const answeredItems = [missedItem, ...fillerItems];

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        ...answeredItems,
        repairCandidate,
        foundationCandidate,
      ]),
      attemptItems: buildAttemptItemsFor(answeredItems, {
        score: (item) => (item.id === missedItem.id ? 0 : 1),
      }),
      policy: {
        ...initialDiagnosticSelectionPolicy,
        config: {
          ...initialDiagnosticSelectionPolicy.config,
          finalValidationItems: 0,
        },
      },
      goals: [],
    });

    expect(selection?.item.id).toBe(foundationCandidate.id);
    expect(selection?.selectedForRole).toBe("foundation");
    expect(selection?.selectionTrace).toMatchObject({
      phase: "exploration",
    });
  });

  it("enters final validation at a custom explorationItems boundary", () => {
    const missedItem = buildQuestionBankItem({
      id: "item-missed",
      key: "en.diag.a1.missed.001",
      primaryCompetencyId: "competency-missed",
      primaryCompetencyKey: "en.a1.missed",
      family: "grammar",
      mode: "reading",
    });
    const fillerItems = buildFillerQuestionBankItems({
      count: 4,
      idPrefix: "item-custom-exploration-filler",
      competencyPrefix: "competency-custom-exploration-filler",
    });
    const repairCandidate = buildQuestionBankItem({
      id: "item-repair-candidate",
      key: "en.diag.a1.repair-candidate.001",
      primaryCompetencyId: "competency-missed",
      primaryCompetencyKey: "en.a1.missed",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const answeredItems = [missedItem, ...fillerItems];

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([...answeredItems, repairCandidate]),
      attemptItems: buildAttemptItemsFor(answeredItems, {
        score: (item) => (item.id === missedItem.id ? 0 : 1),
      }),
      policy: {
        ...initialDiagnosticSelectionPolicy,
        config: {
          ...initialDiagnosticSelectionPolicy.config,
          explorationItems: 5,
          finalValidationItems: 2,
          maxItems: 16,
        },
      },
      goals: [],
    });

    expect(selection?.item.id).toBe(repairCandidate.id);
    expect(selection?.selectedForRole).toBe("repair");
    expect(selection?.selectionTrace).toMatchObject({
      phase: "final_validation",
    });
  });

  it("enters final validation when maxItems minus finalValidationItems is before explorationItems", () => {
    const missedItem = buildQuestionBankItem({
      id: "item-missed",
      key: "en.diag.a1.missed.001",
      primaryCompetencyId: "competency-missed",
      primaryCompetencyKey: "en.a1.missed",
      family: "grammar",
      mode: "reading",
    });
    const fillerItems = buildFillerQuestionBankItems({
      count: 3,
      idPrefix: "item-custom-max-filler",
      competencyPrefix: "competency-custom-max-filler",
    });
    const repairCandidate = buildQuestionBankItem({
      id: "item-repair-candidate",
      key: "en.diag.a1.repair-candidate.001",
      primaryCompetencyId: "competency-missed",
      primaryCompetencyKey: "en.a1.missed",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["repair"],
    });
    const answeredItems = [missedItem, ...fillerItems];

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([...answeredItems, repairCandidate]),
      attemptItems: buildAttemptItemsFor(answeredItems, {
        score: (item) => (item.id === missedItem.id ? 0 : 1),
      }),
      policy: {
        ...initialDiagnosticSelectionPolicy,
        config: {
          ...initialDiagnosticSelectionPolicy.config,
          explorationItems: 14,
          finalValidationItems: 2,
          maxItems: 6,
        },
      },
      goals: [],
    });

    expect(selection?.item.id).toBe(repairCandidate.id);
    expect(selection?.selectedForRole).toBe("repair");
    expect(selection?.selectionTrace).toMatchObject({
      phase: "final_validation",
    });
  });

  it("falls back on cold start when all candidates are above the initial target level", () => {
    const a1Candidate = buildQuestionBankItem({
      id: "item-a1-candidate",
      key: "en.diag.a1.candidate.001",
      primaryCompetencyId: "competency-a1-candidate",
      primaryCompetencyKey: "en.a1.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
    });
    const a2Candidate = buildQuestionBankItem({
      id: "item-a2-candidate",
      key: "en.diag.a2.candidate.001",
      primaryCompetencyId: "competency-a2-candidate",
      primaryCompetencyKey: "en.a2.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([a1Candidate, a2Candidate]),
      attemptItems: [],
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(a1Candidate.id);
    expect(selection?.selectionTrace).toMatchObject({
      targetLevel: "Pre-A1",
    });
  });

  it("returns null when no candidate matches the target level after cold start", () => {
    const answeredItem = buildQuestionBankItem({
      id: "item-pre-a1-answered",
      key: "en.diag.pre-a1.answered.001",
      primaryCompetencyId: "competency-pre-a1-answered",
      primaryCompetencyKey: "en.pre-a1.answered",
      family: "grammar",
      mode: "reading",
      difficultyBand: "Pre-A1",
    });
    const a1Candidate = buildQuestionBankItem({
      id: "item-a1-candidate",
      key: "en.diag.a1.candidate.001",
      primaryCompetencyId: "competency-a1-candidate",
      primaryCompetencyKey: "en.a1.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
    });
    const a2Candidate = buildQuestionBankItem({
      id: "item-a2-candidate",
      key: "en.diag.a2.candidate.001",
      primaryCompetencyId: "competency-a2-candidate",
      primaryCompetencyKey: "en.a2.candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([answeredItem, a1Candidate, a2Candidate]),
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

    expect(selection).toBeNull();
  });

  it("returns null when every candidate has no selectable role", () => {
    const ceilingBelowA2Candidate = buildQuestionBankItem({
      id: "item-a1-ceiling",
      key: "en.diag.a1.ceiling.001",
      primaryCompetencyId: "competency-a1-ceiling",
      primaryCompetencyKey: "en.a1.ceiling",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A1",
      diagnosticRoles: ["ceiling"],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([ceilingBelowA2Candidate]),
      attemptItems: [],
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection).toBeNull();
  });

  it("returns null when a successful final repair attempt is missing from the question bank", () => {
    const answeredItems = buildFillerQuestionBankItems({
      count: 14,
      idPrefix: "item-missing-final-repair-filler",
      competencyPrefix: "competency-missing-final-repair-filler",
    });
    const attemptItems = [
      ...buildAttemptItemsFor(answeredItems, { score: 1 }),
      buildAttemptItem({
        id: "attempt-item-missing-repair",
        diagnosticItemId: "item-missing-repair",
        position: 15,
        score: 1,
        confidence: 0.8,
        answeredAt: new Date("2026-06-28T12:15:00.000Z"),
        selectedForRole: "repair",
      }),
    ];
    const confidenceCandidate = buildQuestionBankItem({
      id: "item-confidence-candidate",
      key: "en.diag.a1.confidence-candidate.001",
      primaryCompetencyId: "competency-confidence-candidate",
      primaryCompetencyKey: "en.a1.confidence-candidate",
      family: "grammar",
      mode: "reading",
      diagnosticRoles: ["confidence"],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([...answeredItems, confidenceCandidate]),
      attemptItems,
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection).toBeNull();
  });

  it("penalizes consecutive ceilings enough for a similar confidence candidate to win", () => {
    const answeredItems = buildFillerQuestionBankItems({
      count: 3,
      idPrefix: "item-a2-ceiling-answered",
      competencyPrefix: "competency-a2-ceiling-answered",
      difficultyBand: "A2",
    });
    const ceilingCandidate = buildQuestionBankItem({
      id: "item-ceiling-candidate",
      key: "en.diag.a2.aaa-ceiling-candidate.001",
      primaryCompetencyId: "competency-ceiling-candidate",
      primaryCompetencyKey: "en.a2.ceiling-candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
      diagnosticRoles: ["ceiling"],
    });
    const confidenceCandidate = buildQuestionBankItem({
      id: "item-confidence-candidate",
      key: "en.diag.a2.zzz-confidence-candidate.001",
      primaryCompetencyId: "competency-confidence-candidate",
      primaryCompetencyKey: "en.a2.confidence-candidate",
      family: "grammar",
      mode: "reading",
      difficultyBand: "A2",
      diagnosticRoles: ["confidence"],
    });

    const selection = selectNextInitialDiagnosticItem({
      questionBank: buildQuestionBank([
        ...answeredItems,
        ceilingCandidate,
        confidenceCandidate,
      ]),
      attemptItems: buildAttemptItemsFor(answeredItems, {
        score: 1,
        selectedForRole: "ceiling",
      }),
      policy: initialDiagnosticSelectionPolicy,
      goals: [],
    });

    expect(selection?.item.id).toBe(confidenceCandidate.id);
    expect(selection?.selectedForRole).toBe("confidence");
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

function buildFillerQuestionBankItems(input: {
  count: number;
  idPrefix: string;
  competencyPrefix: string;
  difficultyBand?: string;
  family?: string;
  mode?: string | null;
}): DiagnosticQuestionBankItem[] {
  return Array.from({ length: input.count }, (_, index) => {
    const fixtureNumber = String(index + 1).padStart(2, "0");

    return buildQuestionBankItem({
      id: `${input.idPrefix}-${index + 1}`,
      key: `en.diag.fixture.${input.idPrefix}.${fixtureNumber}.001`,
      primaryCompetencyId: `${input.competencyPrefix}-${index + 1}`,
      primaryCompetencyKey: `en.fixture.${input.competencyPrefix}-${index + 1}`,
      family: input.family ?? "grammar",
      mode: input.mode ?? "reading",
      difficultyBand: input.difficultyBand,
    });
  });
}

function buildAttemptItemsFor(
  items: DiagnosticQuestionBankItem[],
  input?: {
    score?:
      number | ((item: DiagnosticQuestionBankItem, index: number) => number);
    confidence?:
      number | ((item: DiagnosticQuestionBankItem, index: number) => number);
    selectedForRole?:
      string | ((item: DiagnosticQuestionBankItem, index: number) => string);
  },
): DiagnosticAttemptItem[] {
  return items.map((item, index) =>
    buildAttemptItem({
      id: `attempt-item-${index + 1}`,
      diagnosticItemId: item.id,
      position: index + 1,
      score:
        typeof input?.score === "function"
          ? input.score(item, index)
          : (input?.score ?? 1),
      confidence:
        typeof input?.confidence === "function"
          ? input.confidence(item, index)
          : (input?.confidence ?? 0.8),
      answeredAt: new Date("2026-06-28T12:01:00.000Z"),
      selectedForRole:
        typeof input?.selectedForRole === "function"
          ? input.selectedForRole(item, index)
          : input?.selectedForRole,
    }),
  );
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
  assumedConcepts?: Array<{
    conceptId: string;
    conceptKey: string;
    requiredCapability:
      | "recognition"
      | "controlled_production"
      | "contextualized_use"
      | "independent_use";
  }>;
  evidenceMappings?: Array<{
    conceptId: string;
    conceptKey: string;
    capability:
      | "recognition"
      | "controlled_production"
      | "contextualized_use"
      | "independent_use";
    strength: number;
  }>;
}): DiagnosticQuestionBankItem {
  return {
    id: input.id,
    key: input.key,
    primaryCompetencyId: input.primaryCompetencyId,
    primaryCompetencyKey: input.primaryCompetencyKey,
    primaryConceptId: null,
    primaryConceptKey: null,
    mode: "reading",
    primaryCompetency: {
      id: input.primaryCompetencyId,
      key: input.primaryCompetencyKey,
      family: input.family,
      mode: input.mode,
      difficultyBand: input.difficultyBand ?? "A1",
      isCore: true,
      prerequisites: input.prerequisites ?? [],
      goalPriorities: input.goalPriorities ?? [],
      assumedConcepts: input.assumedConcepts ?? [],
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
    evidenceMappings: input.evidenceMappings ?? [],
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
