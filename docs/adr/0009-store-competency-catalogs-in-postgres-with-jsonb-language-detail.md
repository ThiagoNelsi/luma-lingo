# ADR 0009: Store competency catalogs in Postgres with JSONB language detail

Competency catalogs, diagnostic items, prerequisite relationships, goal priorities, and learner competency state will use Postgres as the source of truth rather than DynamoDB. The shared planning and diagnostic concepts will be modeled as relational data, while language-specific and version-specific curriculum details such as examples, forms, common errors, and scoring metadata may live in validated JSONB fields. This keeps the core learning logic queryable and consistent across target languages without forcing every language to share identical attributes.

**Considered Options**

- DynamoDB or another schemaless store for highly variable curriculum attributes.
- Postgres relational tables only, with fixed columns for every curriculum detail.
- Postgres relational core plus JSONB for language-specific details.

**Consequences**

- Curriculum publishing can start with one target language while preserving a path for Spanish, French, German, Italian, and other languages.
- Runtime code must validate JSONB payloads by catalog version before using them.
- DynamoDB remains a possible future read model or cache if access patterns and scale justify it.
