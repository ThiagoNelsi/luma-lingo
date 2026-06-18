import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "LumaLingo API",
        description:
          "Backend API for LumaLingo web authentication and app shell.",
        version: "0.1.0",
      },
      tags: [
        { name: "Health", description: "Service health endpoints" },
        {
          name: "Auth",
          description: "Managed Login and app session endpoints",
        },
        { name: "Learner", description: "Authenticated learner endpoints" },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });
}
