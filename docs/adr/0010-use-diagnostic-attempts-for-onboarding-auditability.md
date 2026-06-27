# ADR 0010: Use diagnostic attempts for onboarding auditability

The `Initial diagnostic` will persist a `Diagnostic attempt` and ordered `Diagnostic attempt item`s so the product can audit which items were shown, resume an in-progress diagnostic for up to 48 hours, analyze answer timing from item timestamps, and improve future deterministic selection and scoring policies. The runtime selector and scorer remain deterministic and do not call an LLM; `Diagnostic item` metadata declares possible `diagnosticRoles`, while each attempt item records the single role and rule that selected it in that execution.

Formal `Competency evidence`, `Learner competency state`, and the final diagnostic summary will be created only when the attempt completes automatically. During an in-progress attempt, the selector recalculates current signals from answered attempt items; abandoned attempts keep their item responses for analysis but do not update the learner's competency profile.

**Considered Options**

- Create competency evidence immediately after each diagnostic answer.
- Store only competency evidence and skip attempt-level records.
- Use runtime LLM judgment to select the next diagnostic item.
- Persist attempt records but store item roles and authored metadata only in normalized tables.

**Consequences**

- Onboarding remains fast because next-item selection runs in application code without model latency.
- Diagnostic analytics can inspect shown items, structured responses, answer timestamps, selected roles, selection rules, scores, and confidences.
- Incomplete diagnostics do not affect initial planning until they complete.
- The MVP can keep `diagnosticRoles` and authoring notes in `DiagnosticItem.details` JSONB; they can be normalized later if database-level role queries become necessary.
- `Don't know` is an explicit answered diagnostic response with no positive score, helping reduce false positives from guessing.
