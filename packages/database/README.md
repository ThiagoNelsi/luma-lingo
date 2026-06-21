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

`Learner.currentLearningTrackId` intentionally points to `LearningTrack`, while each `LearningTrack` also belongs to a `Learner`.

This circular relation means the current track cannot be created as part of the same nested Prisma create as the learner. Create or switch the current track in a transaction: create the `LearningTrack` first, then update `Learner.currentLearningTrackId`.

Each learner has at most one `ProfileIntroduction`. Its status moves through
`not_started`, `pending`, and `processing` before reaching `completed`,
`failed`, or `manual_required`. API startup changes interrupted `pending` or
`processing` records to `failed` because recordings exist only in API memory
and can't be recovered after a restart.
