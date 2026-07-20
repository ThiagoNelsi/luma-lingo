# ADR 0014: Adopt the authorial A1/A2 catalog for the MVP

Status: Accepted

## Context

The existing runtime importer and diagnostic bank use legacy competency fields and identifiers. The new authorial A1/A2 catalog expresses competencies through taxonomy, descriptors, concepts, assumed capabilities, and estimated difficulty; transforming it into the legacy shape would discard the distinctions required by ADR 0011 and ADR 0012. The existing diagnostic bank has no competency-ID overlap with the new catalog.

## Decision

`data/catalogs/en/authoral/catalogs/competency-catalog-a1-a2-v1.json` is the canonical competency catalog for the MVP. B1 and B2 will extend this model later. The runtime and database will evolve to represent this catalog instead of maintaining a lossy compatibility projection to the legacy grammar and non-grammar catalogs.

Publication maps the authorial fields as follows:

- `type` to competency family;
- `level` to the normalized internal difficulty band;
- `descriptor` to the existing competency `description` field in the runtime database;
- `taxonomyId` to queryable taxonomy membership;
- `estimatedGseScore` to the provider-neutral runtime field `estimatedDifficultyScore`.

Question mode does not belong to a competency. Binary `isCore` and embedded goal priorities do not belong to the linguistic catalog and are replaced by ADR 0013.

Competencies without component concepts are valid. Publication must not invent generic concepts merely to make every competency compositional; those competencies receive direct evidence for their integrated performance.

A new publication pipeline imports, in dependency order, the concept registry, the competency catalog and its concept relationships, the pedagogical policy, and a new A1/A2 question bank with evidence mappings. The legacy diagnostic bank will not be remapped heuristically because its targets are not equivalent to the new identifiers.

The development database may be rebuilt because it is disposable. Before any full reset, a complete backup must be downloaded, restored to a temporary database, and verified by table and row counts. Existing migration history remains intact; schema changes use incremental migrations. Only after restore verification may the development database be cleared, migrated, and republished.

Formal artifact metadata tables and checksum verification are deferred as recorded in `FUTURE-IMPROVEMENTS.md`.

## Considered Options

- Flatten the authorial catalog into the legacy runtime model.
- Maintain both catalog models and translate between them indefinitely.
- Adopt the authorial catalog directly and migrate the runtime, question bank, and disposable development data.

## Consequences

- Legacy competency identifiers, diagnostic targets, and learner evidence are not assumed to remain valid.
- Import validation must reject unknown concept, taxonomy, capability, competency, and question references.
- Resetting development data is simpler than maintaining transitional compatibility, but it is permitted only after a tested restore proves the backup is usable.
- Future B1/B2 content can use the same publication and evidence model without another runtime redesign.
