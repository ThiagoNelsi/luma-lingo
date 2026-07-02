# Diagnostic question roles

Diagnostic question roles describe why an item is useful inside an `Initial
diagnostic` attempt. They are authoring and selection metadata for a
`Diagnostic item`, not learner-facing labels.

This is different from a `Diagnostic target role`. Target roles describe how a
competency target contributes evidence inside one item, such as `primary` or
`supporting`. Question roles describe the item's selection purpose, such as
`foundation`, `ceiling`, or `repair`.

The supported question roles come from
`packages/shared/src/diagnostic-question.ts` and are stored in
`DiagnosticItem.details.diagnosticRoles`. When the selector presents an item,
the attempt records the concrete role used for that selection in
`DiagnosticAttemptItem.selectedForRole`.

## Role definitions

### `foundation`

Use `foundation` to check whether the learner has a prerequisite skill that the
system needs before planning lessons above it.

Foundation items are useful at the start of a diagnostic, after uncertainty,
and when the selector still lacks enough evidence about core lower-band
competencies. They should usually be short, constrained, and easy to score
deterministically.

### `ceiling`

Use `ceiling` to find the learner's upper boundary: the highest area where they
can still answer reliably enough to start above simpler material.

Ceiling items are useful after the learner gives strong answers, or when prior
evidence already suggests they are above beginner material. They should not
dominate a cold-start diagnostic before the system has evidence that the
learner is ready for higher-band probing.

### `repair`

Use `repair` to check a likely misconception or missing prerequisite after a
wrong, low-confidence, or uncertain answer.

Repair items should target the most likely failure point instead of simply
dropping the learner to an easier generic question. They are especially useful
when scoring details or mistake codes identify a specific grammar, vocabulary,
or comprehension weakness.

### `confidence`

Use `confidence` to confirm a signal already observed from another item.

Confidence items are useful when the selector has a plausible estimate but the
evidence is thin, contradictory, or too important for lesson placement to rely
on a single response.

### `goal_probe`

Use `goal_probe` to connect diagnostic evidence to practical language use that
matters for the learner's stated goals.

Goal probes should still measure competencies, but they can prefer contexts
that match goals such as travel, conversation, work, school, or media
understanding. Goal relevance should influence selection after readiness and
evidence quality, not replace them.

## Selection policy guidance

The selector should use roles as dynamic weights, not as static labels attached
after a generic score wins. A good selection policy first reads the attempt
state, assigns role-fit bonuses or penalties, and then ranks candidates with
the normal competency, prerequisite, difficulty, diversity, and goal weights.

A useful scoring shape is:

```text
candidateScore =
  competencyCoverageScore
  + prerequisiteCoverageScore
  + difficultyFitScore
  + roleFitScore
  + goalPriorityScore
  + diversityScore
  - repetitionPenalty
```

`roleFitScore` should depend on recent answers:

- At cold start, boost `foundation` and keep `ceiling` below it unless there is
  existing evidence outside the attempt.
- After strong correct answers, boost `ceiling` and `confidence` so the
  diagnostic can move up quickly for advanced learners.
- After a wrong, low-confidence, or `dont_know` response, boost `repair` and
  reduce same-or-higher-band `ceiling` until the system repairs or confirms the
  weakness.
- After mixed evidence, boost `confidence` before making a large placement
  jump.
- When a goal is relevant, boost `goal_probe` inside the currently plausible
  difficulty range.

The prerequisite bonus does not need to be reduced when the learner is doing
well. The problem to avoid is selecting `ceiling` before evidence exists, or
continuing to select `ceiling` after evidence says the current band is too high.
Role-fit weights should handle those cases while preserving prerequisite
coverage for strong learners.

## Advanced learner handling

The policy should avoid a fixed beginner-heavy script. A learner who answers
early foundation or confidence items strongly should reach ceiling probes
quickly.

Use soft constraints instead of a hard global ceiling cap:

- Require early evidence before the first higher-band `ceiling` item.
- Let strong correct answers increase the ceiling bonus immediately.
- Avoid another ceiling item immediately after a ceiling miss unless it probes a
  clearly different, lower-risk competency.
- Prefer `repair` or `confidence` after misses, then resume ceiling probing when
  the learner recovers.
- Track consecutive ceiling selections so one role doesn't crowd out evidence
  diversity.

This keeps the diagnostic adaptive: beginners get enough foundation and repair
coverage, while advanced learners are not forced through many low-level items
after they show strong evidence.

## Validation checks

Selection changes should include tests for these behaviors:

- A cold-start attempt does not select `ceiling` as the first item without prior
  learner evidence.
- Early strong answers make `ceiling` competitive within the first few items.
- A missed higher-band item boosts `repair` or `confidence` above another
  similar ceiling probe.
- Consecutive ceiling selections remain bounded unless the learner keeps
  producing strong evidence.
- Goal probes influence context and coverage without overriding readiness.
