import type { InitialLearningPriorityRepository } from "../learning/initial-learning-priority-repository.js";
import {
  createSilentLogger,
  errorMetadata,
  type AppLogger,
} from "../observability/logger.js";
import type { LessonProductionService } from "./lesson-production-service.js";
import type { HomeLesson, LessonRepository } from "./lesson-repository.js";
import { lessonValidationContextSchema } from "./lesson-semantic-validator.js";

export type HomeResult =
  | { status: "preparing"; lessonId: string }
  | { status: "failed"; lessonId: string }
  | {
      status: "ready";
      lessonId: string;
      block: NonNullable<HomeLesson["block"]>;
    };

export type LessonResult = {
  lessonId: string;
  blocks: NonNullable<HomeLesson["block"]>[];
  nextBlockStatus: "preparing" | "failed" | "complete";
};

interface HomeInput {
  correlationId?: string;
  learnerId: string;
  instructionLanguage: string | null;
  learningTrack: {
    id: string;
    targetLanguage: string;
    learningGoal: string | null;
    lessonEmphases: string[];
    onboardingStartingPoint: "beginner" | "diagnostic" | null;
    onboardingStatus: string;
  } | null;
}

export class HomeService {
  private readonly logger: AppLogger;

  constructor(
    private readonly deps: {
      lessons: LessonRepository;
      priorities: InitialLearningPriorityRepository;
      production: Pick<
        LessonProductionService,
        "produceFirstBlock" | "retryFailedWork"
      >;
      foregroundBudgetMs: number;
      logger?: AppLogger;
    },
  ) {
    this.logger = deps.logger ?? createSilentLogger();
  }

  async getHome(input: HomeInput): Promise<HomeResult> {
    try {
      const result = await this.resolveHome(input);
      this.logger.debug(
        {
          event: "first_lesson.home_resolved",
          learnerId: input.learnerId,
          lessonId: result.lessonId,
          requestId: input.correlationId,
          status: result.status,
        },
        "First Lesson Home resolved",
      );
      return result;
    } catch (error) {
      this.logger.error(
        {
          err: errorMetadata(error),
          category: lessonErrorCategory(error),
          event: "first_lesson.home_failed",
          learnerId: input.learnerId,
          learningTrackId: input.learningTrack?.id,
          requestId: input.correlationId,
          ...errorMetadata(error),
        },
        "First Lesson Home failed",
      );
      throw error;
    }
  }

  private async resolveHome(input: HomeInput): Promise<HomeResult> {
    const existing = await this.deps.lessons.findHomeLesson(input.learnerId);
    if (existing) return toHomeResult(existing);

    const context = requireReadyContext(input);
    const priority = await this.deps.priorities.findInitialLearningPriority({
      learningTrackId: context.learningTrack.id,
      onboardingStartingPoint: context.learningTrack.onboardingStartingPoint,
    });
    if (!priority) throw new Error("initial_learning_priority_required");

    const reserved = await this.deps.lessons.reserveFirstLesson({
      learnerId: input.learnerId,
      learningTrackId: context.learningTrack.id,
      priorityCompetencyId: priority.competencyId,
      priorityCompetencyKey: priority.competencyKey,
      prioritySelectionTrace: priority,
    });
    if (!reserved.created) return toHomeResult(reserved.lesson);

    this.logger.info(
      {
        attempt: 1,
        event: "first_lesson.generation_started",
        learnerId: input.learnerId,
        learningTrackId: context.learningTrack.id,
        lessonId: reserved.lesson.id,
        requestId: input.correlationId,
      },
      "First Lesson generation started",
    );
    return this.startProduction(
      { ...reserved, priorityCompetencyKey: priority.competencyKey },
      context,
      input.learnerId,
      input.correlationId,
      1,
    );
  }

  private async startProduction(
    reserved: {
      lesson: HomeLesson;
      production: {
        moduleId: string;
        learningTrackId: string;
        priorityCompetencyId: string;
      };
      priorityCompetencyKey: string;
    },
    context: ReturnType<typeof requireReadyContext>,
    learnerId: string,
    correlationId: string | undefined,
    attempt: number,
  ): Promise<HomeResult> {
    const production = this.deps.production.produceFirstBlock({
      lesson: {
        id: reserved.lesson.id,
        learningTrackId: reserved.production.learningTrackId,
        moduleId: reserved.production.moduleId,
        priorityCompetencyId: reserved.production.priorityCompetencyId,
      },
      context: lessonValidationContextSchema.parse({
        instructionLanguage: context.instructionLanguage,
        targetLanguage: context.learningTrack.targetLanguage,
        primaryGoal: context.learningTrack.learningGoal,
        lessonEmphases: context.learningTrack.lessonEmphases,
        priorityCompetencyKey: reserved.priorityCompetencyKey,
      }),
      correlationId,
      attempt,
    });

    if (this.deps.foregroundBudgetMs > 0) {
      await awaitWithinBudget(production, this.deps.foregroundBudgetMs);
      const updated = await this.deps.lessons.findHomeLesson(learnerId);
      if (updated) return toHomeResult(updated);
    } else {
      void production;
    }

    return toHomeResult(reserved.lesson);
  }

  async getLesson(
    learnerId: string,
    lessonId: string,
  ): Promise<LessonResult | null> {
    const progress = await this.deps.lessons.findLessonProgress(
      learnerId,
      lessonId,
    );
    return progress ? { lessonId, ...progress } : null;
  }

  async retryLesson(
    learnerId: string,
    lessonId: string,
    correlationId?: string,
  ): Promise<boolean> {
    const accepted = await this.deps.production.retryFailedWork(
      learnerId,
      lessonId,
      correlationId,
    );
    if (accepted) {
      this.logger.warn(
        {
          event: "lesson_generation.manual_retry_requested",
          learnerId,
          lessonId,
          requestId: correlationId,
        },
        "Lesson generation manual retry requested",
      );
    }
    return accepted;
  }
}

function lessonErrorCategory(error: unknown): string {
  if (!(error instanceof Error)) return "unexpected";
  if (error.message === "initial_learning_priority_required") {
    return "learning_priority";
  }
  if (error.message === "completed_onboarding_required") return "onboarding";
  return "unexpected";
}

function requireReadyContext(input: HomeInput): {
  instructionLanguage: string;
  learningTrack: {
    id: string;
    targetLanguage: string;
    learningGoal: string;
    lessonEmphases: string[];
    onboardingStartingPoint: "beginner" | "diagnostic";
  };
} {
  if (
    !input.instructionLanguage ||
    !input.learningTrack ||
    input.learningTrack.onboardingStatus !== "completed" ||
    !input.learningTrack.learningGoal ||
    !input.learningTrack.onboardingStartingPoint
  ) {
    throw new Error("completed_onboarding_required");
  }
  return {
    instructionLanguage: input.instructionLanguage,
    learningTrack: {
      ...input.learningTrack,
      learningGoal: input.learningTrack.learningGoal,
      onboardingStartingPoint: input.learningTrack.onboardingStartingPoint,
    },
  };
}

function toHomeResult(lesson: HomeLesson): HomeResult {
  if (lesson.status === "ready" && lesson.block) {
    return { status: "ready", lessonId: lesson.id, block: lesson.block };
  }
  if (lesson.status === "failed") {
    return { status: "failed", lessonId: lesson.id };
  }
  return { status: "preparing", lessonId: lesson.id };
}

async function awaitWithinBudget(
  production: Promise<void>,
  budgetMs: number,
): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      production,
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, budgetMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
