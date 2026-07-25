import type { LessonBlock, LessonPlan } from "./lesson-content.js";

export interface HomeLesson {
  id: string;
  status: "preparing" | "ready" | "failed";
  block: LessonBlock | null;
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

export interface LessonRepository {
  findHomeLesson(learnerId: string): Promise<HomeLesson | null>;
  findLessonBlock(
    learnerId: string,
    lessonId: string,
  ): Promise<LessonBlock | null>;
  reserveFirstLesson(
    input: FirstLessonReservation,
  ): Promise<ReservedHomeLesson>;
  retryFailedFirstLesson(learnerId: string): Promise<RetriedHomeLesson | null>;
  publishFirstBlock(input: {
    lessonId: string;
    plan: LessonPlan;
    block: LessonBlock;
    runs: {
      plan: { reference: string; adapter: string; model: string };
      block: { reference: string; adapter: string; model: string };
    };
  }): Promise<void>;
  failLesson(lessonId: string, errorCode: string): Promise<void>;
}
