import { z } from "zod";

export interface StructuredOutputContract<T> {
  name: string;
  version: string;
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
}

export const structuredModelRunSchema = z
  .object({
    adapter: z.string(),
    latencyMs: z.number().nonnegative().optional(),
    model: z.string(),
    status: z.enum(["queued", "completed", "pending", "failed"]),
    reference: z.string(),
    output: z.string().optional(),
    errorCode: z.string().optional(),
    usage: z
      .object({
        inputTokens: z.number().int().nonnegative().optional(),
        outputTokens: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type StructuredModelRun = z.infer<typeof structuredModelRunSchema>;

export const structuredModelReadinessSchema = z
  .object({
    status: z.enum(["ready", "degraded"]),
    reason: z
      .enum(["invalid_workload_capability", "missing_credentials"])
      .optional(),
  })
  .strict();
export type StructuredModelReadiness = z.infer<
  typeof structuredModelReadinessSchema
>;

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
  readiness?(): StructuredModelReadiness;
  route?(
    workload: StructuredModelRequest<unknown>["workload"],
  ): Pick<StructuredModelRun, "adapter" | "model">;
  start<T>(request: StructuredModelRequest<T>): Promise<StructuredModelRun>;
  retry<T>(
    request: StructuredModelRequest<T>,
    pinned: Pick<StructuredModelRun, "adapter" | "model">,
  ): Promise<StructuredModelRun>;
  inspect(
    reference: string,
    correlation?: StructuredModelRequest<unknown>["correlation"],
    workload?: StructuredModelRequest<unknown>["workload"],
    pinned?: Pick<StructuredModelRun, "adapter" | "model">,
  ): Promise<StructuredModelRun>;
}
