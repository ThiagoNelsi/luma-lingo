import type { DiagnosticAttemptItem } from "./diagnostic-attempt.js";
import type {
  DiagnosticQuestionBank,
  DiagnosticQuestionBankItem,
} from "./diagnostic-question-bank.js";
import type { InitialDiagnosticSelectionPolicy } from "./initial-diagnostic-policy.js";

export interface InitialDiagnosticItemSelection {
  item: DiagnosticQuestionBankItem;
  selectedForRole: string;
  selectionRule: string;
  selectionTrace: Record<string, unknown>;
}

type DiagnosticQuestionRole =
  DiagnosticQuestionBankItem["details"]["diagnosticRoles"][number];

type DiagnosticLevel = "Pre-A1" | "A1" | "A2" | "B1" | "B2";
type SelectionPhase = "exploration" | "final_validation";

type CandidateScore = {
  total: number;
  baseScore: number;
  informationGainScore: number;
  levelFitScore: number;
  roleFitScore: number;
  difficultyFitScore: number;
  selectedForRole: DiagnosticQuestionRole;
};

function primaryTargetId(item: DiagnosticQuestionBankItem): string {
  const targetId = item.primaryCompetencyId ?? item.primaryConceptId;
  if (!targetId) throw new Error("diagnostic_item_primary_target_missing");
  return targetId;
}

export function selectNextInitialDiagnosticItem(input: {
  questionBank: DiagnosticQuestionBank;
  attemptItems: DiagnosticAttemptItem[];
  policy: InitialDiagnosticSelectionPolicy;
  goals: string[];
}): InitialDiagnosticItemSelection | null {
  const answeredItems = input.attemptItems.filter(
    (item) => item.answeredAt !== null,
  );
  if (answeredItems.length >= input.policy.config.maxItems) {
    return null;
  }

  const shownDiagnosticItemIds = new Set(
    input.attemptItems.map((item) => item.diagnosticItemId),
  );
  const primaryTargetCounts = countPrimaryTargetAttempts({
    questionBank: input.questionBank,
    attemptItems: input.attemptItems,
  });
  const repairSelectionCount = input.attemptItems.filter(
    (item) => item.selectedForRole === "repair",
  ).length;
  const repairTargetCounts = countPrimaryTargetAttempts({
    questionBank: input.questionBank,
    attemptItems: input.attemptItems.filter(
      (item) => item.selectedForRole === "repair",
    ),
  });
  const coveredConceptCapabilityKeys = findCoveredConceptCapabilityKeys({
    questionBank: input.questionBank,
    attemptItems: answeredItems,
  });
  const attemptContext = buildAttemptSelectionContext({
    questionBank: input.questionBank,
    answeredItems,
    policy: input.policy,
  });
  const finalValidationStart = finalValidationStartPosition(input.policy);
  const phase =
    answeredItems.length >= finalValidationStart
      ? "final_validation"
      : "exploration";
  const baseSelectionInput = {
    questionBank: input.questionBank,
    shownDiagnosticItemIds,
    primaryTargetCounts,
    repairSelectionCount,
    repairTargetCounts,
    coveredConceptCapabilityKeys,
    attemptContext,
    policy: input.policy,
    goals: input.goals,
  };
  const selected =
    phase === "final_validation"
      ? selectFinalValidationCandidate({
          ...baseSelectionInput,
          attemptItems: input.attemptItems,
        })
      : selectHighestScoringCandidate({
          ...baseSelectionInput,
          phase,
        });

  if (!selected) return null;

  return {
    item: selected.item,
    selectedForRole: selected.score.selectedForRole,
    selectionRule: input.policy.version,
    selectionTrace: {
      schemaVersion: 1,
      candidateCount: selected.candidateCount,
      selectedScore: selected.score.total,
      selectedScoreBreakdown: {
        baseScore: selected.score.baseScore,
        informationGainScore: selected.score.informationGainScore,
        levelFitScore: selected.score.levelFitScore,
        roleFitScore: selected.score.roleFitScore,
        difficultyFitScore: selected.score.difficultyFitScore,
        selectedForRole: selected.score.selectedForRole,
      },
      phase,
      targetLevel: attemptContext.targetLevel,
      tieBreakers: ["score_desc", "item_key_asc", "item_id_asc"],
    },
  };
}

function finalValidationStartPosition(
  policy: InitialDiagnosticSelectionPolicy,
): number {
  if (policy.config.finalValidationItems === 0) {
    return policy.config.maxItems;
  }

  return Math.min(
    policy.config.explorationItems,
    Math.max(0, policy.config.maxItems - policy.config.finalValidationItems),
  );
}

function selectFinalValidationCandidate(
  input: SelectCandidateInput & {
    attemptItems: DiagnosticAttemptItem[];
  },
): ScoredCandidate | null {
  const finalRepairItem = findFinalValidationRepairAttemptItem({
    attemptItems: input.attemptItems,
    explorationItems: input.policy.config.explorationItems,
  });

  if (finalRepairItem?.answeredAt) {
    if (
      !isStrongCorrect({
        attemptItem: finalRepairItem,
        policy: input.policy,
      })
    ) {
      return null;
    }

    const repairedItem = input.questionBank.items.find(
      (item) => item.id === finalRepairItem.diagnosticItemId,
    );
    if (!repairedItem) return null;

    return selectHighestScoringCandidate({
      ...input,
      phase: "final_validation",
      requiredPrimaryTargetId: primaryTargetId(repairedItem),
      allowedPrimaryTargetOverflowId: primaryTargetId(repairedItem),
      allowedRoles: new Set(["confidence"]),
    });
  }

  for (const missedTarget of findMissedTargetsByRepairPriority(input)) {
    const repairCandidate = selectHighestScoringCandidate({
      ...input,
      phase: "final_validation",
      requiredPrimaryTargetId: missedTarget.primaryTargetId,
      allowedPrimaryTargetOverflowId: missedTarget.primaryTargetId,
      allowedRoles: new Set(["repair"]),
    });

    if (repairCandidate) return repairCandidate;
  }

  return selectHighestScoringCandidate({
    ...input,
    phase: "final_validation",
    allowedRoles: new Set(["confidence", "ceiling"]),
  });
}

type ScoredCandidate = {
  item: DiagnosticQuestionBankItem;
  score: CandidateScore;
  candidateCount: number;
};

type SelectCandidateInput = {
  questionBank: DiagnosticQuestionBank;
  shownDiagnosticItemIds: Set<string>;
  primaryTargetCounts: Map<string, number>;
  repairSelectionCount: number;
  repairTargetCounts: Map<string, number>;
  coveredConceptCapabilityKeys: Set<string>;
  attemptContext: AttemptSelectionContext;
  policy: InitialDiagnosticSelectionPolicy;
  goals: string[];
};

function selectHighestScoringCandidate(
  input: SelectCandidateInput & {
    phase: SelectionPhase;
    allowedRoles?: Set<DiagnosticQuestionRole>;
    requiredPrimaryTargetId?: string;
    allowedPrimaryTargetOverflowId?: string;
  },
): ScoredCandidate | null {
  const eligibleItems = input.questionBank.items
    .filter((item) => !input.shownDiagnosticItemIds.has(item.id))
    .filter((item) => selectableDiagnosticRoles(item).length > 0)
    .filter(
      (item) =>
        input.phase === "final_validation" ||
        selectableDiagnosticRoles(item).some((role) => role !== "repair"),
    )
    .filter(
      (item) =>
        !input.requiredPrimaryTargetId ||
        primaryTargetId(item) === input.requiredPrimaryTargetId,
    )
    .filter(
      (item) =>
        !input.allowedRoles ||
        selectableDiagnosticRoles(item).some((role) =>
          input.allowedRoles?.has(role),
        ),
    )
    .filter((item) =>
      canSelectPrimaryTargetCandidate({
        item,
        primaryTargetCounts: input.primaryTargetCounts,
        policy: input.policy,
        allowedPrimaryTargetOverflowId: input.allowedPrimaryTargetOverflowId,
      }),
    )
    .filter((item) =>
      canSelectRepairCandidate({
        item,
        repairSelectionCount: input.repairSelectionCount,
        repairTargetCounts: input.repairTargetCounts,
        policy: input.policy,
        repairRoleCanBeSelected:
          !input.allowedRoles || input.allowedRoles.has("repair"),
      }),
    );
  const levelEligibleItems =
    input.phase === "exploration"
      ? eligibleItems.filter((item) =>
          canSelectExplorationLevelCandidate({
            item,
            attemptContext: input.attemptContext,
          }),
        )
      : eligibleItems;
  const candidateItems =
    levelEligibleItems.length > 0 ||
    input.phase === "final_validation" ||
    input.attemptContext.answeredCount > 0
      ? levelEligibleItems
      : eligibleItems;
  const candidates = candidateItems
    .map((item) => {
      const score = scoreCandidate({
        item,
        primaryTargetCounts: input.primaryTargetCounts,
        coveredConceptCapabilityKeys: input.coveredConceptCapabilityKeys,
        attemptContext: input.attemptContext,
        policy: input.policy,
        goals: input.goals,
        phase: input.phase,
        allowedRoles: input.allowedRoles,
      });

      return { item, score };
    })
    .sort((left, right) => compareCandidateScores(left, right));

  const selected = candidates[0];
  return selected ? { ...selected, candidateCount: candidates.length } : null;
}

function selectableDiagnosticRoles(
  item: DiagnosticQuestionBankItem,
): DiagnosticQuestionRole[] {
  return item.details.diagnosticRoles.filter(
    (role) =>
      role !== "ceiling" ||
      compareDifficultyBands(item.difficultyBand, "A2") >= 0,
  );
}

function canSelectExplorationLevelCandidate(input: {
  item: DiagnosticQuestionBankItem;
  attemptContext: AttemptSelectionContext;
}): boolean {
  return (
    compareDifficultyBands(
      input.item.difficultyBand,
      input.attemptContext.targetLevel,
    ) <= 0
  );
}

function canSelectPrimaryTargetCandidate(input: {
  item: DiagnosticQuestionBankItem;
  primaryTargetCounts: Map<string, number>;
  policy: InitialDiagnosticSelectionPolicy;
  allowedPrimaryTargetOverflowId?: string;
}): boolean {
  if (
    input.allowedPrimaryTargetOverflowId &&
    primaryTargetId(input.item) === input.allowedPrimaryTargetOverflowId
  ) {
    return true;
  }

  return (
    (input.primaryTargetCounts.get(primaryTargetId(input.item)) ?? 0) <
    input.policy.config.maxItemsPerCompetency
  );
}

function canSelectRepairCandidate(input: {
  item: DiagnosticQuestionBankItem;
  repairSelectionCount: number;
  repairTargetCounts: Map<string, number>;
  policy: InitialDiagnosticSelectionPolicy;
  repairRoleCanBeSelected: boolean;
}): boolean {
  if (!input.repairRoleCanBeSelected) {
    return true;
  }

  if (!input.item.details.diagnosticRoles.includes("repair")) {
    return true;
  }

  if (input.repairSelectionCount >= input.policy.config.maxRepairItems) {
    return false;
  }

  return (
    (input.repairTargetCounts.get(primaryTargetId(input.item)) ?? 0) <
    input.policy.config.maxRepairItemsPerCompetency
  );
}

function scoreCandidate(input: {
  item: DiagnosticQuestionBankItem;
  primaryTargetCounts: Map<string, number>;
  coveredConceptCapabilityKeys: Set<string>;
  attemptContext: AttemptSelectionContext;
  policy: InitialDiagnosticSelectionPolicy;
  goals: string[];
  phase: SelectionPhase;
  allowedRoles?: Set<DiagnosticQuestionRole>;
}): CandidateScore {
  const repeatedPrimaryCount =
    input.primaryTargetCounts.get(primaryTargetId(input.item)) ?? 0;
  const directNewCompetencyValue = repeatedPrimaryCount === 0 ? 100 : 0;
  const repeatedCompetencyPenalty = repeatedPrimaryCount * 40;
  const informationGainScore = scoreConceptInformationGain({
    item: input.item,
    coveredConceptCapabilityKeys: input.coveredConceptCapabilityKeys,
    policy: input.policy,
  });
  const familyModeDiversityBonus =
    (input.item.primaryCompetency?.family &&
    !input.attemptContext.observedFamilies.has(
      input.item.primaryCompetency.family,
    )
      ? 5
      : 0) +
    (input.item.primaryCompetency?.mode &&
    !input.attemptContext.observedModes.has(input.item.primaryCompetency.mode)
      ? 3
      : 0);
  const goalPriorityBonus =
    highestGoalPriority({
      item: input.item,
      goals: input.goals,
    }) * 0.04;
  const roleFit = scoreRoleFit({
    item: input.item,
    attemptContext: input.attemptContext,
    goals: input.goals,
    phase: input.phase,
    allowedRoles: input.allowedRoles,
  });
  const levelFitScore = scoreLevelFit({
    item: input.item,
    attemptContext: input.attemptContext,
    selectedForRole: roleFit.selectedForRole,
  });
  const difficultyFitScore = scoreDifficultyFit({
    item: input.item,
    attemptContext: input.attemptContext,
    selectedForRole: roleFit.selectedForRole,
  });

  const baseScore =
    directNewCompetencyValue +
    informationGainScore -
    repeatedCompetencyPenalty +
    familyModeDiversityBonus +
    goalPriorityBonus;

  return {
    total: baseScore + levelFitScore + roleFit.score + difficultyFitScore,
    baseScore,
    informationGainScore,
    levelFitScore,
    roleFitScore: roleFit.score,
    difficultyFitScore,
    selectedForRole: roleFit.selectedForRole,
  };
}

function scoreRoleFit(input: {
  item: DiagnosticQuestionBankItem;
  attemptContext: AttemptSelectionContext;
  goals: string[];
  phase: SelectionPhase;
  allowedRoles?: Set<DiagnosticQuestionRole>;
}): { selectedForRole: DiagnosticQuestionRole; score: number } {
  const roles = input.allowedRoles
    ? selectableDiagnosticRoles(input.item).filter((role) =>
        input.allowedRoles?.has(role),
      )
    : selectableDiagnosticRoles(input.item);
  const scoredRoles = roles.map((role) => ({
    selectedForRole: role,
    score: scoreSingleRoleFit({
      role,
      attemptContext: input.attemptContext,
      goals: input.goals,
      phase: input.phase,
    }),
  }));

  return scoredRoles.reduce(
    (best, current) => (current.score > best.score ? current : best),
    scoredRoles[0] ?? { selectedForRole: "foundation", score: 0 },
  );
}

function scoreSingleRoleFit(input: {
  role: DiagnosticQuestionRole;
  attemptContext: AttemptSelectionContext;
  goals: string[];
  phase: SelectionPhase;
}): number {
  const hasAnsweredItems = input.attemptContext.answeredCount > 0;
  let score =
    input.phase === "final_validation"
      ? scoreFinalValidationRoleFit(input.role)
      : hasAnsweredItems
        ? scoreEvidenceBasedRoleFit(input.role, input.attemptContext)
        : scoreColdStartRoleFit(input.role);

  if (input.role === "ceiling") {
    score -= Math.min(input.attemptContext.consecutiveCeilingCount, 3) * 10;
  }

  if (input.role === "goal_probe" && input.goals.length === 0) {
    score -= 10;
  }

  return score;
}

function scoreFinalValidationRoleFit(role: DiagnosticQuestionRole): number {
  switch (role) {
    case "repair":
      return 60;
    case "confidence":
      return 45;
    case "ceiling":
      return 25;
    case "goal_probe":
      return 5;
    case "foundation":
      return 0;
  }
}

function scoreColdStartRoleFit(role: DiagnosticQuestionRole): number {
  switch (role) {
    case "foundation":
      return 45;
    case "confidence":
      return 10;
    case "goal_probe":
      return 5;
    case "repair":
      return -20;
    case "ceiling":
      return -45;
  }
}

function scoreEvidenceBasedRoleFit(
  role: DiagnosticQuestionRole,
  attemptContext: AttemptSelectionContext,
): number {
  if (attemptContext.lastAnswerWasWeak) {
    switch (role) {
      case "repair":
        return -30;
      case "confidence":
        return 35;
      case "foundation":
        return 20;
      case "goal_probe":
        return 5;
      case "ceiling":
        return -45;
    }
  }

  if (attemptContext.lastAnswerWasStrongCorrect) {
    switch (role) {
      case "ceiling":
        return 35;
      case "confidence":
        return 20;
      case "goal_probe":
        return 10;
      case "foundation":
        return 10;
      case "repair":
        return -10;
    }
  }

  switch (role) {
    case "confidence":
      return 25;
    case "foundation":
      return 15;
    case "repair":
      return 10;
    case "goal_probe":
      return 10;
    case "ceiling":
      return -10;
  }
}

function scoreLevelFit(input: {
  item: DiagnosticQuestionBankItem;
  attemptContext: AttemptSelectionContext;
  selectedForRole: DiagnosticQuestionRole;
}): number {
  const comparison = compareDifficultyBands(
    input.item.difficultyBand,
    input.attemptContext.targetLevel,
  );
  if (comparison === 0) return 35;

  const distance = Math.abs(comparison);
  if (distance === 1) {
    if (
      input.selectedForRole === "ceiling" &&
      comparison > 0 &&
      input.attemptContext.lastAnswerWasStrongCorrect
    ) {
      return 22;
    }

    if (
      (input.selectedForRole === "foundation" ||
        input.selectedForRole === "repair") &&
      comparison < 0
    ) {
      return 18;
    }

    if (input.selectedForRole === "confidence") {
      return 12;
    }

    return 8;
  }

  return -20 * distance;
}

function scoreDifficultyFit(input: {
  item: DiagnosticQuestionBankItem;
  attemptContext: AttemptSelectionContext;
  selectedForRole: DiagnosticQuestionRole;
}): number {
  const lastItem = input.attemptContext.lastAnsweredQuestionBankItem;
  if (!lastItem) return 0;

  const difficultyComparison = compareDifficultyBands(
    input.item.difficultyBand,
    lastItem.difficultyBand,
  );

  if (
    input.selectedForRole === "ceiling" &&
    input.attemptContext.lastAnswerWasWeak &&
    difficultyComparison >= 0
  ) {
    return -25;
  }

  if (
    input.selectedForRole === "repair" &&
    input.attemptContext.lastAnswerWasWeak &&
    difficultyComparison <= 0
  ) {
    return 10;
  }

  if (
    input.selectedForRole === "ceiling" &&
    input.attemptContext.lastAnswerWasStrongCorrect &&
    difficultyComparison >= 0
  ) {
    return 10;
  }

  return 0;
}

function countPrimaryTargetAttempts(input: {
  questionBank: DiagnosticQuestionBank;
  attemptItems: DiagnosticAttemptItem[];
}): Map<string, number> {
  const itemsById = new Map(
    input.questionBank.items.map((item) => [item.id, item]),
  );
  const counts = new Map<string, number>();

  for (const attemptItem of input.attemptItems) {
    const item = itemsById.get(attemptItem.diagnosticItemId);
    if (!item) continue;

    counts.set(
      primaryTargetId(item),
      (counts.get(primaryTargetId(item)) ?? 0) + 1,
    );
  }

  return counts;
}

function findCoveredConceptCapabilityKeys(input: {
  questionBank: DiagnosticQuestionBank;
  attemptItems: DiagnosticAttemptItem[];
}): Set<string> {
  const itemsById = new Map(
    input.questionBank.items.map((item) => [item.id, item]),
  );
  const coveredConceptCapabilityKeys = new Set<string>();

  for (const attemptItem of input.attemptItems) {
    const item = itemsById.get(attemptItem.diagnosticItemId);
    if (!item) continue;

    for (const mapping of item.evidenceMappings) {
      coveredConceptCapabilityKeys.add(conceptCapabilityKey(mapping));
    }
  }

  return coveredConceptCapabilityKeys;
}

function scoreConceptInformationGain(input: {
  item: DiagnosticQuestionBankItem;
  coveredConceptCapabilityKeys: Set<string>;
  policy: InitialDiagnosticSelectionPolicy;
}): number {
  const directEvidenceScore = input.item.evidenceMappings.reduce(
    (total, mapping) =>
      total +
      input.policy.config.directConceptEvidenceWeight *
        (mapping.strength / 100) *
        coverageMultiplier({
          conceptCapabilityKey: conceptCapabilityKey(mapping),
          coveredConceptCapabilityKeys: input.coveredConceptCapabilityKeys,
          policy: input.policy,
        }),
    0,
  );
  const assumedConceptScore = (
    input.item.primaryCompetency?.assumedConcepts ?? []
  ).reduce((total, assumedConcept) => {
    const capabilityMultiplier =
      input.policy.config.assumedCapabilityMultipliers[
        assumedConcept.requiredCapability
      ];

    return (
      total +
      input.policy.config.directConceptEvidenceWeight *
        input.policy.config.assumedConceptEvidenceMultiplier *
        capabilityMultiplier *
        coverageMultiplier({
          conceptCapabilityKey: conceptCapabilityKey({
            conceptId: assumedConcept.conceptId,
            capability: assumedConcept.requiredCapability,
          }),
          coveredConceptCapabilityKeys: input.coveredConceptCapabilityKeys,
          policy: input.policy,
        })
    );
  }, 0);

  return directEvidenceScore + assumedConceptScore;
}

function coverageMultiplier(input: {
  conceptCapabilityKey: string;
  coveredConceptCapabilityKeys: Set<string>;
  policy: InitialDiagnosticSelectionPolicy;
}): number {
  return input.coveredConceptCapabilityKeys.has(input.conceptCapabilityKey)
    ? input.policy.config.coveredConceptEvidenceMultiplier
    : 1;
}

function conceptCapabilityKey(input: {
  conceptId: string;
  capability: string;
}): string {
  return `${input.conceptId}:${input.capability}`;
}

type AttemptSelectionContext = {
  answeredCount: number;
  answeredItems: DiagnosticAttemptItem[];
  consecutiveCeilingCount: number;
  lastAnsweredQuestionBankItem: DiagnosticQuestionBankItem | null;
  lastAnswerWasStrongCorrect: boolean;
  lastAnswerWasWeak: boolean;
  observedFamilies: Set<string>;
  observedModes: Set<string>;
  currentLevel: DiagnosticLevel;
  targetLevel: DiagnosticLevel;
  currentLevelBalance: number;
};

function buildAttemptSelectionContext(input: {
  questionBank: DiagnosticQuestionBank;
  answeredItems: DiagnosticAttemptItem[];
  policy: InitialDiagnosticSelectionPolicy;
}): AttemptSelectionContext {
  const itemsById = new Map(
    input.questionBank.items.map((item) => [item.id, item]),
  );
  const sortedAnsweredItems = [...input.answeredItems].sort(
    (left, right) => left.position - right.position,
  );
  const lastAnsweredItem =
    sortedAnsweredItems[sortedAnsweredItems.length - 1] ?? null;
  const lastAnsweredQuestionBankItem = lastAnsweredItem
    ? (itemsById.get(lastAnsweredItem.diagnosticItemId) ?? null)
    : null;
  const observedFamilies = new Set<string>();
  const observedModes = new Set<string>();
  let consecutiveCeilingCount = 0;
  const levelContext = buildLevelSelectionContext({
    sortedAnsweredItems,
    itemsById,
    policy: input.policy,
  });

  for (const attemptItem of sortedAnsweredItems) {
    const item = itemsById.get(attemptItem.diagnosticItemId);
    if (!item) continue;

    if (item.primaryCompetency?.family) {
      observedFamilies.add(item.primaryCompetency.family);
    }
    if (item.primaryCompetency?.mode) {
      observedModes.add(item.primaryCompetency.mode);
    }
  }

  for (let index = sortedAnsweredItems.length - 1; index >= 0; index -= 1) {
    const attemptItem = sortedAnsweredItems[index];
    if (!attemptItem || attemptItem.selectedForRole !== "ceiling") break;
    consecutiveCeilingCount += 1;
  }

  return {
    answeredCount: sortedAnsweredItems.length,
    answeredItems: sortedAnsweredItems,
    consecutiveCeilingCount,
    lastAnsweredQuestionBankItem,
    lastAnswerWasStrongCorrect: lastAnsweredItem
      ? isStrongCorrect({
          attemptItem: lastAnsweredItem,
          policy: input.policy,
        })
      : false,
    lastAnswerWasWeak: lastAnsweredItem
      ? isWeakAnswer({
          attemptItem: lastAnsweredItem,
          policy: input.policy,
        })
      : false,
    observedFamilies,
    observedModes,
    currentLevel: levelContext.currentLevel,
    targetLevel: levelContext.targetLevel,
    currentLevelBalance: levelContext.currentLevelBalance,
  };
}

function buildLevelSelectionContext(input: {
  sortedAnsweredItems: DiagnosticAttemptItem[];
  itemsById: Map<string, DiagnosticQuestionBankItem>;
  policy: InitialDiagnosticSelectionPolicy;
}): {
  currentLevel: DiagnosticLevel;
  targetLevel: DiagnosticLevel;
  currentLevelBalance: number;
} {
  const lastAnsweredItem =
    input.sortedAnsweredItems[input.sortedAnsweredItems.length - 1] ?? null;
  const lastQuestionBankItem = lastAnsweredItem
    ? (input.itemsById.get(lastAnsweredItem.diagnosticItemId) ?? null)
    : null;
  const currentLevel = toDiagnosticLevel(
    lastQuestionBankItem?.difficultyBand ?? "Pre-A1",
  );
  let currentLevelBalance = 0;

  for (
    let index = input.sortedAnsweredItems.length - 1;
    index >= 0;
    index -= 1
  ) {
    const attemptItem = input.sortedAnsweredItems[index];
    if (!attemptItem) continue;

    const questionBankItem = input.itemsById.get(attemptItem.diagnosticItemId);
    if (!questionBankItem) continue;
    if (toDiagnosticLevel(questionBankItem.difficultyBand) !== currentLevel) {
      break;
    }

    if (
      isCorrectForLevelBalance({
        attemptItem,
        policy: input.policy,
      })
    ) {
      currentLevelBalance += 1;
    } else if (
      isMissForLevelBalance({
        attemptItem,
        policy: input.policy,
      })
    ) {
      currentLevelBalance -= 1;
    }
  }

  return {
    currentLevel,
    targetLevel: selectTargetLevel({
      currentLevel,
      currentLevelBalance,
      policy: input.policy,
    }),
    currentLevelBalance,
  };
}

function selectTargetLevel(input: {
  currentLevel: DiagnosticLevel;
  currentLevelBalance: number;
  policy: InitialDiagnosticSelectionPolicy;
}): DiagnosticLevel {
  const advanceThreshold =
    input.currentLevel === "B2"
      ? null
      : input.policy.config.levelAdvanceThresholds[input.currentLevel];

  if (
    advanceThreshold !== null &&
    input.currentLevelBalance >= advanceThreshold
  ) {
    return nextDiagnosticLevel(input.currentLevel);
  }

  if (
    input.currentLevelBalance <= input.policy.config.levelRegressionThreshold
  ) {
    return previousDiagnosticLevel(input.currentLevel);
  }

  return input.currentLevel;
}

function findFinalValidationRepairAttemptItem(input: {
  attemptItems: DiagnosticAttemptItem[];
  explorationItems: number;
}): DiagnosticAttemptItem | null {
  const finalValidationItems = input.attemptItems.filter(
    (item) =>
      item.selectionTrace.phase === "final_validation" ||
      item.position > input.explorationItems,
  );

  return (
    finalValidationItems.find((item) => item.selectedForRole === "repair") ??
    null
  );
}

function findMissedTargetsByRepairPriority(
  input: SelectCandidateInput,
): Array<{ primaryTargetId: string; impactScore: number }> {
  const itemsById = new Map(
    input.questionBank.items.map((item) => [item.id, item]),
  );
  const missedTargets = new Map<
    string,
    { primaryTargetId: string; impactScore: number }
  >();

  for (const attemptItem of input.attemptContext.answeredItems) {
    if (
      !isMissForLevelBalance({
        attemptItem,
        policy: input.policy,
      })
    ) {
      continue;
    }

    const item = itemsById.get(attemptItem.diagnosticItemId);
    if (!item) continue;

    const impactScore = missedCompetencyImpactScore({
      item,
      targetLevel: input.attemptContext.targetLevel,
      goals: input.goals,
      coveredConceptCapabilityKeys: input.coveredConceptCapabilityKeys,
      policy: input.policy,
    });
    const targetId = primaryTargetId(item);
    const current = missedTargets.get(targetId);
    if (!current || impactScore > current.impactScore) {
      missedTargets.set(targetId, {
        primaryTargetId: targetId,
        impactScore,
      });
    }
  }

  return [...missedTargets.values()].sort((left, right) => {
    if (left.impactScore !== right.impactScore) {
      return right.impactScore - left.impactScore;
    }

    return left.primaryTargetId.localeCompare(right.primaryTargetId);
  });
}

function missedCompetencyImpactScore(input: {
  item: DiagnosticQuestionBankItem;
  targetLevel: DiagnosticLevel;
  goals: string[];
  coveredConceptCapabilityKeys: Set<string>;
  policy: InitialDiagnosticSelectionPolicy;
}): number {
  const informationGainScore = scoreConceptInformationGain({
    item: input.item,
    coveredConceptCapabilityKeys: input.coveredConceptCapabilityKeys,
    policy: input.policy,
  });
  const coreScore = input.item.primaryCompetency?.isCore ? 10 : 0;
  const levelDistance = Math.abs(
    compareDifficultyBands(input.item.difficultyBand, input.targetLevel),
  );
  const levelScore = Math.max(0, 10 - levelDistance * 4);
  const goalScore =
    highestGoalPriority({
      item: input.item,
      goals: input.goals,
    }) * 0.1;

  return informationGainScore + coreScore + levelScore + goalScore;
}

function toDiagnosticLevel(difficultyBand: string): DiagnosticLevel {
  switch (difficultyBand) {
    case "Pre-A1":
    case "A1":
    case "A2":
    case "B1":
    case "B2":
      return difficultyBand;
    default:
      return "A1";
  }
}

function nextDiagnosticLevel(level: DiagnosticLevel): DiagnosticLevel {
  switch (level) {
    case "Pre-A1":
      return "A1";
    case "A1":
      return "A2";
    case "A2":
      return "B1";
    case "B1":
      return "B2";
    case "B2":
      return "B2";
  }
}

function previousDiagnosticLevel(level: DiagnosticLevel): DiagnosticLevel {
  switch (level) {
    case "Pre-A1":
      return "Pre-A1";
    case "A1":
      return "Pre-A1";
    case "A2":
      return "A1";
    case "B1":
      return "A2";
    case "B2":
      return "B1";
  }
}

function isCorrectForLevelBalance(input: {
  attemptItem: DiagnosticAttemptItem;
  policy: InitialDiagnosticSelectionPolicy;
}): boolean {
  return (
    input.attemptItem.score !== null &&
    input.attemptItem.score >= input.policy.config.strongCorrectMinScore
  );
}

function isMissForLevelBalance(input: {
  attemptItem: DiagnosticAttemptItem;
  policy: InitialDiagnosticSelectionPolicy;
}): boolean {
  return (
    input.attemptItem.score !== null &&
    input.attemptItem.score < input.policy.config.strongCorrectMinScore
  );
}

function isStrongCorrect(input: {
  attemptItem: DiagnosticAttemptItem;
  policy: InitialDiagnosticSelectionPolicy;
}): boolean {
  return (
    input.attemptItem.score !== null &&
    input.attemptItem.confidence !== null &&
    input.attemptItem.score >= input.policy.config.strongCorrectMinScore &&
    input.attemptItem.confidence >=
      input.policy.config.strongCorrectMinConfidence
  );
}

function isWeakAnswer(input: {
  attemptItem: DiagnosticAttemptItem;
  policy: InitialDiagnosticSelectionPolicy;
}): boolean {
  if (input.attemptItem.score === null) return false;
  if (input.attemptItem.confidence === null) return true;

  return (
    input.attemptItem.score < input.policy.config.strongCorrectMinScore ||
    input.attemptItem.confidence <
      input.policy.config.strongCorrectMinConfidence
  );
}

function compareDifficultyBands(left: string, right: string): number {
  return difficultyBandRank(left) - difficultyBandRank(right);
}

function difficultyBandRank(difficultyBand: string): number {
  switch (difficultyBand) {
    case "Pre-A1":
      return 0;
    case "A1":
      return 1;
    case "A2":
      return 2;
    case "B1":
      return 3;
    case "B2":
      return 4;
    default:
      return 1;
  }
}

function highestGoalPriority(input: {
  item: DiagnosticQuestionBankItem;
  goals: string[];
}): number {
  const activeGoals = new Set(input.goals);
  const matchingPriorities =
    input.item.primaryCompetency?.goalPriorities
      .filter((priority) => activeGoals.has(priority.goal))
      .map((priority) => priority.priority) ?? [];

  return matchingPriorities.length > 0 ? Math.max(...matchingPriorities) : 0;
}

function compareCandidateScores(
  left: { item: DiagnosticQuestionBankItem; score: CandidateScore },
  right: { item: DiagnosticQuestionBankItem; score: CandidateScore },
): number {
  if (left.score.total !== right.score.total) {
    return right.score.total - left.score.total;
  }

  const keyComparison = left.item.key.localeCompare(right.item.key);
  if (keyComparison !== 0) return keyComparison;

  return left.item.id.localeCompare(right.item.id);
}
