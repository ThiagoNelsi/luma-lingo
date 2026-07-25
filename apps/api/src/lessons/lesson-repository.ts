import { z } from "zod";

import {
  structuredModelRunSchema,
  type StructuredModelRun,
} from "../models/structured-model.js";
import {
  lessonPlanSchema,
  type LessonBlock,
  type LessonPlan,
} from "./lesson-content.js";
import {
  lessonValidationContextSchema,
  type LessonValidationContext,
} from "./lesson-semantic-validator.js";

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

export interface FirstLessonReservation {
  learnerId: string;
  learningTrackId: string;
  priorityCompetencyId: string;
  priorityCompetencyKey: string;
}

export const persistedRunSchema = z
  .object({
    attempt: z.number().int().positive(),
    blockPosition: z.number().int().nonnegative(),
    lessonId: z.string().min(1),
    run: structuredModelRunSchema,
  })
  .strict();
export type PersistedRun = z.infer<typeof persistedRunSchema>;

export const activeLessonBlockRunSchema = persistedRunSchema
  .extend({
    context: lessonValidationContextSchema,
    plan: lessonPlanSchema,
  })
  .strict();
export type ActiveLessonBlockRun = z.infer<typeof activeLessonBlockRunSchema>;

export const reservedLessonProductionSchema = z
  .object({
    id: z.string().min(1),
    learningTrackId: z.string().min(1),
    moduleId: z.string().min(1),
    priorityCompetencyId: z.string().min(1),
  })
  .strict();
export type ReservedLessonProduction = z.infer<
  typeof reservedLessonProductionSchema
>;

export const activeLessonPlanRunSchema = z
  .object({
    attempt: z.number().int().positive(),
    context: lessonValidationContextSchema,
    lesson: reservedLessonProductionSchema,
    run: structuredModelRunSchema,
  })
  .strict();
export type ActiveLessonPlanRun = z.infer<typeof activeLessonPlanRunSchema>;

export const retryableLessonWorkSchema = z
  .object({
    lesson: reservedLessonProductionSchema,
    context: lessonValidationContextSchema,
    plan: lessonPlanSchema.nullable(),
    planAttempt: z.number().int().positive(),
    blocks: z.array(
      z
        .object({
          attempt: z.number().int().positive(),
          blockPosition: z.number().int().nonnegative(),
        })
        .strict(),
    ),
  })
  .strict();
export type RetryableLessonWork = z.infer<typeof retryableLessonWorkSchema>;

export interface LessonRepository {
  findLessonValidationContext?(
    lessonId: string,
  ): Promise<LessonValidationContext | null>;
  findHomeLesson(learnerId: string): Promise<HomeLesson | null>;
  findLessonProgress(
    learnerId: string,
    lessonId: string,
  ): Promise<LessonProgress | null>;
  reserveFirstLesson(
    input: FirstLessonReservation,
  ): Promise<ReservedHomeLesson>;
  prepareLessonRetry?(
    learnerId: string,
    lessonId: string,
  ): Promise<RetryableLessonWork | null>;
  persistPlanRun(input: {
    attempt: number;
    lessonId: string;
    plan?: LessonPlan;
    run: StructuredModelRun;
  }): Promise<void>;
  publishFirstBlock(input: {
    attempt: number;
    lessonId: string;
    plan: LessonPlan;
    block: LessonBlock;
    runs: {
      plan: { attempt: number; run: StructuredModelRun };
      block: { attempt: number; run: StructuredModelRun };
    };
  }): Promise<void>;
  claimQueuedBlockRun(input: Omit<PersistedRun, "run">): Promise<boolean>;
  persistBlockRun(input: PersistedRun): Promise<void>;
  publishBlockRun(input: PersistedRun & { block: LessonBlock }): Promise<void>;
  findActivePlanRuns(): Promise<ActiveLessonPlanRun[]>;
  findActiveBlockRuns(): Promise<ActiveLessonBlockRun[]>;
  failLesson(lessonId: string, errorCode: string): Promise<void>;
}
