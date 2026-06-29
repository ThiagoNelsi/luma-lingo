import { describe, expect, it } from "vitest";

import {
  buildDiagnosticQuestionBankImportPlan,
  importDiagnosticQuestionBank,
  parseDiagnosticQuestionBank,
} from "./diagnostic-question-bank-import.js";

const catalog = {
  id: "catalog-1",
  targetLanguage: "en",
  version: "2026-06-28-draft",
  metadata: {
    schemaVersion: 1,
  },
};

const competencies = [
  {
    id: "competency-1",
    key: "pre-a1-core-subject-pronouns",
  },
  {
    id: "competency-2",
    key: "pre-a1-core-be-present-affirmative",
  },
];

function buildQuestionBank(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    targetLanguage: "en",
    catalogVersion: "2026-06-28-draft",
    purpose: "onboarding_initial",
    items: [
      {
        key: "en.diag.pre-a1.subject-pronouns.foundation.001",
        status: "published",
        primaryCompetencyKey: "pre-a1-core-subject-pronouns",
        difficultyBand: "Pre-A1",
        responseFormat: "multiple_choice",
        prompt: {
          schemaVersion: 1,
          kind: "multiple_choice",
          instructionLocalizations: {
            pt: "Escolha a melhor resposta.",
            en: "Choose the best answer.",
          },
          contentLanguage: "en",
          stem: "Maria is a teacher. ___ is from Brazil.",
          options: [
            {
              id: "option_she",
              text: "She",
            },
            {
              id: "option_he",
              text: "He",
            },
          ],
        },
        scoringRule: {
          schemaVersion: 1,
          kind: "multiple_choice",
          maxScore: 1,
          passingScore: 1,
          evidenceConfidence: 0.71,
          correctOptionIds: ["option_she"],
          distractors: {
            option_he: {
              mistakeCode: "grammar.subject.wrong_pronoun",
              rationale: "Selects a masculine pronoun for Maria.",
            },
          },
        },
        targets: [
          {
            competencyKey: "pre-a1-core-subject-pronouns",
            role: "primary",
            weight: 100,
            details: {
              schemaVersion: 1,
            },
          },
          {
            competencyKey: "pre-a1-core-be-present-affirmative",
            role: "supporting",
            weight: 60,
            details: {
              schemaVersion: 1,
              scoringNotes:
                "Supporting prerequisite signal for be present forms.",
            },
          },
        ],
        details: {
          schemaVersion: 1,
          diagnosticRoles: ["foundation"],
          rationale: "Checks whether the learner can select a subject pronoun.",
          safetyNotes: [],
          localizationNotes: [
            "Keep diagnostic content in English; localize instructions only.",
          ],
          distractorRationale: {
            option_he: "Selects a masculine pronoun for Maria.",
          },
          authoringSource: {
            plan: "onboarding-diagnostic-question-plan",
            variant: "foundation",
          },
        },
      },
    ],
    ...overrides,
  };
}

describe("diagnostic question bank import", () => {
  it("rejects malformed authored diagnostic items before import planning", () => {
    const questionBank = buildQuestionBank({
      items: [
        {
          ...buildQuestionBank().items[0],
          responseFormat: "fill_blank_choice",
        },
      ],
    });

    expect(() => parseDiagnosticQuestionBank(questionBank)).toThrow(
      /response_format_must_match_prompt_kind/,
    );
  });

  it("maps valid authored diagnostic items to deterministic item and target rows", () => {
    const importedAt = new Date("2026-06-28T12:00:00.000Z");
    const plan = buildDiagnosticQuestionBankImportPlan({
      questionBank: parseDiagnosticQuestionBank(buildQuestionBank()),
      catalog,
      competencies,
      importedAt,
      sourceFile: "data/catalogs/en/onboarding-diagnostic-question-bank.json",
    });

    expect(plan.diagnosticItems).toEqual([
      expect.objectContaining({
        catalogId: "catalog-1",
        key: "en.diag.pre-a1.subject-pronouns.foundation.001",
        primaryCompetencyId: "competency-1",
        difficultyBand: "Pre-A1",
        responseFormat: "multiple_choice",
        status: "published",
        reviewedAt: importedAt,
        publishedAt: importedAt,
      }),
    ]);
    expect(plan.diagnosticTargets).toEqual([
      {
        diagnosticItemId: plan.diagnosticItems[0]?.id,
        competencyId: "competency-1",
        role: "primary",
        weight: 100,
        details: {
          schemaVersion: 1,
        },
      },
      {
        diagnosticItemId: plan.diagnosticItems[0]?.id,
        competencyId: "competency-2",
        role: "supporting",
        weight: 60,
        details: {
          schemaVersion: 1,
          scoringNotes: "Supporting prerequisite signal for be present forms.",
        },
      },
    ]);
    expect(plan.summary).toEqual({
      diagnosticItems: 1,
      diagnosticTargets: 2,
    });
  });

  it("rejects question banks that reference competencies outside the catalog", () => {
    const questionBank = parseDiagnosticQuestionBank(
      buildQuestionBank({
        items: [
          {
            ...buildQuestionBank().items[0],
            primaryCompetencyKey: "unknown-competency",
            targets: [
              {
                competencyKey: "unknown-competency",
                role: "primary",
                weight: 100,
                details: {
                  schemaVersion: 1,
                },
              },
            ],
          },
        ],
      }),
    );

    expect(() =>
      buildDiagnosticQuestionBankImportPlan({
        questionBank,
        catalog,
        competencies,
        importedAt: new Date("2026-06-28T12:00:00.000Z"),
      }),
    ).toThrow(/unknown-competency/);
  });

  it("imports items idempotently and rebuilds imported diagnostic targets", async () => {
    const importedAt = new Date("2026-06-28T12:00:00.000Z");
    const tx: {
      competencyCatalog: {
        findUnique(input: unknown): Promise<
          typeof catalog & {
            competencies: typeof competencies;
          }
        >;
        update(input: unknown): Promise<object>;
      };
      diagnosticItem: {
        upsert(input: unknown): Promise<object>;
        count(input: unknown): Promise<number>;
      };
      diagnosticItemCompetencyTarget: {
        deleteMany(input: unknown): Promise<{ count: number }>;
        createMany(input: unknown): Promise<{ count: number }>;
        count(input: unknown): Promise<number>;
      };
    } = {
      competencyCatalog: {
        findUnique: async (_input) => ({
          ...catalog,
          competencies,
        }),
        update: async (_input) => ({}),
      },
      diagnosticItem: {
        upsert: async (_input) => ({}),
        count: async (_input) => 1,
      },
      diagnosticItemCompetencyTarget: {
        deleteMany: async (_input) => ({ count: 2 }),
        createMany: async (_input) => ({ count: 2 }),
        count: async (_input) => 2,
      },
    };
    const calls: string[] = [];
    const prisma = {
      $transaction: async <T>(
        callback: (client: typeof tx) => Promise<T>,
        options: { timeout?: number },
      ) => {
        calls.push(`transaction:${options.timeout ?? "none"}`);
        return callback({
          competencyCatalog: {
            findUnique: async (input: unknown) => {
              calls.push("catalog.findUnique");
              return tx.competencyCatalog.findUnique(input);
            },
            update: async (input: unknown) => {
              calls.push("catalog.update");
              return tx.competencyCatalog.update(input);
            },
          },
          diagnosticItem: {
            upsert: async (input: unknown) => {
              calls.push("item.upsert");
              return tx.diagnosticItem.upsert(input);
            },
            count: async (input: unknown) => {
              calls.push("item.count");
              return tx.diagnosticItem.count(input);
            },
          },
          diagnosticItemCompetencyTarget: {
            deleteMany: async (input: unknown) => {
              calls.push("target.deleteMany");
              return tx.diagnosticItemCompetencyTarget.deleteMany(input);
            },
            createMany: async (input: unknown) => {
              calls.push("target.createMany");
              return tx.diagnosticItemCompetencyTarget.createMany(input);
            },
            count: async (input: unknown) => {
              calls.push("target.count");
              return tx.diagnosticItemCompetencyTarget.count(input);
            },
          },
        });
      },
    };

    await expect(
      importDiagnosticQuestionBank(prisma as never, {
        questionBank: parseDiagnosticQuestionBank(buildQuestionBank()),
        transactionTimeoutMs: 120000,
        now: () => importedAt,
      }),
    ).resolves.toEqual({
      dryRun: false,
      catalog: {
        id: "catalog-1",
        targetLanguage: "en",
        version: "2026-06-28-draft",
      },
      imported: {
        diagnosticItems: 1,
        diagnosticTargets: 2,
      },
      catalogTotals: {
        diagnosticItems: 1,
        diagnosticTargets: 2,
      },
    });
    expect(calls).toEqual([
      "transaction:120000",
      "catalog.findUnique",
      "item.upsert",
      "target.deleteMany",
      "target.createMany",
      "catalog.update",
      "item.count",
      "target.count",
    ]);
  });
});
