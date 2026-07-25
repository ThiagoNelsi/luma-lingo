import {
  createSilentLogger,
  errorMetadata,
  type AppLogger,
} from "../observability/logger.js";
import type {
  StructuredModel,
  StructuredModelRequest,
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
      apiKey: string;
      model?: string;
      models?: Record<"lesson_plan" | "lesson_block", string>;
      fetch?: typeof globalThis.fetch;
    },
    logger: AppLogger = createSilentLogger(),
  ) {
    this.fetch = config.fetch ?? globalThis.fetch;
    this.logger = logger;
  }

  async start<T>(
    request: StructuredModelRequest<T>,
  ): Promise<StructuredModelRun> {
    const model = this.modelFor(request.workload);
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
          store: false,
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
        workload: request.workload,
      });
      throw error;
    }
  }

  async inspect(
    reference: string,
    correlation?: StructuredModelRequest<unknown>["correlation"],
  ): Promise<StructuredModelRun> {
    const model = this.modelFor("lesson_block");
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
      const run = toRun((await response.json()) as OpenAiResponse, model);
      this.logCompletedOperation({
        ...correlation,
        durationMs: Math.round(performance.now() - startedAt),
        model,
        operation: "responses.retrieve",
        runStatus: run.status,
        statusCode: response.status,
      });
      return run;
    } catch (error) {
      this.logFailedOperation(error, {
        ...correlation,
        durationMs: Math.round(performance.now() - startedAt),
        model,
        operation: "responses.retrieve",
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
    lessonId?: string;
    model: string;
    operation: string;
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
      };
    }
    return {
      adapter: "openai",
      model: resolvedModel,
      status: "completed",
      reference: response.id,
      output,
    };
  }
  if (response.status === "failed") {
    return {
      adapter: "openai",
      model: resolvedModel,
      status: "failed",
      reference: response.id,
      errorCode: response.error?.code ?? "openai_response_failed",
    };
  }
  return {
    adapter: "openai",
    model: resolvedModel,
    status: "pending",
    reference: response.id,
  };
}

function reasoningEffortFor(workload: "lesson_plan" | "lesson_block") {
  return workload === "lesson_plan" ? "low" : "none";
}
