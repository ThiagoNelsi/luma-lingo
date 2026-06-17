# ADR 0002: Web MVP Stack and AWS Deployment

Status: Accepted

## Context

The MVP should launch quickly as a mobile-first web app, while keeping a clear path to a later mobile app. The app will have multiple agent roles, but those roles do not yet require separate services. Most agent work is expected to be I/O-bound orchestration around LLM calls, persistence, validation, and feedback generation.

The stack should support fast iteration, shared contracts, structured observability, API documentation, background jobs, and AWS deployment without introducing premature microservice complexity.

## Decision

We will build the MVP as a TypeScript monorepo using:

- React, TypeScript, and Vite for the frontend
- a single Node.js TypeScript backend server
- TypeScript for shared packages and infrastructure helper code
- pnpm as the package manager
- agent roles implemented as backend modules rather than separate services
- BullMQ for background jobs
- ElastiCache Valkey/Redis as the BullMQ backend
- RDS Postgres as the primary database
- Cognito as the authentication backend
- a custom login screen in the app
- `HttpOnly` cookies for web session access
- Fastify for the backend API
- Zod schemas for validation and shared contracts
- generated OpenAPI/Swagger docs from route schemas
- Pino structured logs
- Terraform for AWS infrastructure
- ECS Fargate for the backend server and worker processes
- S3 and CloudFront for frontend hosting

The initial AWS deployment will use one AWS account, one VPC, and one environment. Terraform should keep the configuration modular enough to add more environments later.

## Consequences

### Positive

- The monorepo keeps frontend, backend, shared schemas, agent contracts, and infrastructure code aligned.
- A single backend server avoids premature service boundaries while the product model is still changing.
- Agent roles remain explicit in code without requiring separate infrastructure for each role.
- BullMQ gives strong local development ergonomics, retries, delays, and job progress for agent workflows.
- ECS Fargate fits separate API and worker scaling later without changing the application architecture.
- Cognito avoids custom password handling while allowing a custom login experience.
- `HttpOnly` cookies improve web session UX and avoid exposing tokens to browser JavaScript.
- Generated OpenAPI documentation keeps API docs close to the implementation.
- Structured logs provide a baseline for MVP observability.

### Trade-offs

- Terraform, ECS, RDS, and ElastiCache create more initial infrastructure work than a fully managed platform.
- BullMQ adds a Redis/Valkey dependency that SQS would avoid.
- A single backend server means auth, app routes, and agent orchestration share one deployable unit at first.
- Cognito setup and debugging can be less ergonomic than hosted auth products such as Clerk or Auth0.
- `HttpOnly` cookie sessions require careful CSRF, session expiry, refresh, and cookie configuration.

### MVP guidance

- Keep Terraform modules thin and avoid over-modeling infrastructure early.
- Store authoritative lesson, report, user, and job result data in Postgres, not only in Redis.
- Treat Redis/Valkey as job coordination infrastructure.
- Keep agent inputs and outputs typed with shared schemas.
- Avoid LangChain or LangGraph until orchestration complexity proves the need.
- Do not split agent roles into separate services until metrics show independent scaling, runtime, isolation, or ownership needs.
- Log agent lifecycle metadata, latency, model/provider, status, and error category, but do not log full prompts, learner answers, or sensitive profile content by default.