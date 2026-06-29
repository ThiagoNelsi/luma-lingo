# Initial diagnostic validation strategy

This document defines why LumaLingo needs simulation-based validation for the
`Initial diagnostic`, and how to validate deterministic selection and scoring
policies before there is enough real learner traffic.

Use this document when you change the initial diagnostic selector, scoring
policy, diagnostic item metadata, or onboarding question bank.

For the persistence model, see `docs/competency-database-schema.md`. For the
architectural decision to keep runtime diagnostic behavior deterministic, see
`docs/adr/0006-use-deterministic-initial-diagnostic-selection.md`. For
diagnostic attempt auditability, see
`docs/adr/0010-use-diagnostic-attempts-for-onboarding-auditability.md`.

## Problem

The initial diagnostic must estimate a learner's starting `Competency profile`
from a short onboarding session. The selector has a limited question budget, so
each item must provide useful evidence without over-sampling one competency,
family, mode, or difficulty band.

Early in the product, there won't be enough real learner data to calibrate
selection weights, scoring thresholds, repair limits, or prerequisite inference
empirically. This creates several risks:

- The selector may repeat the same competency too often.
- The selector may probe higher difficulty bands too early or too late.
- Repair items may consume too much of the onboarding budget.
- Goal priority may dominate diagnostic value instead of acting as a small
  tie-breaker.
- Sparse or noisy evidence may overestimate or underestimate learner ability.
- Item metadata errors may look like algorithm errors.
- A policy change may improve one hand-picked flow while making many other
  flows worse.

Simulation tests reduce these risks before live learner data exists. They don't
prove that the diagnostic is perfectly calibrated, but they make policy changes
observable, repeatable, and reviewable.

## Validation goals

Initial diagnostic validation should answer these questions:

- Does the selector cover enough distinct competencies in the item budget?
- Does the selector respect `maxItems`, `maxItemsPerCompetency`,
  `maxRepairItems`, and `maxRepairItemsPerCompetency`?
- Does the selector use higher-band probes after strong lower-band evidence?
- Does a higher-band miss avoid negative prerequisite inference?
- Do repair items appear when they add value, rather than immediately after
  every miss?
- Does the final evidence profile match the simulated learner's underlying
  strengths and gaps?
- Are results stable across small random response variations?
- Are policy changes improvements across a portfolio of learner personas, not
  only one transcript?

The main validation target is the `Competency profile`, not a learner-facing
CEFR label. CEFR-like bands are useful internal difficulty references, but the
product should evaluate whether the diagnostic discovers useful competency
signals.

## Validation layers

Use several test layers because each one catches a different class of failure.

### Deterministic sanity tests

Deterministic persona tests are the simplest baseline. A deterministic persona
answers all items at or below its configured ability and misses items above it.

Use these tests to verify hard invariants:

- item limits are enforced;
- repeated competency limits are enforced;
- tie-breakers remain stable;
- strong lower-band evidence can trigger higher-band probing;
- errors in higher-band items don't produce negative prerequisite inference;
- `dont_know` responses don't create positive evidence.

These tests should not be the main calibration tool. Real learners have uneven
competencies, lucky guesses, careless mistakes, and format-specific strengths.
Deterministic personas are useful because they are easy to reason about, not
because they model learner behavior accurately.

### Probabilistic competency-vector personas

Probabilistic personas should be the primary pre-launch validation tool. Model
each persona as a vector of competency abilities instead of a single CEFR level.

Example persona shape:

```json
{
  "id": "a1-grammar-gaps",
  "description": "Understands basic vocabulary but struggles with word order.",
  "competencyAbilities": {
    "en.a1.basic-greetings": 0.95,
    "en.a1.subject-pronouns": 0.85,
    "en.a1.be-present-statements": 0.75,
    "en.a1.basic-word-order": 0.45,
    "en.a2.past-events": 0.15
  },
  "formatModifiers": {
    "multiple_choice": 0.08,
    "fill_blank_choice": 0,
    "word_bank_sequence": -0.12
  },
  "familyModifiers": {
    "vocabulary": 0.1,
    "grammar": -0.08
  },
  "noise": {
    "carelessErrorRate": 0.08,
    "luckyGuessRate": 0.05,
    "dontKnowRateAboveAbility": 0.25
  }
}
```

The simulator should estimate answer probability from the item targets and
metadata:

```text
answerProbability =
  weighted competency ability
  + response format modifier
  + competency family modifier
  + item difficulty adjustment
  + random noise
```

The exact formula can evolve, but it must stay deterministic for a given seed.
That lets policy comparisons replay the same simulated learners against
different policy versions.

### Monte Carlo policy simulation

Run many seeded simulations for each persona and policy version. Monte Carlo
simulation helps detect policy behavior that doesn't appear in one transcript.

Track these aggregate metrics:

- average answered item count;
- average distinct primary competencies covered;
- average direct and inferred evidence counts;
- distribution of selected difficulty bands;
- distribution of selected families and modes;
- average repair item count;
- percentage of runs that hit repair limits;
- percentage of runs that hit repeated competency limits;
- final ability estimate error against the persona vector;
- confidence distribution by competency;
- item exposure distribution;
- transcript stability across seeds.

Use these metrics to compare policy versions. A policy change should improve
the intended metric without creating unacceptable regressions in coverage,
repair usage, difficulty probing, or evidence quality.

### Adversarial personas

Add personas that intentionally stress weak assumptions:

- a learner who guesses often;
- a learner who selects `dont_know` for every unfamiliar item;
- a learner who is strong in vocabulary but weak in grammar;
- a learner who is strong in recognition formats but weak in production
  formats;
- a learner who misses an easy item but answers a harder item correctly;
- a learner who always selects the first option.

These personas help validate that the diagnostic doesn't over-trust sparse
positive evidence or over-react to one surprising miss.

### Transcript review

Generate representative transcripts from the simulator and review them
manually. A transcript should include:

- selected item keys in order;
- selected role and selection trace score;
- simulated response;
- score and confidence;
- emitted `mistakeCode`s;
- direct evidence updates;
- prerequisite inference updates;
- final diagnostic summary.

Use transcript review to catch problems that metrics hide, such as strange item
ordering, confusing repair choices, or evidence that is technically valid but
pedagogically hard to defend.

### LLM-assisted qualitative review

LLMs can support qualitative review, but they should not be the main simulator
for policy calibration.

Use LLMs to:

- identify ambiguous prompts;
- suggest missing acceptable answers;
- critique distractor quality;
- propose plausible `mistakeCode`s;
- review simulated transcripts for suspicious item sequences;
- generate draft persona descriptions for human review.

Do not use LLM responses as authoritative learner behavior. An LLM can imitate
an A1 or A2 learner, but it isn't a calibrated sample of that population. It
may know too much, fail in artificial ways, or change behavior when the prompt
changes.

## Required simulator behavior

The validation simulator should:

- run without network access or runtime LLM calls;
- use the same published question bank shape as the API runtime;
- use the same deterministic selector and scorer as production code;
- accept a policy configuration and policy version;
- accept a seed for reproducible probabilistic runs;
- emit machine-readable metrics;
- emit human-readable transcripts;
- support policy comparison from the same seeds and personas.

The simulator doesn't need to persist attempts through Prisma. It can run in
memory as long as it uses the same selection, scoring, item metadata, and
evidence-publication rules that production uses.

## Policy change workflow

Use this workflow when changing diagnostic selection or scoring policy:

1. Add or update deterministic sanity tests for the intended behavior.
2. Run the persona simulation suite against the current policy.
3. Run the same suite against the proposed policy with the same seeds.
4. Compare aggregate metrics and transcript samples.
5. Review regressions in coverage, repair usage, higher-band probing, evidence
   error, and item exposure.
6. Save the policy version, policy config, metrics summary, and notable
   transcript examples with the change.

Do not tune weights from one transcript. Treat one transcript as a debugging
artifact. Use aggregate metrics across personas and seeds to decide whether a
policy is better.

## Acceptance criteria for pre-launch validation

Before relying on a diagnostic policy for onboarding, it should meet these
minimum criteria:

- Deterministic sanity tests cover the core selector invariants.
- Probabilistic simulations cover multiple competency-vector personas.
- Adversarial personas don't produce obvious overconfidence or repeated
  over-sampling.
- Policy metrics are stable enough that small seed changes don't reverse the
  conclusion.
- Human review finds the representative transcripts pedagogically defensible.
- The policy version and configuration are stored with diagnostic attempts for
  auditability.

These criteria don't replace real learner validation. They create a safer
starting point and make future live-data calibration easier to interpret.
