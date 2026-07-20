# Competency database schema

This guide describes the Postgres projection of the authorial competency
catalog. The JSON artifacts remain the publication source. Postgres stores the
normalized, queryable runtime model.

The design follows these decisions:

- [ADR 0011](adr/0011-model-concepts-separately-from-competencies.md) separates
  reusable concepts from observable competencies.
- [ADR 0013](adr/0013-separate-pedagogical-policy-from-the-linguistic-catalog.md)
  keeps goal and sequencing policy outside the linguistic catalog.
- [ADR 0014](adr/0014-adopt-the-authorial-a1-a2-catalog-for-the-mvp.md) adopts
  the authorial catalog without a lossy legacy projection.

## Model overview

The catalog projection has four central models:

```text
CompetencyCatalog
  -> Competency[]
       -> CompetencyConcept[]
            -> Concept
```

`CompetencyCatalog` versions a published curriculum. A `Competency` describes
an observable performance in that version. A `Concept` identifies reusable
target-language knowledge independently of catalog level or wording.
`CompetencyConcept` records how a concept participates in a competency.

The model deliberately omits the legacy `mode`, `isCore`, competency
prerequisite, and embedded goal-priority structures. Question mode belongs to
an item or activity. Sequencing, core selection, and learner-goal weighting
belong to pedagogical policy.

## CompetencyCatalog

`CompetencyCatalog` is the publication boundary for a target language and
version.

Important fields:

- `targetLanguage` and `version` form the stable natural identity.
- `status` controls whether runtime code may select the catalog.
- `publishedAt` records publication time when available.
- `sourceChecksum` detects content drift in a published version.
- `metadata` stores validated publication metadata that doesn't need a
  dedicated queryable column.

The importer derives the database UUID from the target language and authorial
version. It rejects a different checksum for an already published version.
Publish changed content under a new version instead.

## Competency

A `Competency` is a catalog-specific, observable performance.

Important fields:

- `key` is the authorial competency identity within a catalog.
- `title` is the short display label.
- `description` stores the authorial descriptor.
- `family` stores the provider-neutral competency type.
- `difficultyBand` stores the normalized proficiency band.
- `taxonomyId` stores queryable taxonomy membership.
- `estimatedDifficultyScore` stores an optional provider-neutral internal
  difficulty estimate from 0 through 100.
- `status` stores the authorial lifecycle state.
- `details` stores validated examples, search terms, and source references.

The `(catalogId, key)` pair is unique. A database check constrains a non-null
`estimatedDifficultyScore` to the inclusive 0 through 100 range.

A competency may have no component concepts. This represents an integrated
performance that receives direct evidence; publication must not invent a
generic concept to make the competency compositional.

## Concept

A `Concept` is a stable target-language knowledge unit. It has no catalog level
and can participate in multiple competencies or catalog versions.

Important fields:

- `targetLanguage` and `key` form the stable natural identity.
- `label` and `aliases` support authoring and lookup.
- `status` stores the authorial lifecycle state.
- `replacedByConceptId` links a replaced concept to its active successor.
- `details` stores validated extension data.

The `(targetLanguage, key)` pair is unique. A replacement must refer to another
persisted concept and can't refer to itself.

## CompetencyConcept

`CompetencyConcept` is a normalized many-to-many relationship. Its composite
primary key prevents the same concept from having multiple roles in one
competency.

The allowed roles are:

- `component`: the concept is part of the observable performance.
- `assumed`: the learner needs a declared capability for the concept before
  attempting the competency.
- `supporting`: the concept helps instruction or interpretation but isn't a
  component or a readiness requirement.

Only an `assumed` relationship has `requiredCapability`. The allowed ordered
capabilities are:

1. `recognition`
2. `controlled_production`
3. `contextualized_use`
4. `independent_use`

Database checks enforce all of these rules:

- `role` must be `component`, `assumed`, or `supporting`.
- `requiredCapability` must be null or one of the four allowed values.
- An `assumed` relationship must declare a capability.
- A `component` or `supporting` relationship must not declare a capability.

The importer also rejects a concept assigned to more than one role in the same
competency before it opens a write transaction.

## Diagnostics and learner state

The database retains `DiagnosticItem`, `DiagnosticAttempt`,
`LearnerCompetencyState`, and `CompetencyEvidence` for the replacement
diagnostic pipeline. Their competency foreign keys target the new catalog.

The legacy question bank doesn't share competency identities with the
authorial catalog and isn't remapped heuristically. Until a new question bank
with explicit evidence mappings is published, the diagnostic question-bank
repository returns unavailable for the authorial catalog.

Learner competency state remains sparse. A missing
`LearnerCompetencyState` row means unknown ability, not zero ability. Attaching
a published catalog during onboarding must not prefill zero-valued rows.

Concept-level evidence and state described by ADR 0011 require a later schema
slice. This migration establishes concept identity and competency composition;
it doesn't claim to persist concept mastery yet.

## Publication workflow

Private authorial files live under `data/catalogs/en/authoral/` and remain
ignored by Git. Never print individual rows, descriptors, examples, or source
references in logs or issue comments.

Run publication in dependency order:

1. Validate and import the concept registry.
2. Validate and import the competency catalog and taxonomy references.
3. Verify aggregate counts and database constraints.

Use dry runs before any write:

```sh
pnpm --filter @luma-lingo/database db:import:concepts -- --dry-run
pnpm --filter @luma-lingo/database db:import:competencies -- --dry-run
```

Publish and verify:

```sh
pnpm --filter @luma-lingo/database db:import:concepts
pnpm --filter @luma-lingo/database db:import:competencies
pnpm --filter @luma-lingo/database db:verify:authorial-catalog
```

The concept importer validates duplicate identities and replacement targets.
The catalog importer validates schema conformance, duplicate competency and
taxonomy identities, lifecycle status, concept and taxonomy references,
relationship roles, and capabilities. Both importers use deterministic UUIDs,
run writes in a transaction, and return aggregate summaries only.

Re-running either importer with identical artifacts is safe and produces the
same database identities and totals.

## Migration connections

Set both database URLs in the runtime environment:

- `DATABASE_URL` is the application and publication connection. It may use a
  pooler.
- `DATABASE_MIGRATION_URL` is Prisma's direct, unpooled migration connection.

Apply committed migrations with `prisma migrate deploy` in shared or production
environments. Don't use `prisma migrate dev` against a shared database.

The catalog replacement migration removes disposable development catalog,
diagnostic, and learner-progression rows before it removes the incompatible
legacy columns and tables. A verified off-platform backup is therefore a
mandatory operational prerequisite for that migration.

## Authoring rules

- Keep descriptors in `Competency.description`, not in titles or JSON-only
  fields.
- Keep provider-specific scale names out of runtime field names.
- Model reusable linguistic knowledge as `Concept`, not as a duplicate
  competency.
- Use concept relationships for composition and assumed capability, not as a
  pedagogical sequencing graph.
- Keep goal weighting, core selection, and other policy outside the catalog.
- Treat missing learner state as unknown.
- Publish changed catalog content under a new version after publication.
