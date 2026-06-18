import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod/v4";

export function registerHealthRoutes(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Check API health",
        response: {
          200: z.object({ ok: z.boolean() }),
        },
      },
    },
    async () => ({ ok: true }),
  );
}
