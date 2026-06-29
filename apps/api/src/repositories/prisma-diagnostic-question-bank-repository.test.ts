import { describe, expect, it, vi } from "vitest";

import { PrismaDiagnosticQuestionBankRepository } from "./prisma-diagnostic-question-bank-repository.js";

describe("PrismaDiagnosticQuestionBankRepository", () => {
  it("reads the published onboarding question bank deterministically", async () => {
    const publishedAt = new Date("2026-06-28T12:00:00.000Z");
    const competencyCatalog = {
      findFirst: vi.fn(async () => ({
        id: "catalog-1",
        targetLanguage: "en",
        version: "2026-06-28-draft",
        status: "published",
        publishedAt,
        diagnosticItems: [
          buildDiagnosticItemRow({
            id: "item-2",
            key: "en.diag.pre-a1.be-present.foundation.001",
            primaryCompetencyId: "competency-2",
            primaryCompetencyKey: "pre-a1-core-be-present-affirmative",
          }),
          buildDiagnosticItemRow({
            id: "item-1",
            key: "en.diag.pre-a1.subject-pronouns.foundation.001",
            primaryCompetencyId: "competency-1",
            primaryCompetencyKey: "pre-a1-core-subject-pronouns",
          }),
        ],
      })),
    };
    const repository = new PrismaDiagnosticQuestionBankRepository({
      competencyCatalog,
    } as never);

    await expect(
      repository.findPublishedOnboardingQuestionBank("en"),
    ).resolves.toMatchObject({
      catalog: {
        id: "catalog-1",
        targetLanguage: "en",
        version: "2026-06-28-draft",
        status: "published",
      },
      items: [
        {
          id: "item-2",
          key: "en.diag.pre-a1.be-present.foundation.001",
          primaryCompetencyKey: "pre-a1-core-be-present-affirmative",
          targets: [
            {
              competencyId: "competency-2",
              competencyKey: "pre-a1-core-be-present-affirmative",
              role: "primary",
              weight: 100,
            },
          ],
        },
        {
          id: "item-1",
          key: "en.diag.pre-a1.subject-pronouns.foundation.001",
          primaryCompetencyKey: "pre-a1-core-subject-pronouns",
          targets: [
            {
              competencyId: "competency-1",
              competencyKey: "pre-a1-core-subject-pronouns",
              role: "primary",
              weight: 100,
            },
          ],
        },
      ],
    });
    expect(competencyCatalog.findFirst).toHaveBeenCalledWith({
      where: {
        targetLanguage: "en",
        status: "published",
      },
      orderBy: [
        {
          publishedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      include: {
        diagnosticItems: {
          where: {
            status: "published",
          },
          orderBy: {
            key: "asc",
          },
          include: {
            primaryCompetency: {
              select: {
                id: true,
                key: true,
              },
            },
            competencyTargets: {
              include: {
                competency: {
                  select: {
                    id: true,
                    key: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  });

  it("returns null when no published catalog exists", async () => {
    const repository = new PrismaDiagnosticQuestionBankRepository({
      competencyCatalog: {
        findFirst: vi.fn(async () => null),
      },
    } as never);

    await expect(
      repository.findPublishedOnboardingQuestionBank("en"),
    ).resolves.toBeNull();
  });
});

function buildDiagnosticItemRow(input: {
  id: string;
  key: string;
  primaryCompetencyId: string;
  primaryCompetencyKey: string;
}) {
  return {
    id: input.id,
    key: input.key,
    primaryCompetencyId: input.primaryCompetencyId,
    difficultyBand: "Pre-A1",
    responseFormat: "multiple_choice",
    status: "published",
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
    details: {
      schemaVersion: 1,
      diagnosticRoles: ["foundation"],
      rationale: "Checks a foundational diagnostic item.",
      safetyNotes: [],
      localizationNotes: [],
      distractorRationale: {
        option_he: "Selects a masculine pronoun for Maria.",
      },
    },
    reviewedAt: new Date("2026-06-28T11:00:00.000Z"),
    publishedAt: new Date("2026-06-28T12:00:00.000Z"),
    primaryCompetency: {
      id: input.primaryCompetencyId,
      key: input.primaryCompetencyKey,
    },
    competencyTargets: [
      {
        diagnosticItemId: input.id,
        competencyId: input.primaryCompetencyId,
        role: "primary",
        weight: 100,
        details: {
          schemaVersion: 1,
        },
        competency: {
          id: input.primaryCompetencyId,
          key: input.primaryCompetencyKey,
        },
      },
    ],
  };
}
