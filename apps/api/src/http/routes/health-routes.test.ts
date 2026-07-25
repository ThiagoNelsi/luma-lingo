import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { describe, expect, it } from "vitest";

import { registerHealthRoutes } from "./health-routes.js";

describe("health routes", () => {
  it("keeps the API healthy while reporting degraded Lesson generation", async () => {
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    registerHealthRoutes(app, {
      lessonGeneration() {
        return {
          status: "degraded",
          reason: "missing_credentials",
        };
      },
    });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      readiness: {
        lessonGeneration: {
          status: "degraded",
          reason: "missing_credentials",
        },
      },
    });
  });
});
