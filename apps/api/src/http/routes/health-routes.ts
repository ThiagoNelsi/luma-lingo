import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod/v4";

import type { StructuredModelReadiness } from "../../models/structured-model.js";

export function registerHealthRoutes(
  app: FastifyInstance,
  deps: {
    lessonGeneration(): StructuredModelReadiness;
  } = {
    lessonGeneration: () => ({ status: "ready" }),
  },
): void {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Check API health",
        response: {
          200: z.object({
            ok: z.boolean(),
            readiness: z.object({
              lessonGeneration: z.object({
                status: z.enum(["ready", "degraded"]),
                reason: z
                  .enum(["invalid_workload_capability", "missing_credentials"])
                  .optional(),
              }),
            }),
          }),
        },
      },
    },
    async () => ({
      ok: true,
      readiness: { lessonGeneration: deps.lessonGeneration() },
    }),
  );
}
