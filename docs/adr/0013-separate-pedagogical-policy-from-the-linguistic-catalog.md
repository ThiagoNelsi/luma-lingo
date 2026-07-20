# ADR 0013: Separate pedagogical policy from the linguistic catalog

Status: Accepted

## Context

Competency composition, assumed knowledge, taxonomy, and estimated difficulty are relatively stable linguistic facts. Whether content is foundational or especially relevant to everyday conversation, work, or travel is a revisable LumaLingo product choice. Keeping both kinds of information in the competency catalog would make product experiments look like linguistic catalog revisions and would encourage a fixed learning sequence.

## Decision

The `Competency catalog` contains linguistic facts. A separate, versioned `Pedagogical policy` contains sparse integer weights from 0 to 100 that influence adaptive ranking without defining a `Learning plan`.

The policy supports:

- a goal-independent base priority for a competency;
- a foundation weight for choosing suitable entry points;
- goal weights for competencies;
- goal weights for concepts.

An explicit competency goal weight overrides its inherited value. Otherwise, the initial policy derives competency relevance only from component concept weights:

```text
inherited goal weight = 0.7 * maximum component weight
                      + 0.3 * average component weight
```

A missing concept weight counts as zero for this calculation. Assumed concepts affect readiness rather than relevance, and supporting concepts contribute no goal weight in the MVP. The learner's primary goal has factor 1.0, the strongest additional goal has factor 0.5, and candidate ranking uses the strongest resulting goal fit.

For a learner on the `Beginner path`, the planner first considers Pre-A1 competencies with positive foundation weight and falls back to A1 when none exist. It then applies readiness and dynamically ranks candidates using foundation weight, base priority, bounded goal fit, knowledge gap, uncertainty, review need, and recent repetition. Goal fit must not override required foundations.

This amends ADR 0007 by replacing the binary core-competency policy and amends ADR 0008 by moving goal priorities out of the linguistic catalog.

## Considered Options

- Keep `isCore` and goal priorities inside each catalog competency.
- Publish a predetermined goal-specific learning path.
- Keep sparse product weights in a separate policy consumed by the adaptive planner.

## Consequences

- Product priorities can change without changing linguistic identity or composition.
- Current and future competencies can inherit goal relevance from reusable concepts, while explicit competency weights cover integrated performances and competencies without components.
- The planner remains adaptive and must combine policy weights with learner state rather than sorting by policy alone.
- Policy authoring requires validation against the published catalog and concept registry.
