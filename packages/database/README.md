# Database Package

This package owns the Prisma schema, migrations, and database client for LumaLingo.

- Prisma owns migrations and the generated client.
- Runtime configuration uses provider-neutral `DATABASE_URL`.
- App IDs use UUID v7 generated in TypeScript through `createId()`.
- Prisma/TypeScript names use `camelCase`; Postgres tables and columns use `snake_case`.
- Session cookies store a random secret token. The database stores only `sessions.token_hash`, never the raw cookie token.
- Profile introduction records store processing status, retry count, errors,
  and extracted profile fields. The database never stores the raw recording or
  its transcript.
- Learning tracks store the learner's selected Lesson emphasis values, optional
  Study pace, and Onboarding starting point so onboarding resume and lesson
  generation can consume the same persisted preferences.
- Learning tracks may point to a versioned competency catalog. Catalog records,
  competencies, reusable concepts, competency-to-concept relationships,
  diagnostic items, competency evidence, and sparse learner competency state
  live in Postgres. Language- and version-specific curriculum details use JSONB
  fields and must be validated by application code before use.

`Learner.currentLearningTrackId` intentionally points to `LearningTrack`, while each `LearningTrack` also belongs to a `Learner`.

This circular relation means the current track cannot be created as part of the same nested Prisma create as the learner. Create or switch the current track in a transaction: create the `LearningTrack` first, then update `Learner.currentLearningTrackId`.

Each learner has at most one `ProfileIntroduction`. Its status moves through
`not_started`, `pending`, and `processing` before reaching `completed`,
`failed`, or `manual_required`. API startup changes interrupted `pending` or
`processing` records to `failed` because recordings exist only in API memory
and can't be recovered after a restart.

Competency progress is sparse per `LearningTrack`. Missing rows in
`learner_competency_states` mean the learner's ability for that competency is
unknown, not that the competency is unmastered.

See `../../docs/competency-database-schema.md` for the detailed competency
schema guide, including relationship notes and JSONB examples.

## Publish the authorial catalog

The authorial files under `data/catalogs/en/authoral/` are private, ignored
publication inputs. Validate and import them in dependency order: concepts
first, then competencies and their concept relationships.

Run a dry run before writing to the configured database:

```sh
pnpm --filter @luma-lingo/database db:import:concepts -- --dry-run
pnpm --filter @luma-lingo/database db:import:competencies -- --dry-run
```

Publish the validated artifacts:

```sh
pnpm --filter @luma-lingo/database db:import:concepts
pnpm --filter @luma-lingo/database db:import:competencies
pnpm --filter @luma-lingo/database db:verify:authorial-catalog
```

The importers reject duplicate identities, unknown or inactive references,
invalid relationship roles, invalid assumed capabilities, and content changes
to an already published catalog version. They derive stable UUIDs from authorial
identities, upsert rows in a transaction, and return aggregate counts only.
Running the same import again is idempotent.

Use `DATABASE_URL` for application and publication traffic. Set
`DATABASE_MIGRATION_URL` to the provider's direct, unpooled connection for
Prisma migrations.

## Import onboarding diagnostic questions

The legacy diagnostic bank doesn't share competency identities with the
authorial catalog. Don't import or remap it into the published catalog. The API
reports the diagnostic as unavailable until a new question bank with explicit
evidence mappings is published. The existing diagnostic tables remain available
for that replacement pipeline.
