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

const concepts = [
  {
    id: "concept-1",
    key: "form.synthetic.subject_pronoun",
  },
  {
    id: "concept-2",
    key: "form.synthetic.be_present",
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
        primaryTarget: {
          kind: "competency",
          competencyKey: "pre-a1-core-subject-pronouns",
        },
        difficultyBand: "Pre-A1",
        mode: "reading",
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
        evidenceMappings: [
          {
            conceptKey: "form.synthetic.subject_pronoun",
            capability: "recognition",
            strength: 100,
          },
          {
            conceptKey: "form.synthetic.be_present",
            capability: "recognition",
            strength: 60,
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
      concepts,
      importedAt,
      sourceFile: "data/catalogs/en/onboarding-diagnostic-question-bank.json",
    });

    expect(plan.diagnosticItems).toEqual([
      expect.objectContaining({
        catalogId: "catalog-1",
        key: "en.diag.pre-a1.subject-pronouns.foundation.001",
        primaryCompetencyId: "competency-1",
        primaryConceptId: null,
        difficultyBand: "Pre-A1",
        mode: "reading",
        responseFormat: "multiple_choice",
        status: "published",
        reviewedAt: importedAt,
        publishedAt: importedAt,
      }),
    ]);
    expect(plan.evidenceMappings).toEqual([
      {
        diagnosticItemId: plan.diagnosticItems[0]?.id,
        conceptId: "concept-1",
        capability: "recognition",
        strength: 100,
      },
      {
        diagnosticItemId: plan.diagnosticItems[0]?.id,
        conceptId: "concept-2",
        capability: "recognition",
        strength: 60,
      },
    ]);
    expect(plan.summary).toEqual({
      diagnosticItems: 1,
      evidenceMappings: 2,
    });
  });

  it("maps a concept primary target independently from its evidence mapping", () => {
    const questionBank = parseDiagnosticQuestionBank(
      buildQuestionBank({
        items: [
          {
            ...buildQuestionBank().items[0],
            primaryTarget: {
              kind: "concept",
              conceptKey: "form.synthetic.subject_pronoun",
            },
          },
        ],
      }),
    );

    const plan = buildDiagnosticQuestionBankImportPlan({
      questionBank,
      catalog,
      competencies,
      concepts,
      importedAt: new Date("2026-06-28T12:00:00.000Z"),
    });

    expect(plan.diagnosticItems[0]).toMatchObject({
      primaryCompetencyId: null,
      primaryConceptId: "concept-1",
    });
  });

  it("rejects published items without authoring-source metadata", () => {
    const authoredItem = buildQuestionBank().items[0];
    if (!authoredItem) throw new Error("Expected a diagnostic item fixture");

    const questionBank = parseDiagnosticQuestionBank(
      buildQuestionBank({
        items: [
          {
            ...authoredItem,
            details: {
              ...authoredItem.details,
              authoringSource: undefined,
            },
          },
        ],
      }),
    );

    expect(() =>
      buildDiagnosticQuestionBankImportPlan({
        questionBank,
        catalog,
        competencies,
        concepts,
        importedAt: new Date("2026-06-28T12:00:00.000Z"),
      }),
    ).toThrow(
      /Published diagnostic item .* requires authoring-source metadata/,
    );
  });

  it("allows empty evidence mappings only for a componentless competency target", () => {
    const questionBank = parseDiagnosticQuestionBank(
      buildQuestionBank({
        items: [
          {
            ...buildQuestionBank().items[0],
            primaryTarget: {
              kind: "competency",
              competencyKey: "pre-a1-core-subject-pronouns",
            },
            evidenceMappings: [],
          },
        ],
      }),
    );

    expect(() =>
      buildDiagnosticQuestionBankImportPlan({
        questionBank,
        catalog,
        competencies: [
          {
            id: "competency-1",
            key: "pre-a1-core-subject-pronouns",
            componentConceptKeys: [],
          },
        ],
        concepts,
        importedAt: new Date("2026-06-28T12:00:00.000Z"),
      }),
    ).not.toThrow();

    expect(() =>
      buildDiagnosticQuestionBankImportPlan({
        questionBank,
        catalog,
        competencies: [
          {
            id: "competency-1",
            key: "pre-a1-core-subject-pronouns",
            componentConceptKeys: ["form.synthetic.subject_pronoun"],
          },
        ],
        concepts,
        importedAt: new Date("2026-06-28T12:00:00.000Z"),
      }),
    ).toThrow(/not componentless/);
  });

  it("rejects question banks that reference competencies outside the catalog", () => {
    const questionBank = parseDiagnosticQuestionBank(
      buildQuestionBank({
        items: [
          {
            ...buildQuestionBank().items[0],
            primaryTarget: {
              kind: "competency",
              competencyKey: "unknown-competency",
            },
          },
        ],
      }),
    );

    expect(() =>
      buildDiagnosticQuestionBankImportPlan({
        questionBank,
        catalog,
        competencies,
        concepts,
        importedAt: new Date("2026-06-28T12:00:00.000Z"),
      }),
    ).toThrow(/unknown-competency/);
  });

  it("rejects question banks that map evidence to an unknown concept", () => {
    const questionBank = parseDiagnosticQuestionBank(
      buildQuestionBank({
        items: [
          {
            ...buildQuestionBank().items[0],
            evidenceMappings: [
              {
                conceptKey: "form.synthetic.unknown",
                capability: "recognition",
                strength: 100,
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
        concepts,
        importedAt: new Date("2026-06-28T12:00:00.000Z"),
      }),
    ).toThrow(/form\.synthetic\.unknown/);
  });

  it("imports items idempotently and rebuilds Q-matrix evidence mappings", async () => {
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
      concept: {
        findMany(input: unknown): Promise<typeof concepts>;
      };
      diagnosticItemConceptEvidenceMapping: {
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
      concept: {
        findMany: async (_input) => concepts,
      },
      diagnosticItemConceptEvidenceMapping: {
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
          concept: {
            findMany: async (input: unknown) => {
              calls.push("concept.findMany");
              return tx.concept.findMany(input);
            },
          },
          diagnosticItemConceptEvidenceMapping: {
            deleteMany: async (input: unknown) => {
              calls.push("mapping.deleteMany");
              return tx.diagnosticItemConceptEvidenceMapping.deleteMany(input);
            },
            createMany: async (input: unknown) => {
              calls.push("mapping.createMany");
              return tx.diagnosticItemConceptEvidenceMapping.createMany(input);
            },
            count: async (input: unknown) => {
              calls.push("mapping.count");
              return tx.diagnosticItemConceptEvidenceMapping.count(input);
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
        evidenceMappings: 2,
      },
      catalogTotals: {
        diagnosticItems: 1,
        evidenceMappings: 2,
      },
    });
    expect(calls).toEqual([
      "transaction:120000",
      "catalog.findUnique",
      "concept.findMany",
      "item.upsert",
      "mapping.deleteMany",
      "mapping.createMany",
      "catalog.update",
      "item.count",
      "mapping.count",
    ]);
  });
});
