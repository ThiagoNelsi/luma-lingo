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
  const primaryCompetencyCounts = countPrimaryCompetencyAttempts({
    questionBank: input.questionBank,
    attemptItems: input.attemptItems,
  });
  const repairSelectionCount = input.attemptItems.filter(
    (item) => item.selectedForRole === "repair",
  ).length;
  const repairCompetencyCounts = countPrimaryCompetencyAttempts({
    questionBank: input.questionBank,
    attemptItems: input.attemptItems.filter(
      (item) => item.selectedForRole === "repair",
    ),
  });
  const coveredCompetencyIds = findCoveredCompetencyIds({
    questionBank: input.questionBank,
    attemptItems: answeredItems,
  });
  const attemptContext = buildAttemptSelectionContext({
    questionBank: input.questionBank,
    answeredItems,
    policy: input.policy,
  });

  const candidates = input.questionBank.items
    .filter((item) => !shownDiagnosticItemIds.has(item.id))
    .filter(
      (item) =>
        (primaryCompetencyCounts.get(item.primaryCompetencyId) ?? 0) <
        input.policy.config.maxItemsPerCompetency,
    )
    .filter((item) =>
      canSelectRepairCandidate({
        item,
        repairSelectionCount,
        repairCompetencyCounts,
        policy: input.policy,
      }),
    )
    .map((item) => {
      const score = scoreCandidate({
        item,
        primaryCompetencyCounts,
        coveredCompetencyIds,
        attemptContext,
        goals: input.goals,
      });

      return { item, score };
    })
    .sort((left, right) => compareCandidateScores(left, right));

  const selected = candidates[0];
  if (!selected) return null;

  return {
    item: selected.item,
    selectedForRole: selected.item.details.diagnosticRoles[0] ?? "foundation",
    selectionRule: input.policy.version,
    selectionTrace: {
      schemaVersion: 1,
      candidateCount: candidates.length,
      selectedScore: selected.score,
      tieBreakers: ["score_desc", "item_key_asc", "item_id_asc"],
    },
  };
}

function canSelectRepairCandidate(input: {
  item: DiagnosticQuestionBankItem;
  repairSelectionCount: number;
  repairCompetencyCounts: Map<string, number>;
  policy: InitialDiagnosticSelectionPolicy;
}): boolean {
  if (!input.item.details.diagnosticRoles.includes("repair")) {
    return true;
  }

  if (input.repairSelectionCount >= input.policy.config.maxRepairItems) {
    return false;
  }

  return (
    (input.repairCompetencyCounts.get(input.item.primaryCompetencyId) ?? 0) <
    input.policy.config.maxRepairItemsPerCompetency
  );
}

function scoreCandidate(input: {
  item: DiagnosticQuestionBankItem;
  primaryCompetencyCounts: Map<string, number>;
  coveredCompetencyIds: Set<string>;
  attemptContext: AttemptSelectionContext;
  goals: string[];
}): number {
  const repeatedPrimaryCount =
    input.primaryCompetencyCounts.get(input.item.primaryCompetencyId) ?? 0;
  const directNewCompetencyValue = repeatedPrimaryCount === 0 ? 100 : 0;
  const repeatedCompetencyPenalty = repeatedPrimaryCount * 40;
  const prerequisites = input.item.primaryCompetency?.prerequisites ?? [];
  const unknownPrerequisiteCount = prerequisites.filter(
    (prerequisite) =>
      !input.coveredCompetencyIds.has(prerequisite.competencyId),
  ).length;
  const coveredPrerequisiteCount =
    prerequisites.length - unknownPrerequisiteCount;
  const inferredPrerequisiteCoverageValue = unknownPrerequisiteCount * 12;
  const alreadyCoveredPrerequisiteOverlapPenalty = coveredPrerequisiteCount * 6;
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
  const difficultyBandProbeValue =
    input.attemptContext.missedHigherBands.has(input.item.difficultyBand) &&
    !input.item.details.diagnosticRoles.includes("repair")
      ? 18
      : 0;
  const goalPriorityBonus =
    highestGoalPriority({
      item: input.item,
      goals: input.goals,
    }) * 0.04;

  return (
    directNewCompetencyValue +
    inferredPrerequisiteCoverageValue -
    alreadyCoveredPrerequisiteOverlapPenalty -
    repeatedCompetencyPenalty +
    difficultyBandProbeValue +
    familyModeDiversityBonus +
    goalPriorityBonus
  );
}

function countPrimaryCompetencyAttempts(input: {
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
      item.primaryCompetencyId,
      (counts.get(item.primaryCompetencyId) ?? 0) + 1,
    );
  }

  return counts;
}

function findCoveredCompetencyIds(input: {
  questionBank: DiagnosticQuestionBank;
  attemptItems: DiagnosticAttemptItem[];
}): Set<string> {
  const itemsById = new Map(
    input.questionBank.items.map((item) => [item.id, item]),
  );
  const coveredCompetencyIds = new Set<string>();

  for (const attemptItem of input.attemptItems) {
    const item = itemsById.get(attemptItem.diagnosticItemId);
    if (!item) continue;

    for (const target of item.targets) {
      coveredCompetencyIds.add(target.competencyId);
    }
  }

  return coveredCompetencyIds;
}

type AttemptSelectionContext = {
  observedFamilies: Set<string>;
  observedModes: Set<string>;
  missedHigherBands: Set<string>;
};

function buildAttemptSelectionContext(input: {
  questionBank: DiagnosticQuestionBank;
  answeredItems: DiagnosticAttemptItem[];
  policy: InitialDiagnosticSelectionPolicy;
}): AttemptSelectionContext {
  const itemsById = new Map(
    input.questionBank.items.map((item) => [item.id, item]),
  );
  const observedFamilies = new Set<string>();
  const observedModes = new Set<string>();
  const missedHigherBands = new Set<string>();

  for (const attemptItem of input.answeredItems) {
    const item = itemsById.get(attemptItem.diagnosticItemId);
    if (!item) continue;

    if (item.primaryCompetency?.family) {
      observedFamilies.add(item.primaryCompetency.family);
    }
    if (item.primaryCompetency?.mode) {
      observedModes.add(item.primaryCompetency.mode);
    }
    if (
      isHigherBand(item.difficultyBand) &&
      attemptItem.score !== null &&
      attemptItem.score < input.policy.config.strongCorrectMinScore
    ) {
      missedHigherBands.add(item.difficultyBand);
    }
  }

  return { observedFamilies, observedModes, missedHigherBands };
}

function isHigherBand(difficultyBand: string): boolean {
  return (
    difficultyBand === "A2" ||
    difficultyBand === "B1" ||
    difficultyBand === "B2"
  );
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
  left: { item: DiagnosticQuestionBankItem; score: number },
  right: { item: DiagnosticQuestionBankItem; score: number },
): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  const keyComparison = left.item.key.localeCompare(right.item.key);
  if (keyComparison !== 0) return keyComparison;

  return left.item.id.localeCompare(right.item.id);
}
