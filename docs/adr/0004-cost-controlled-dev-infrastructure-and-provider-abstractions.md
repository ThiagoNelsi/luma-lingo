# ADR 0004: Cost-Controlled Dev Infrastructure and Provider Abstractions

Status: Accepted

## Context

ADR 0002 selected an AWS-first MVP deployment with ECS Fargate, RDS Postgres, ElastiCache, S3, CloudFront, and Terraform. That remains a useful future deployment direction, but the fixed monthly cost of always-on AWS compute, load balancing, RDS, and especially NAT Gateway is outside the current development budget.

The project still needs real Cognito integration, a real Postgres-compatible database, and an implementation path that does not lock the app into the first low-cost provider choices.

## Decision

For the development phase, we will run the web app and API locally, use Cognito Managed Login in AWS, and use Neon Postgres because its free tier fits the current budget. We will not deploy always-on ECS, ALB, RDS, ElastiCache, or NAT Gateway during this phase.

Infrastructure work should support this shape first:

- Cognito remains managed by Terraform in AWS.
- The app connects to Postgres through a provider-neutral `DATABASE_URL`.
- The database provider for development is Neon.
- Compute platform is undecided and will be selected later.
- AWS compute infrastructure may be deployed only sporadically for infrastructure tests, then destroyed.
- NAT Gateway is out of scope for the current budget and must not be introduced as a required MVP dependency.

Application code must keep provider-specific concerns behind narrow adapters or infrastructure boundaries. Database access, auth-provider calls, session storage, job infrastructure, object storage, LLM providers, and deployment configuration should be written so the underlying provider can change without rewriting product logic.

## Consequences

### Positive

- Development can continue with near-zero fixed AWS infrastructure cost.
- Cognito behavior can be tested against the real managed-login flow.
- Neon gives the app a real Postgres-compatible target before AWS RDS is affordable.
- The app keeps a path to later AWS deployment without making ECS, ALB, RDS, or NAT part of the local development baseline.
- Provider adapters reduce the cost of switching from Neon to RDS, or from one compute platform to another.

### Trade-offs

- Development and future AWS deployment are no longer identical environments.
- Terraform no longer owns the whole dev runtime.
- Neon-specific operational behavior may differ from RDS.
- Compute, job backend, object storage, and production database topology remain later decisions.

### Guidance

- Do not add NAT Gateway to the Terraform baseline.
- Do not assume RDS-only connection details in app code.
- Prefer `DATABASE_URL` and migration tooling that works with any Postgres-compatible provider.
- Keep Cognito integration behind a narrow backend boundary so tests can use fake auth clients.
- Keep deployment-specific config at the edge of the app.
- Revisit AWS RDS, ECS, ALB, ElastiCache, VPC endpoints, or NAT only when the production deployment budget and traffic model justify the fixed costs.
