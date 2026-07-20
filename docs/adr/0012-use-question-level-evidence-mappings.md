# ADR 0012: Use question-level evidence mappings

Status: Accepted

## Context

A question about a compound competency usually diagnoses only some of its concepts. Applying the same score to every competency target, or propagating an answer generically through prerequisites, creates false precision and can turn one local error into unrelated negative evidence. The assessment model also needs to distinguish the language channel being tested from the format used to submit an answer.

## Decision

Every diagnostic item or learning activity declares exactly one primary `Diagnostic target`, which may be a competency or a concept. It also declares its Q-matrix row as `Evidence mapping`s from the response to the concepts and capabilities the response can actually diagnose, including the relative evidence strength. Only mapped concept states are updated from that response.

Direct evidence remains distinguishable from inferred evidence. Strong positive evidence may produce weaker positive evidence for concepts that the demonstrated performance assumes. An incorrect response does not automatically produce negative evidence for assumed concepts because the failure may belong to the directly mapped performance instead.

`Question mode` records the primary language channel: reading, writing, listening, or speaking. Response format is separate. For example, an activity that asks the learner to hear audio and transcribe it has listening mode and a written-transcription response format; its evidence mappings may additionally record weaker writing or spelling evidence when the item supports that inference.

The deterministic selection, scoring, attempt-completion, and publication rules in ADR 0006 and ADR 0010 remain in force. This ADR changes what the published scoring result is allowed to update.

## Considered Options

- Apply one response score uniformly to all competency targets.
- Derive evidence from competency composition at runtime without question-level mappings.
- Require each authored question to declare its diagnostic target and evidence mappings.

## Consequences

- Question authoring and validation become more demanding because every diagnostic claim must be explicit.
- Isolated questions can provide strong component evidence, while integrated questions can use lower strengths to reflect ambiguity.
- Concepts can be primary lesson or assessment targets without being promoted to catalog competencies.
- The planner and evidence repositories must consume question-level mappings instead of generic prerequisite propagation.
