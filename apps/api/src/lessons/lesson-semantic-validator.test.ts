import { describe, expect, it } from "vitest";

import type { LessonBlock, LessonPlan } from "./lesson-content.js";
import {
  LessonSemanticValidationError,
  lessonValidationContextSchema,
  validateLessonBlockSemantics,
  validateLessonPlanSemantics,
  type LessonValidationContext,
} from "./lesson-semantic-validator.js";

const context: LessonValidationContext = {
  instructionLanguage: "pt-BR",
  targetLanguage: "en",
  primaryGoal: "travel",
  lessonEmphases: ["reading", "writing"],
  priorityCompetencyKey: "situational.greetings",
  learnerAgeRange: "25-39",
  profileTopics: ["software", "music"],
  competencyProfile: [
    {
      competencyKey: "situational.greetings",
      abilityEstimate: 0.2,
      confidence: 0.8,
    },
  ],
};

describe("lessonValidationContextSchema", () => {
  it("accepts only MVP Goals and Lesson emphases", () => {
    expect(
      lessonValidationContextSchema.safeParse({
        ...context,
        primaryGoal: "exam_prep",
      }).success,
    ).toBe(false);
    expect(
      lessonValidationContextSchema.safeParse({
        ...context,
        lessonEmphases: ["speaking"],
      }).success,
    ).toBe(false);
  });
});

describe("validateLessonPlanSemantics", () => {
  it("accepts a plan aligned to the selected priority and confirmed context", () => {
    expect(() => validateLessonPlanSemantics(plan(), context)).not.toThrow();
  });

  it.each([
    ["priorityCompetencyKey", "situational.shopping", "curricular_alignment"],
    ["primaryGoal", "work", "goal_alignment"],
    ["instructionLanguage", "es", "language_alignment"],
    ["targetLanguage", "fr", "language_alignment"],
  ] as const)(
    "rejects mismatched %s metadata",
    (field, value, expectedReason) => {
      const candidate = plan();
      candidate.alignment = { ...candidate.alignment!, [field]: value };

      expect(() =>
        validateLessonPlanSemantics(candidate, context),
      ).toThrowError(
        expect.objectContaining<Partial<LessonSemanticValidationError>>({
          code: "lesson_semantic_rejected",
          reason: expectedReason,
        }),
      );
    },
  );

  it("rejects profile topics that were not confirmed by the learner", () => {
    const candidate = plan();
    candidate.alignment!.profileTopics = ["politics"];

    expect(() => validateLessonPlanSemantics(candidate, context)).toThrowError(
      expect.objectContaining<Partial<LessonSemanticValidationError>>({
        reason: "profile_alignment",
      }),
    );
  });

  it("rejects a plan calibrated against a different competency estimate", () => {
    const candidate = plan();
    candidate.alignment!.priorityCompetencyState = {
      abilityEstimate: 0.9,
      confidence: 0.8,
    };

    expect(() => validateLessonPlanSemantics(candidate, context)).toThrowError(
      expect.objectContaining<Partial<LessonSemanticValidationError>>({
        reason: "curricular_alignment",
      }),
    );
  });

  it("does not treat private alignment metadata as published Lesson content", () => {
    const candidate = plan();
    candidate.alignment!.profileTopics = ["violent video games"];
    candidate.objective += " Talk briefly about games.";

    expect(() =>
      validateLessonPlanSemantics(candidate, {
        ...context,
        profileTopics: ["violent video games"],
      }),
    ).not.toThrow();
  });

  it("leaves age-sensitive topic classification to the moderation boundary", () => {
    const candidate = plan();
    candidate.objective = "Discuss gambling vocabulary while travelling.";

    expect(() =>
      validateLessonPlanSemantics(candidate, {
        ...context,
        learnerAgeRange: "under_13",
      }),
    ).not.toThrow();
  });

  it("requires selected emphases to prevail across the plan", () => {
    const candidate = plan();
    candidate.blocks = candidate.blocks.map((block) => ({
      ...block,
      emphasis: "reading",
    }));

    expect(() => validateLessonPlanSemantics(candidate, context)).toThrowError(
      expect.objectContaining<Partial<LessonSemanticValidationError>>({
        reason: "emphasis_alignment",
      }),
    );
  });

  it.each([
    "A violent knife attack is your lesson scenario.",
    "Adult sexual roleplay vocabulary.",
    "A racist insult is the central example.",
  ])(
    "leaves unsafe plan classification to the moderation boundary",
    (objective) => {
      const candidate = plan();
      candidate.objective = `${objective} while travelling.`;

      expect(() =>
        validateLessonPlanSemantics(candidate, context),
      ).not.toThrow();
    },
  );

  it("rejects learner-facing CEFR claims", () => {
    const candidate = plan();
    candidate.title = "Reach CEFR A1 today";

    expect(() => validateLessonPlanSemantics(candidate, context)).toThrowError(
      expect.objectContaining<Partial<LessonSemanticValidationError>>({
        reason: "unsupported_content",
      }),
    );
  });

  it("rejects a plan whose visible content does not match the learner goal", () => {
    const candidate = plan();
    candidate.title = "Spreadsheet formulas";
    candidate.objective = "Calculate totals and format a financial report.";

    expect(() => validateLessonPlanSemantics(candidate, context)).toThrowError(
      expect.objectContaining<Partial<LessonSemanticValidationError>>({
        reason: "goal_alignment",
      }),
    );
  });

  it("accepts a confirmed profile topic without requiring literal word overlap", () => {
    const candidate = plan();
    candidate.alignment!.profileTopics = ["music"];

    expect(() => validateLessonPlanSemantics(candidate, context)).not.toThrow();
  });

  it("accepts exact priority metadata without requiring the catalog key in learner-facing text", () => {
    const candidate = plan();
    candidate.title = "Introductions for travel";
    candidate.objective =
      "Introduce yourself to a software colleague while travelling.";

    expect(() => validateLessonPlanSemantics(candidate, context)).not.toThrow();
  });
});

describe("validateLessonBlockSemantics", () => {
  it("accepts a safe coherent block from the immutable plan", () => {
    expect(() =>
      validateLessonBlockSemantics(
        plan(),
        block(),
        plan().blocks[0]!.objective,
        context,
      ),
    ).not.toThrow();
  });

  it("rejects a block that drifts from its planned objective", () => {
    expect(() =>
      validateLessonBlockSemantics(
        plan(),
        { ...block(), objective: "Order food." },
        plan().blocks[0]!.objective,
        context,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<LessonSemanticValidationError>>({
        reason: "curricular_alignment",
      }),
    );
  });

  it("leaves unsafe block classification to the moderation boundary", () => {
    const candidate = block();
    candidate.activities[0] = {
      ...candidate.activities[0]!,
      prompt: "Choose the racist insult.",
    };

    expect(() =>
      validateLessonBlockSemantics(
        plan(),
        candidate,
        plan().blocks[0]!.objective,
        context,
      ),
    ).not.toThrow();
  });

  it("rejects unsupported links, markup, and speaking instructions", () => {
    const candidate = block();
    candidate.explanation = "Record your voice at https://unsafe.example.";

    expect(() =>
      validateLessonBlockSemantics(
        plan(),
        candidate,
        plan().blocks[0]!.objective,
        context,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<LessonSemanticValidationError>>({
        reason: "unsupported_content",
      }),
    );
  });

  it("rejects incoherent example language pairs", () => {
    const candidate = block();
    candidate.examples = [{ target: "Hello!", instruction: "Hello!" }];

    expect(() =>
      validateLessonBlockSemantics(
        plan(),
        candidate,
        plan().blocks[0]!.objective,
        context,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<LessonSemanticValidationError>>({
        reason: "language_alignment",
      }),
    );
  });

  it("rejects example text in a language other than the selected pair", () => {
    const candidate = block();
    candidate.examples = [
      {
        target: "Bonjour, mon nom est Ana.",
        instruction: "Hola, mi nombre es Ana.",
      },
    ];

    expect(() =>
      validateLessonBlockSemantics(
        plan(),
        candidate,
        plan().blocks[0]!.objective,
        context,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<LessonSemanticValidationError>>({
        reason: "language_alignment",
      }),
    );
  });

  it("rejects content unrelated to the immutable block objective", () => {
    const candidate = block();
    candidate.explanation = "Use plus and minus to calculate a total.";
    candidate.examples = [
      { target: "Two plus two", instruction: "Dois mais dois" },
    ];
    candidate.activities = [
      {
        type: "multiple_choice",
        prompt: "Choose the correct total.",
        options: ["Four", "Five"],
        correctOptionIndex: 0,
        explanation: "Two plus two is four.",
      },
    ];

    expect(() =>
      validateLessonBlockSemantics(
        plan(),
        candidate,
        plan().blocks[0]!.objective,
        context,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<LessonSemanticValidationError>>({
        reason: "curricular_alignment",
      }),
    );
  });

  it("rejects practice that does not implement the planned emphasis", () => {
    const candidate = block();
    candidate.activities = [
      {
        type: "fill_blank",
        prompt: "Complete: ___! My name is Ana.",
        answer: "Hello",
        explanation: "Hello is a greeting.",
      },
    ];

    expect(() =>
      validateLessonBlockSemantics(
        plan(),
        candidate,
        plan().blocks[0]!.objective,
        context,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<LessonSemanticValidationError>>({
        reason: "emphasis_alignment",
      }),
    );
  });

  it("rejects an incoherent practice volume unsupported by its examples", () => {
    const candidate = block();
    candidate.activities = Array.from({ length: 4 }, (_, index) => ({
      type: "multiple_choice" as const,
      prompt: `Choose greeting ${index + 1}.`,
      options: ["Hello!", "Thank you."],
      correctOptionIndex: 0,
      explanation: "Hello is a greeting.",
    }));

    expect(() =>
      validateLessonBlockSemantics(
        plan(),
        candidate,
        plan().blocks[0]!.objective,
        context,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<LessonSemanticValidationError>>({
        reason: "practice_volume",
      }),
    );
  });

  it.each([
    "Pornografia explícita como tema da aula.",
    "Practica cómo asesinar con un arma.",
    "Discours raciste et discriminatoire.",
    "Übe Selbstmord und Selbstverletzung.",
    "学习暴力、色情和自杀词汇。",
  ])(
    "leaves multilingual unsafe classification to moderation",
    (explanation) => {
      const candidate = block();
      candidate.explanation = explanation;

      expect(() =>
        validateLessonBlockSemantics(
          plan(),
          candidate,
          plan().blocks[0]!.objective,
          context,
        ),
      ).not.toThrow();
    },
  );
});

function plan(): LessonPlan {
  return {
    title: "Greetings for travel",
    objective:
      "Greet a software colleague and introduce yourself while travelling.",
    alignment: {
      instructionLanguage: "pt-BR",
      targetLanguage: "en",
      primaryGoal: "travel",
      priorityCompetencyKey: "situational.greetings",
      priorityCompetencyState: {
        abilityEstimate: 0.2,
        confidence: 0.8,
      },
      lessonEmphases: ["reading", "writing"],
      profileTopics: ["software"],
    },
    blocks: [
      {
        title: "Your first greeting",
        objective: "Say hello and share your name.",
        emphasis: "reading",
      },
      {
        title: "Ask a name",
        objective: "Ask another person's name.",
        emphasis: "writing",
      },
      {
        title: "Finish politely",
        objective: "End a short introduction politely.",
        emphasis: "reading",
      },
    ],
  };
}

function block(): LessonBlock {
  return {
    title: "Your first greeting",
    objective: "Say hello and share your name.",
    explanation: "Use Hello to greet someone. Say My name is before your name.",
    examples: [
      {
        target: "Hello! My name is Ana.",
        instruction: "Olá! Meu nome é Ana.",
      },
    ],
    activities: [
      {
        type: "multiple_choice",
        prompt: "Choose the greeting.",
        options: ["Hello!", "Thank you."],
        correctOptionIndex: 0,
        explanation: "Hello is a greeting.",
      },
    ],
  };
}
