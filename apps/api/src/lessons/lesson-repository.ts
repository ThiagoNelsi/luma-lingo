import type { StructuredModelRun } from "../models/structured-model.js";
import type { LessonBlock, LessonPlan } from "./lesson-content.js";

export interface HomeLesson {
  id: string;
  status: "preparing" | "ready" | "failed";
  block: LessonBlock | null;
}

export interface LessonProgress {
  blocks: LessonBlock[];
  nextBlockStatus: "preparing" | "failed" | "complete";
}

export interface ReservedHomeLesson {
  lesson: HomeLesson;
  created: boolean;
  production: {
    moduleId: string;
    learningTrackId: string;
    priorityCompetencyId: string;
  };
}

export interface RetriedHomeLesson extends ReservedHomeLesson {
  priorityCompetencyKey: string;
}

export interface FirstLessonReservation {
  learnerId: string;
  learningTrackId: string;
  priorityCompetencyId: string;
  priorityCompetencyKey: string;
}

export interface PersistedRun {
  attempt: number;
  blockPosition: number;
  lessonId: string;
  run: StructuredModelRun;
}

export interface ActiveLessonBlockRun extends PersistedRun {
  context: {
    instructionLanguage: string;
    targetLanguage: string;
    primaryGoal: string;
    lessonEmphases: string[];
    priorityCompetencyKey: string;
  };
  plan: LessonPlan;
}

export interface LessonRepository {
  findHomeLesson(learnerId: string): Promise<HomeLesson | null>;
  findLessonProgress(
    learnerId: string,
    lessonId: string,
  ): Promise<LessonProgress | null>;
  reserveFirstLesson(
    input: FirstLessonReservation,
  ): Promise<ReservedHomeLesson>;
  retryFailedFirstLesson(learnerId: string): Promise<RetriedHomeLesson | null>;
  publishFirstBlock(input: {
    attempt: number;
    lessonId: string;
    plan: LessonPlan;
    block: LessonBlock;
    runs: {
      plan: StructuredModelRun;
      block: StructuredModelRun;
    };
  }): Promise<void>;
  claimQueuedBlockRun(input: Omit<PersistedRun, "run">): Promise<boolean>;
  persistBlockRun(input: PersistedRun): Promise<void>;
  publishBlockRun(input: PersistedRun & { block: LessonBlock }): Promise<void>;
  findActiveBlockRuns(): Promise<ActiveLessonBlockRun[]>;
  failLesson(lessonId: string, errorCode: string): Promise<void>;
}
