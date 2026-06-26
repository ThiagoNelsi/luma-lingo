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
- Learning tracks store the learner's selected Lesson emphasis values and
  optional Study pace so Level check and lesson generation can consume the same
  persisted preferences.
- Learning tracks may point to a versioned competency catalog. Catalog records,
  competencies, prerequisites, goal priorities, diagnostic items, competency
  evidence, and sparse learner competency state live in Postgres. Language- and
  version-specific curriculum details use JSONB fields and must be validated by
  application code before use.

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

## Import competency catalogs

Use the local import script to load the ignored JSON catalog files from
`data/catalogs/en/` into Postgres:

```sh
pnpm --filter @luma-lingo/database db:import:competencies -- --dry-run
pnpm --filter @luma-lingo/database db:import:competencies -- --version en-mvp-1 --status published
```

The script imports the grammar and non-grammar JSON files as one runtime
`CompetencyCatalog`, upserts competencies, rebuilds prerequisite relationships
for imported competencies, and rebuilds goal priorities for imported
competencies. It does not delete competencies that are absent from the JSON
files.

Override source paths only when importing a different local draft:

```sh
pnpm --filter @luma-lingo/database db:import:competencies -- \
  --grammar ../../data/catalogs/en/grammar-competencies.json \
  --non-grammar ../../data/catalogs/en/non-grammar-competencies.json \
  --version en-mvp-1
```

The import runs inside one Prisma transaction with a 60-second timeout. If a
slow local database needs more time, pass a higher timeout:

```sh
pnpm --filter @luma-lingo/database db:import:competencies -- \
  --version en-mvp-1 \
  --status published \
  --transaction-timeout-ms 120000
```
