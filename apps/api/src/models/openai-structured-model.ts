import {
  createSilentLogger,
  errorMetadata,
  type AppLogger,
} from "../observability/logger.js";
import type {
  StructuredModel,
  StructuredModelRequest,
  StructuredModelReadiness,
  StructuredModelRun,
} from "./structured-model.js";

interface OpenAiResponse {
  id?: string;
  model?: string;
  status?: string;
  error?: { code?: string } | null;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class OpenAiStructuredModelError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode?: number,
    readonly providerCode?: string,
    readonly providerType?: string,
    readonly providerParam?: string,
  ) {
    super(code);
    this.name = "OpenAiStructuredModelError";
  }
}

export class OpenAiStructuredModel implements StructuredModel {
  private readonly fetch: typeof globalThis.fetch;
  private readonly logger: AppLogger;

  constructor(
    private readonly config: {
      apiKey?: string;
      model?: string;
      models?: Record<"lesson_plan" | "lesson_block", string>;
      fetch?: typeof globalThis.fetch;
    },
    logger: AppLogger = createSilentLogger(),
  ) {
    this.fetch = config.fetch ?? globalThis.fetch;
    this.logger = logger;
  }

  readiness(): StructuredModelReadiness {
    if (!this.config.apiKey) {
      return { status: "degraded", reason: "missing_credentials" };
    }
    if (
      (!this.config.models?.lesson_plan && !this.config.model) ||
      (!this.config.models?.lesson_block && !this.config.model)
    ) {
      return {
        status: "degraded",
        reason: "invalid_workload_capability",
      };
    }
    return { status: "ready" };
  }

  async start<T>(
    request: StructuredModelRequest<T>,
  ): Promise<StructuredModelRun> {
    return this.startWithModel(request, this.modelFor(request.workload));
  }

  route(
    workload: StructuredModelRequest<unknown>["workload"],
  ): Pick<StructuredModelRun, "adapter" | "model"> {
    return { adapter: "openai", model: this.modelFor(workload) };
  }

  async retry<T>(
    request: StructuredModelRequest<T>,
    pinned: Pick<StructuredModelRun, "adapter" | "model">,
  ): Promise<StructuredModelRun> {
    if (pinned.adapter !== "openai" || !pinned.model) {
      throw new OpenAiStructuredModelError("openai_pinned_route_invalid");
    }
    return this.startWithModel(request, pinned.model);
  }

  private async startWithModel<T>(
    request: StructuredModelRequest<T>,
    model: string,
  ): Promise<StructuredModelRun> {
    if (!this.config.apiKey) {
      throw new OpenAiStructuredModelError("openai_api_key_required");
    }
    const startedAt = performance.now();
    try {
      const response = await this.fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          instructions: request.instructions,
          input: request.input,
          store: true,
          reasoning: { effort: reasoningEffortFor(request.workload) },
          text: {
            format: {
              type: "json_schema",
              name: request.contract.name,
              strict: true,
              schema: request.contract.jsonSchema,
            },
          },
        }),
      });
      if (!response.ok) {
        const providerError = await readProviderError(response);
        throw new OpenAiStructuredModelError(
          "openai_request_failed",
          response.status,
          providerError.code,
          providerError.type,
          providerError.param,
        );
      }
      const run = toRun((await response.json()) as OpenAiResponse, model);
      this.logCompletedOperation({
        ...request.correlation,
        durationMs: Math.round(performance.now() - startedAt),
        model,
        operation: "responses.create",
        inputTokens: run.usage?.inputTokens,
        outputTokens: run.usage?.outputTokens,
        purpose: request.workload,
        runStatus: run.status,
        statusCode: response.status,
        workload: request.workload,
      });
      return run;
    } catch (error) {
      this.logFailedOperation(error, {
        ...request.correlation,
        durationMs: Math.round(performance.now() - startedAt),
        model,
        operation: "responses.create",
        purpose: request.workload,
        workload: request.workload,
      });
      throw error;
    }
  }

  async inspect(
    reference: string,
    correlation?: StructuredModelRequest<unknown>["correlation"],
    workload: StructuredModelRequest<unknown>["workload"] = "lesson_block",
    pinned?: Pick<StructuredModelRun, "adapter" | "model">,
  ): Promise<StructuredModelRun> {
    if (!this.config.apiKey) {
      throw new OpenAiStructuredModelError("openai_api_key_required");
    }
    const fallbackModel =
      pinned?.model ??
      this.config.models?.[workload] ??
      this.config.model ??
      "unavailable";
    const startedAt = performance.now();
    try {
      const response = await this.fetch(
        `https://api.openai.com/v1/responses/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${this.config.apiKey}` } },
      );
      if (!response.ok) {
        const providerError = await readProviderError(response);
        throw new OpenAiStructuredModelError(
          "openai_inspection_failed",
          response.status,
          providerError.code,
          providerError.type,
          providerError.param,
        );
      }
      const run = toRun(
        (await response.json()) as OpenAiResponse,
        fallbackModel,
      );
      this.logCompletedOperation({
        ...correlation,
        durationMs: Math.round(performance.now() - startedAt),
        model: run.model,
        operation: "responses.retrieve",
        inputTokens: run.usage?.inputTokens,
        outputTokens: run.usage?.outputTokens,
        purpose: workload,
        runStatus: run.status,
        statusCode: response.status,
      });
      return run;
    } catch (error) {
      this.logFailedOperation(error, {
        ...correlation,
        durationMs: Math.round(performance.now() - startedAt),
        model: fallbackModel,
        operation: "responses.retrieve",
        purpose: workload,
      });
      throw error;
    }
  }

  private modelFor(workload: "lesson_plan" | "lesson_block"): string {
    const model = this.config.models?.[workload] ?? this.config.model;
    if (!model) throw new OpenAiStructuredModelError("openai_model_required");
    return model;
  }

  private logCompletedOperation(fields: {
    attempt?: number;
    durationMs: number;
    inputTokens?: number;
    lessonId?: string;
    model: string;
    operation: string;
    outputTokens?: number;
    purpose?: string;
    requestId?: string;
    runStatus: StructuredModelRun["status"];
    statusCode: number;
    workload?: string;
  }): void {
    this.logger.info(
      {
        ...fields,
        event: "openai.structured_output.completed",
        provider: "openai",
      },
      "OpenAI structured-output operation completed",
    );
  }

  private logFailedOperation(
    error: unknown,
    fields: {
      attempt?: number;
      durationMs: number;
      lessonId?: string;
      model: string;
      operation: string;
      purpose?: string;
      requestId?: string;
      workload?: string;
    },
  ): void {
    this.logger.error(
      {
        ...fields,
        err: errorMetadata(error),
        event: "openai.structured_output.failed",
        provider: "openai",
        providerCode:
          error instanceof OpenAiStructuredModelError
            ? error.providerCode
            : undefined,
        providerParam:
          error instanceof OpenAiStructuredModelError
            ? error.providerParam
            : undefined,
        providerType:
          error instanceof OpenAiStructuredModelError
            ? error.providerType
            : undefined,
        statusCode:
          error instanceof OpenAiStructuredModelError
            ? error.statusCode
            : undefined,
        ...errorMetadata(error),
      },
      "OpenAI structured-output operation failed",
    );
  }
}

async function readProviderError(response: Response): Promise<{
  code?: string;
  param?: string;
  type?: string;
}> {
  try {
    const body = (await response.json()) as {
      error?: { code?: unknown; param?: unknown; type?: unknown };
    };
    return {
      code: safeProviderField(body.error?.code),
      param: safeProviderField(body.error?.param),
      type: safeProviderField(body.error?.type),
    };
  } catch {
    return {};
  }
}

function safeProviderField(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_.[\]-]{1,120}$/.test(value)) {
    return undefined;
  }
  return value;
}

function toRun(response: OpenAiResponse, model: string): StructuredModelRun {
  if (!response.id) throw new OpenAiStructuredModelError("openai_missing_id");
  const resolvedModel = response.model ?? model;
  const refusal = response.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "refusal")?.refusal;
  if (refusal) {
    return {
      adapter: "openai",
      model: resolvedModel,
      status: "failed",
      reference: response.id,
      errorCode: "openai_refusal",
      usage: usageFrom(response),
    };
  }
  if (response.status === "completed") {
    const output = response.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text")?.text;
    if (!output) {
      return {
        adapter: "openai",
        model: resolvedModel,
        status: "failed",
        reference: response.id,
        errorCode: "openai_empty_output",
        usage: usageFrom(response),
      };
    }
    return {
      adapter: "openai",
      model: resolvedModel,
      status: "completed",
      reference: response.id,
      output,
      usage: usageFrom(response),
    };
  }
  if (response.status === "failed") {
    return {
      adapter: "openai",
      model: resolvedModel,
      status: "failed",
      reference: response.id,
      errorCode: response.error?.code ?? "openai_response_failed",
      usage: usageFrom(response),
    };
  }
  return {
    adapter: "openai",
    model: resolvedModel,
    status: "pending",
    reference: response.id,
    usage: usageFrom(response),
  };
}

function usageFrom(
  response: OpenAiResponse,
): StructuredModelRun["usage"] | undefined {
  const inputTokens = response.usage?.input_tokens;
  const outputTokens = response.usage?.output_tokens;
  if (inputTokens === undefined && outputTokens === undefined) return undefined;
  return { inputTokens, outputTokens };
}

function reasoningEffortFor(workload: "lesson_plan" | "lesson_block") {
  return workload === "lesson_plan" ? "low" : "none";
}
