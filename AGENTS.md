# Repository Guidelines

## Agent skills

### Issue tracker

Issues live in GitHub Issues for this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

The triage roles use the default label names: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo with a root `CONTEXT.md` and root `docs/adr/`. See `docs/agents/domain.md`.

## Project Structure & Module Organization

LumaLingo is a pnpm TypeScript monorepo. Application code lives in `apps/`: `apps/web` is the React/Vite frontend and `apps/api` is the Fastify backend. Shared workspace packages live in `packages/`: `packages/shared` contains cross-app TypeScript contracts, and `packages/database` contains Prisma schema, migrations, and database exports. Infrastructure lives in `infra` as Terraform files. Product and architecture context lives in `CONTEXT.md`, `luma-lingo-prd.md`, and `docs/adr/`.

Tests sit beside the code they exercise and use `*.test.ts`, for example `apps/api/src/http/app.test.ts`.

## Build, Test, and Development Commands

- `pnpm install`: install workspace dependencies using pnpm 10.
- `pnpm dev`: run all package `dev` scripts in parallel.
- `pnpm build`: build every workspace package with TypeScript/Vite/Prisma as applicable.
- `pnpm check`: run TypeScript checks across the monorepo; the database package also validates Prisma.
- `pnpm test`: run Vitest tests in all packages.
- `pnpm format` / `pnpm format:write`: check or apply Prettier formatting.
- `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`: run Prisma client generation, migrations, and Studio through `@luma-lingo/database`.

## Coding Style & Naming Conventions

Use TypeScript ES modules and keep imports explicit, including `.js` extensions for local runtime imports in compiled Node code. Follow the existing style: two-space indentation, double quotes, trailing commas where Prettier adds them, and small named functions for testable logic. Use kebab-case for filenames such as `auth-service.ts` and PascalCase for exported classes/types such as `AuthService`.

## API Organization Patterns

Keep API code organized by domain and boundary:

- Domain-facing types live with their owning domain, not inside services. For example, learner types belong under `apps/api/src/learners/`, session types under `apps/api/src/sessions/`, auth provider contracts under `apps/api/src/auth/`, and user profile types under `apps/api/src/users/`.
- Define reusable application/domain data shapes with Zod as the single source of truth too. Export both the schema and the inferred type, for example `learnerProfileSchema` and `export type LearnerProfile = z.infer<typeof learnerProfileSchema>`.
- Reuse domain schemas inside HTTP DTO schemas when the internal shape and transport shape are identical. Create an HTTP DTO-specific schema only when the boundary adapts the shape, such as `Date` to ISO string, hiding fields, renaming fields, or composing multiple internal models.
- Services contain application behavior only. Avoid using service files as catch-all homes for HTTP response types, repository interfaces, provider interfaces, or database mappers.
- HTTP routes live in `apps/api/src/http/routes/` and are registered through small named functions such as `registerAuthRoutes`, `registerMeRoutes`, and `registerHealthRoutes`. `http/app.ts` should create Fastify, register shared plugins, and compose route registrars.
- HTTP DTOs live under `apps/api/src/http/dtos/`. Use `Dto` in type and function names, not all-caps acronyms: `MeDto`, `toMeDto`, `CreateLearnerDto`. DTOs are transport shapes for HTTP input/output and should not be treated as domain models.
- Define HTTP DTO shapes with Zod as the single source of truth. Export the schema and infer the TypeScript type from it, for example `export const meDtoSchema = z.object(...)` and `export type MeDto = z.infer<typeof meDtoSchema>`. Do not maintain a manual DTO interface and a separate OpenAPI schema for the same payload.
- Keep DTO mappers separate from DTO schemas. A function such as `toMeDto` converts application data into the HTTP transport shape defined by the Zod schema.
- Repositories are split one implementation per file. Repository interfaces live beside their domain boundary, while provider-specific implementations use names such as `prisma-user-repository.ts` and `prisma-session-repository.ts`.
- Shared Prisma-to-application mappers live in explicit mapper files, for example `prisma-auth-profile-mapper.ts`, instead of being duplicated across repositories. Use mapper names such as `toAuthProfile` for adapter/persistence-to-application conversions; reserve `Dto` names for HTTP transport contracts.
- Provider-specific concerns stay behind adapters. Cognito details belong in the Cognito auth provider, not in domain services or product logic.
- `auth_identities.email_at_auth_time` is write-once. It records the email first observed when the auth identity was linked. Returning logins update `lastSeenAt` and user login timestamps, but must not overwrite `emailAtAuthTime`.

## Testing Guidelines

Vitest is the test runner. Place focused unit or route tests next to implementation files with `*.test.ts`. Prefer deterministic in-memory fakes for service and HTTP tests, as in the API auth tests. Run `pnpm test` before submitting changes; run `pnpm check` when touching types, config, or Prisma schema.

Do not delete any tests without explicit authorization first. If deletion seems necessary, request permission and explain why you want to remove the test; only continue after receiving approval. You may move tests between files to improve organization, but you must never delete them without authorization.
