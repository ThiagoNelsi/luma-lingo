import type { z } from "zod";

export interface StructuredOutputContract<T> {
  name: string;
  version: string;
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
}

export interface StructuredModelRun {
  adapter: string;
  latencyMs?: number;
  model: string;
  status: "queued" | "completed" | "pending" | "failed";
  reference: string;
  output?: string;
  errorCode?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface StructuredModelRequest<T> {
  correlation?: {
    attempt?: number;
    lessonId?: string;
    requestId?: string;
  };
  contract: StructuredOutputContract<T>;
  instructions: string;
  input: string;
  workload: "lesson_plan" | "lesson_block";
}

export interface StructuredModel {
  start<T>(request: StructuredModelRequest<T>): Promise<StructuredModelRun>;
  inspect(
    reference: string,
    correlation?: StructuredModelRequest<unknown>["correlation"],
  ): Promise<StructuredModelRun>;
}
