# ADR 0011: Model concepts separately from competencies

Status: Accepted

## Context

The authorial catalog distinguishes an observable performance from the reusable linguistic knowledge involved in that performance. Treating both as one entity would couple concept identity to catalog level and wording, duplicate shared knowledge across competencies, and force partial knowledge into a single competency score. It would also make learner evidence difficult to reuse when a compatible catalog version changes its competency composition.

## Decision

`Competency` and `Concept` are separate domain entities. A competency is a catalog-specific, observable performance with a family, internal difficulty reference, taxonomy membership, and descriptor. A concept is a stable target-language knowledge unit with no proficiency level; it may be contained by, assumed by, or support multiple competencies, and it may itself be a learning or assessment target.

Competency-to-concept relationships are first-class relational data with one of three roles: component, assumed, or supporting. An assumed relationship also declares the required `Capability`; component and supporting relationships do not. The authorial JSON remains the publication input, while Postgres stores the normalized runtime projection.

Learner knowledge is stored per concept and capability. Concept evidence is append-only and records whether each observation is direct or inferred. Learner competency state remains available for direct integrated performance, including competencies without component concepts, and for derived summaries, but it does not replace the component states relevant to a particular activity.

Capabilities form an ordered progression: a higher capability satisfies a lower required capability for the same concept. For assumed knowledge, a known state below the required capability blocks readiness. An unknown state strongly penalizes readiness but does not block it absolutely. Readiness thresholds are configurable and must be calibrated through simulation.

A competency mastery projection preserves partial knowledge. In the MVP:

```text
projectedMastery = average mastery of known component concepts
coverage = known component concepts / total component concepts
projectedConfidence = aggregateConfidence * coverage
```

Missing state means unknown, not zero. The planner evaluates the concepts required by the current activity; it uses the weakest component only when that activity's Q-matrix explicitly requires all mapped components together. The MVP will not add a competency-level mastery-aggregation property or classification.

This refines ADR 0007, ADR 0008, and ADR 0009 by making reusable concepts and capability-specific learner state part of the queryable progression model.

## Considered Options

- Store competencies and concepts in one table with a type discriminator.
- Keep concepts embedded as JSON arrays inside each competency.
- Store concepts and competencies separately, with normalized relationships and learner state.

## Consequences

- Partial knowledge such as affirmative, negative, and question forms can be represented without reducing a broader competency to its weakest variant.
- Concept state can survive compatible catalog revisions and can support focused teaching or assessment.
- Append-only concept evidence preserves the audit trail behind each projected state.
- Runtime queries require additional tables and joins, and publication must validate relationship roles and required capabilities.
- Competency summaries are explicitly projections and must not become the sole input to activity selection.
