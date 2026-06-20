# LumaLingo

LumaLingo is an AI-powered language learning product focused on personalized
lessons, a lightweight onboarding flow, and a reliable feedback loop from one
lesson to the next.

This repository contains the web application, API, shared packages, database
layer, infrastructure, and product documentation. The product glossary, PRD,
and architecture decision records remain the source of truth for product and
architecture decisions.

## What the product is

The intended experience is:

1. Collect a small learner profile.
2. Estimate the learner's level with a friendly `Level check`.
3. Generate a core lesson tailored to the learner's `Goal`, `User profile`,
   `Lesson emphasis`, `Top mistakes`, `Review points`, and `Lesson length`.
4. Review the learner's answers and produce a `Lesson report`.
5. Use that report to shape the next lesson.
6. Optionally add bonus content from public web sources when it makes sense.

The MVP stays focused on beginners and intermediate learners, with speaking
excluded from the first version.

## Current repo state

The repository is a pnpm TypeScript monorepo with:

- `apps/web` for the React, Vite, and Tailwind CSS frontend
- `apps/api` for the Fastify backend
- `packages/shared` for shared TypeScript contracts
- `packages/database` for Prisma schema, migrations, and database access
- `infra` for Terraform infrastructure

The current implementation includes the authentication and session foundation,
public and authenticated web routes, and the initial responsive design system.
The design system provides semantic light and dark theme tokens and reusable
`Button`, `Surface`, and `Progress` components. Onboarding screens are not
implemented yet.

## Development

Install dependencies and start all development services:

```bash
pnpm install
pnpm dev
```

Run validation before committing changes:

```bash
pnpm check
pnpm test
pnpm format
```

## Key docs

- [Glossary and shared terms](CONTEXT.md)
- [Product brief and requirements](luma-lingo-prd.md)
- [ADR 0001: Agent Roles and Lesson Flow](docs/adr/0001-agent-roles-and-lesson-flow.md)
- [ADR 0002: Web MVP Stack and AWS Deployment](docs/adr/0002-web-mvp-stack-and-aws-deployment.md)
- [ADR 0003: Cognito Managed Login](docs/adr/0003-use-cognito-managed-login-for-mvp-auth.md)
- [Design system guidelines](docs/design-system/guidelines.md)
