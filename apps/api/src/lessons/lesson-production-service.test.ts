import { describe, expect, it, vi } from "vitest";

import type { StructuredModel } from "../models/structured-model.js";
import type { AppLogger } from "../observability/logger.js";
import type { LessonRepository } from "./lesson-repository.js";
import { LessonProductionService } from "./lesson-production-service.js";

describe("LessonProductionService", () => {
  it("publishes a validated first cohesive block for the reserved lesson", async () => {
    const saved: unknown[] = [];
    const repository: LessonRepository = {
      async findHomeLesson() {
        return null;
      },
      async findLessonBlock() {
        return null;
      },
      async reserveFirstLesson() {
        throw new Error("unused");
      },
      async retryFailedFirstLesson() {
        return null;
      },
      async publishFirstBlock(input) {
        saved.push(input);
      },
      async failLesson() {
        throw new Error("unused");
      },
    };
    const model: StructuredModel = {
      async start(input) {
        if (input.contract.name === "lesson_plan") {
          return completedRun({
            title: "Greetings for travel",
            objective: "Introduce yourself politely when arriving somewhere.",
            blocks: [
              {
                objective: "Say hello and share your name.",
                title: "Your first greeting",
              },
            ],
          });
        }

        return completedRun({
          title: "Your first greeting",
          objective: "Say hello and share your name.",
          explanation:
            "Use Hello to greet someone. Say My name is before your name.",
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
        });
      },
      async inspect() {
        throw new Error("unused");
      },
    };
    const service = new LessonProductionService({ model, repository });

    await service.produceFirstBlock({
      lesson: {
        id: "lesson-1",
        learningTrackId: "track-1",
        moduleId: "module-1",
        priorityCompetencyId: "competency-1",
      },
      context: {
        instructionLanguage: "Portuguese",
        targetLanguage: "English",
        primaryGoal: "travel",
        lessonEmphases: ["reading"],
        priorityCompetencyKey: "introduce-yourself",
      },
    });

    expect(saved).toEqual([
      expect.objectContaining({
        lessonId: "lesson-1",
        plan: expect.objectContaining({ title: "Greetings for travel" }),
        block: expect.objectContaining({
          explanation:
            "Use Hello to greet someone. Say My name is before your name.",
          activities: [expect.objectContaining({ type: "multiple_choice" })],
        }),
      }),
    ]);
  });

  it("logs a safe correlated error before marking a failed generation", async () => {
    const failLesson = vi.fn(async () => undefined);
    const error = vi.fn();
    const repository: LessonRepository = {
      async findHomeLesson() {
        return null;
      },
      async findLessonBlock() {
        return null;
      },
      async reserveFirstLesson() {
        throw new Error("unused");
      },
      async retryFailedFirstLesson() {
        return null;
      },
      async publishFirstBlock() {
        throw new Error("unused");
      },
      failLesson,
    };
    const service = new LessonProductionService({
      repository,
      model: {
        async start() {
          throw new Error("openai_request_failed");
        },
        async inspect() {
          throw new Error("unused");
        },
      },
      logger: { error } as unknown as AppLogger,
    });

    await service.produceFirstBlock({
      lesson: {
        id: "lesson-1",
        learningTrackId: "track-1",
        moduleId: "module-1",
        priorityCompetencyId: "competency-1",
      },
      context: {
        instructionLanguage: "Portuguese",
        targetLanguage: "English",
        primaryGoal: "travel",
        lessonEmphases: ["reading"],
        priorityCompetencyKey: "introduce-yourself",
      },
      correlationId: "request-1",
      attempt: 2,
    });

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 2,
        category: "provider",
        errorCode: "openai_request_failed",
        event: "lesson_generation.failed",
        lessonId: "lesson-1",
        requestId: "request-1",
        stage: "lesson_plan",
      }),
      "Lesson generation failed",
    );
    expect(failLesson).toHaveBeenCalledWith(
      "lesson-1",
      "openai_request_failed",
    );
  });
});

function completedRun(output: unknown) {
  return {
    adapter: "test",
    model: "test-model",
    status: "completed" as const,
    reference: "provider-run-1",
    output: JSON.stringify(output),
  };
}
