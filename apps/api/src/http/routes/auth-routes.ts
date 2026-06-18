import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod/v4";

import type { AuthProvider } from "../../auth/auth-provider.js";
import type { AppConfig } from "../../config.js";
import { UnverifiedEmailError } from "../../services/auth-errors.js";
import { AuthService } from "../../services/auth-service.js";
import { errorDtoSchema } from "../dtos/error-dto.js";
import { redirectResponseSchema } from "../schemas/common-schemas.js";

export interface AuthRoutesDependencies {
  auth: AuthService;
  authProvider: AuthProvider;
  config: AppConfig;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  deps: AuthRoutesDependencies,
): void {
  const routes = app.withTypeProvider<ZodTypeProvider>();
  const stateCookieName = `${deps.config.sessionCookieName}_oauth_state`;

  routes.get(
    "/auth/login",
    {
      schema: {
        tags: ["Auth"],
        summary: "Start Managed Login",
        description:
          "Creates a short-lived OAuth state cookie and redirects the learner to Cognito Managed Login.",
        response: {
          302: redirectResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      const state = deps.auth.createOAuthState();

      reply.setCookie(stateCookieName, state, {
        httpOnly: true,
        maxAge: 10 * 60,
        path: "/auth/callback",
        sameSite: "lax",
        secure: deps.config.sessionCookieSecure,
      });

      return reply.redirect(
        deps.authProvider.getAuthorizationUrl({
          state,
          redirectUri: deps.config.authCallbackUrl,
        }),
      );
    },
  );

  routes.get(
    "/auth/callback",
    {
      schema: {
        tags: ["Auth"],
        summary: "Complete Managed Login callback",
        description:
          "Validates OAuth state, exchanges the authorization code, creates an app-owned session cookie, and redirects back to the web app.",
        querystring: z.object({
          code: z.string().optional(),
          state: z.string().optional(),
        }),
        response: {
          302: redirectResponseSchema,
          400: errorDtoSchema,
        },
      },
    },
    async (request, reply) => {
      const { code, state } = request.query;
      const expectedState = request.cookies[stateCookieName];
      reply.clearCookie(stateCookieName, { path: "/auth/callback" });

      if (!code) {
        return reply.code(400).send({ error: "missing_oauth_code" });
      }

      if (!deps.auth.validateOAuthState(expectedState, state)) {
        return reply.code(400).send({ error: "invalid_oauth_state" });
      }

      try {
        const identity = await deps.authProvider.exchangeCode({
          code,
          redirectUri: deps.config.authCallbackUrl,
        });
        const result = await deps.auth.completeLogin(identity);

        reply.setCookie(deps.config.sessionCookieName, result.sessionToken, {
          expires: result.session.expiresAt,
          httpOnly: true,
          path: "/",
          sameSite: "lax",
          secure: deps.config.sessionCookieSecure,
        });

        return reply.redirect(`${deps.config.frontendOrigin}/private`);
      } catch (error) {
        if (error instanceof UnverifiedEmailError) {
          return reply.redirect(
            `${deps.config.frontendOrigin}/login?error=email_not_verified`,
          );
        }
        throw error;
      }
    },
  );

  routes.post(
    "/auth/logout",
    {
      schema: {
        tags: ["Auth"],
        summary: "Log out the current learner",
        description:
          "Revokes the app session, clears the app cookie, and redirects through the auth provider logout flow.",
        response: {
          302: redirectResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await deps.auth.revokeSession(
        request.cookies[deps.config.sessionCookieName],
      );
      reply.clearCookie(deps.config.sessionCookieName, { path: "/" });

      return reply.redirect(
        await deps.authProvider.getLogoutUrl({
          logoutUri: deps.config.authLogoutUrl,
        }),
      );
    },
  );
}
