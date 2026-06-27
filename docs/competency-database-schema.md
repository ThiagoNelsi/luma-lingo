# Competency database schema

This document explains the competency-related database models in
`packages/database/prisma/schema.prisma` and agreed schema additions that are
ready for implementation. Use it when you need to author catalog importers,
write planner queries, build diagnostic scoring, or review how learner progress
is stored.

For domain language, use `CONTEXT.md`. For the architectural reasons behind
this shape, use the competency ADRs in `docs/adr/`.

## Model overview

The schema separates three concerns:

- `CompetencyCatalog`, `Competency`, `CompetencyPrerequisite`, and
  `CompetencyGoalPriority` define the versioned curriculum graph.
- `DiagnosticItem` and `DiagnosticItemCompetencyTarget` define the audited
  onboarding question bank.
- `DiagnosticAttempt` and `DiagnosticAttemptItem` record one learner's
  diagnostic execution, selected items, responses, deterministic scores, and
  audit trace.
- `CompetencyEvidence` and `LearnerCompetencyState` store learner observations
  and the current learner estimate per competency.

`LearningTrack` connects a learner's target language to a catalog version
through `competencyCatalogId`. A track can exist without a catalog during early
onboarding or while a catalog is not published yet.

## Relationship map

```text
LearningTrack
  -> CompetencyCatalog?
  -> DiagnosticAttempt[]
  -> LearnerCompetencyState[]
  -> CompetencyEvidence[]

CompetencyCatalog
  -> Competency[]
  -> DiagnosticItem[]
  -> DiagnosticAttempt[]

Competency
  -> CompetencyPrerequisite[] as the competency being unlocked
  -> CompetencyPrerequisite[] as the prerequisite
  -> CompetencyGoalPriority[]
  -> DiagnosticItem[] as the primary diagnostic competency
  -> DiagnosticItemCompetencyTarget[]
  -> LearnerCompetencyState[]
  -> CompetencyEvidence[]

DiagnosticItem
  -> Competency as primaryCompetency
  -> DiagnosticItemCompetencyTarget[]
  -> DiagnosticAttemptItem[]

DiagnosticAttempt
  -> LearningTrack
  -> CompetencyCatalog
  -> DiagnosticAttemptItem[]

DiagnosticAttemptItem
  -> DiagnosticAttempt
  -> DiagnosticItem
```

## CompetencyCatalog

`CompetencyCatalog` is a versioned curriculum graph for one target language.
Only published catalog versions should be used for learner planning,
diagnostics, lesson generation, and progress tracking.

Important fields:

- `targetLanguage`: The target language for the catalog. Use the same language
  code vocabulary used by onboarding.
- `version`: The catalog version, such as `2026.06.english.mvp`.
- `status`: Publication status. Current expected values are `draft`,
  `reviewed`, and `published`; validate these in application code until an enum
  is justified.
- `publishedAt`: The time the catalog became approved for runtime use.
- `sourceChecksum`: Optional checksum of the authored source file. Use it to
  detect whether imported runtime rows match the source artifact.
- `metadata`: JSONB for catalog-level details, such as authoring notes,
  schema version, supported goals, or source file references.

Example `metadata`:

```json
{
  "schemaVersion": 1,
  "source": "data/catalogs/en/grammar-competencies.json",
  "supportedGoals": ["everyday_conversation", "work", "travel"]
}
```

## Competency

`Competency` is a measurable language capability inside one catalog version.
It may represent situational communication, grammar, vocabulary,
comprehension, production, or another competency family.

Important fields:

- `key`: Stable identifier inside a catalog. Use it to connect source files,
  diagnostics, planner logic, and evidence without depending on UI text.
  Example: `en.a1.introduce-self`.
- `title`: Human-readable authoring title. This is not necessarily learner UI
  copy.
- `description`: Optional authoring explanation for the capability.
- `family`: Broad category of capability. Example values: `situational`,
  `grammar`, `vocabulary`, `reading`, `writing`, and `listening`.
- `mode`: Dominant evidence or practice mode when one mode is clear. Example
  values: `reading`, `writing`, or `listening`. Leave it null when the
  competency is cross-mode.
- `difficultyBand`: Internal difficulty reference. Do not present this as a
  learner-facing CEFR promise.
- `isCore`: Marks foundational competencies relevant to every learner,
  regardless of goal.
- `details`: JSONB for language-specific or version-specific curriculum
  detail that is not queryable enough to deserve columns yet.

Example `details` for a grammar competency:

```json
{
  "schemaVersion": 1,
  "grammarTopics": ["present_simple", "subject_verb_agreement"],
  "commonErrors": [
    {
      "code": "missing_auxiliary_do",
      "description": "Learner forms questions without do or does."
    }
  ],
  "exampleForms": ["Do you work?", "Does she study?"]
}
```

Example `details` for a situational competency:

```json
{
  "schemaVersion": 1,
  "situations": ["first_meeting", "class_introduction"],
  "sampleUtterances": ["My name is Ana.", "I work in design."],
  "supportingGrammar": ["en.a1.to-be-present-statements"]
}
```

## CompetencyPrerequisite

`CompetencyPrerequisite` links one competency to another competency that should
usually be present first.

Important fields:

- `competencyId`: The competency being unlocked or made easier.
- `prerequisiteId`: The competency that should usually be present before the
  target competency.
- `strength`: Optional readiness weight from `0` to `100`. Use high values for
  near-blocking prerequisites and lower values for helpful but non-blocking
  support.
- `details`: JSONB for authoring notes about why the relationship exists.

Example:

```text
competencyId: en.a1.ask-basic-personal-questions
prerequisiteId: en.a1.use-to-be-in-questions
strength: 90
```

That relationship says the learner usually needs question forms with `to be`
before a module can focus on asking basic personal questions.

## CompetencyGoalPriority

`CompetencyGoalPriority` assigns goal relevance to a competency without
duplicating the competency per goal.

Important fields:

- `goal`: A product goal such as `everyday_conversation`, `work`, or `travel`.
- `priority`: Relevance score from `0` to `100`, not an ordinal rank. Higher
  values mean the competency matters more for that goal.
- `details`: JSONB for rationale or goal-specific notes.

Example:

```text
competency: en.a1.ask-for-directions
goal: travel
priority: 100
```

Use `priority` for weighted scoring. If the product later needs explicit
ordinal groups, add a separate field such as `priorityBand` rather than
changing the meaning of `priority`.

## DiagnosticItem

`DiagnosticItem` is an audited prompt used by the initial diagnostic. The item
has one primary competency and may include secondary targets through
`DiagnosticItemCompetencyTarget`.

Important fields:

- `key`: Stable item identifier inside the catalog. Example:
  `en.diag.a1.word-bank.introduce-self.001`.
- `primaryCompetencyId`: The main competency this item measures. Use this for
  deterministic item selection and the main evidence update.
- `difficultyBand`: Internal difficulty for diagnostic selection.
- `responseFormat`: Expected response shape. Example values:
  `word_bank_sequence`, `multiple_choice`, and `fill_blank_choice` for the MVP.
- `status`: Authoring status. Current expected values are `draft`, `reviewed`,
  and `published`; validate these in application code.
- `prompt`: JSONB prompt payload. Its shape depends on `responseFormat`.
- `scoringRule`: JSONB deterministic scoring rule. See the examples below.
- `details`: JSONB for authoring notes, distractor rationale, localization
  notes, item safety notes, and `diagnosticRoles`.
- `reviewedAt`: Time the item was reviewed for learner use.
- `publishedAt`: Time the item became available for runtime selection.

Example `details`:

```json
{
  "schemaVersion": 1,
  "diagnosticRoles": ["foundation_probe", "ceiling_probe"],
  "rationale": "Checks simple subject-verb-object construction.",
  "safetyNotes": [],
  "localizationNotes": []
}
```

Example `prompt` for a word bank item:

```json
{
  "schemaVersion": 1,
  "instruction": "Arrange the words to introduce yourself.",
  "wordBank": ["teacher", "am", "I", "a"],
  "displayLanguage": "en"
}
```

## DiagnosticItemCompetencyTarget

`DiagnosticItemCompetencyTarget` records every competency that can receive
evidence from one diagnostic item.

Important fields:

- `role`: The target's role in the item. Use `primary` for the main target and
  `supporting` for additional evidence targets.
- `weight`: Relative contribution from `0` to `100`. A high weight means the
  response is strong evidence for that competency.
- `details`: JSONB for target-specific scoring notes.

Example:

```text
diagnostic item: en.diag.a1.word-bank.introduce-self.001
target: en.a1.introduce-self
role: primary
weight: 100

target: en.a1.to-be-present-statements
role: supporting
weight: 60
```

The primary competency gets the clearest evidence. The supporting grammar
competency can also update the learner's profile, but with less influence.

## DiagnosticAttempt

`DiagnosticAttempt` records one execution of the initial diagnostic or a future
diagnostic-like flow for one learning track. The MVP uses it for the onboarding
initial diagnostic. An in-progress attempt may be resumed for up to 48 hours;
stale attempts are marked abandoned before a new attempt starts.

Important fields:

- `learningTrackId`: The learning track being diagnosed.
- `catalogId`: The catalog version used for item selection.
- `purpose`: Why the attempt exists. The MVP value is
  `onboarding_initial`; future values may include `recalibration` or
  `internal_qa`.
- `status`: Attempt state. Expected MVP values are `in_progress`,
  `completed`, and `abandoned`; validate these in application code until an
  enum is justified.
- `selectionPolicyVersion`: Version of the deterministic item-selection policy.
- `scoringPolicyVersion`: Version of the policy that converts item scores into
  diagnostic evidence and learner competency state.
- `startedAt`: Time the attempt started.
- `completedAt`: Time the attempt completed automatically, if completed.
- `abandonedAt`: Time the attempt was abandoned, if abandoned.
- `summary`: JSONB final attempt summary. It is written when the attempt
  completes, not incrementally after every item.
- `details`: JSONB for algorithm notes, stale-attempt reason, or operational
  metadata.

Expected constraints and indexes:

```text
@@index([learningTrackId, status])
@@index([learningTrackId, purpose, status])
@@index([catalogId])
```

The MVP should enforce only one `in_progress` attempt per
`learningTrackId + purpose` in application code. A partial unique index can be
added manually later if runtime behavior shows it is needed.

Example final `summary`:

```json
{
  "schemaVersion": 1,
  "answeredItemCount": 8,
  "estimatedStartingBand": "A1",
  "overallConfidence": 0.72,
  "strongCompetencyKeys": ["pre-a1-core-be-present-affirmative"],
  "weakCompetencyKeys": ["a1-core-present-simple-questions"],
  "stopReason": "max_items_reached"
}
```

## DiagnosticAttemptItem

`DiagnosticAttemptItem` records one diagnostic item shown inside a diagnostic
attempt. It is created when the item is shown, then updated when the learner
answers. The MVP does not store a separate item status; an item with a null
`answeredAt` or null `response` is not answered.

Important fields:

- `attemptId`: The diagnostic attempt containing this item.
- `diagnosticItemId`: The audited item that was shown.
- `position`: One-based item order inside the attempt.
- `selectedForRole`: The single diagnostic role that caused the selector to
  choose this item in this attempt.
- `selectionRule`: Stable rule identifier for why the item was selected.
- `selectionTrace`: JSONB deterministic audit trace for candidate ranking,
  thresholds, secondary matches, or tie breakers.
- `response`: Nullable JSONB structured learner response.
- `score`: Nullable normalized score from `0` to `1`.
- `confidence`: Nullable scoring confidence from `0` to `1`.
- `shownAt`: Time the item was shown to the learner.
- `answeredAt`: Time the learner answered, if answered.
- `details`: JSONB for matched criteria, missed criteria, mistake codes, or
  response-kind notes.
- `createdAt`: Technical row creation time.
- `updatedAt`: Technical row update time.

Expected constraints and indexes:

```text
@@unique([attemptId, position])
@@unique([attemptId, diagnosticItemId])
@@index([diagnosticItemId])
@@index([selectedForRole])
@@index([selectionRule])
```

Example `selectionTrace`:

```json
{
  "schemaVersion": 1,
  "desiredRole": "ceiling_probe",
  "candidateCount": 14,
  "rankedPosition": 1,
  "currentBandEstimate": "Pre-A1",
  "foundationScore": 0.86,
  "threshold": 0.75,
  "secondaryMatches": ["goal_probe"],
  "tieBreaker": "attempt_seed"
}
```

Example multiple-choice response:

```json
{
  "kind": "selected_options",
  "selectedOptionIds": ["option_b"]
}
```

Example word-bank response:

```json
{
  "kind": "word_bank_sequence",
  "submittedSequence": ["I", "am", "a", "teacher"]
}
```

Example don't-know response:

```json
{
  "kind": "dont_know"
}
```

The don't-know response is an answered diagnostic item. It receives no positive
score and should carry moderate confidence because it is a clearer signal than
a wrong guess, but still may reflect fatigue, anxiety, or low effort.

## LearnerCompetencyState

`LearnerCompetencyState` is the current summary for one learner, one learning
track, and one competency. It exists only after the system has evidence. A
missing row means unknown, not unmastered.

Important fields:

- `abilityEstimate`: Current normalized estimate from `0` to `1`. The exact
  interpretation belongs to the scoring algorithm.
- `confidence`: Confidence in the estimate from `0` to `1`.
- `evidenceCount`: Count of evidence observations included in the summary.
- `lastEvidenceAt`: Time of the latest observation included in the summary.
- `details`: JSONB for algorithm-specific state, such as decay inputs,
  mastery bands, or last scoring version.

`lastEvidenceAt` does not replace evidence history. The full history lives in
`CompetencyEvidence`. Keep this field on the state row so planner queries can
quickly find stale or recently updated estimates without scanning all evidence.

Example `details`:

```json
{
  "schemaVersion": 1,
  "stateVersion": "initial-diagnostic-v1",
  "masteryBand": "emerging",
  "lastUpdateReason": "initial_diagnostic"
}
```

## CompetencyEvidence

`CompetencyEvidence` is the append-only observation history that informs the
learner's competency profile.

Important fields:

- `sourceType`: Origin of the observation. Expected values include
  `initial_diagnostic`, `lesson_activity`, `lesson_review`, and
  `manual_adjustment`.
- `sourceId`: Optional identifier of the source record. This may reference a
  diagnostic attempt item, activity response, lesson report, or internal event.
- `observedAt`: Time the learner produced the behavior being observed.
- `score`: Optional normalized score from `0` to `1`.
- `confidence`: Optional confidence from `0` to `1` for this observation.
- `details`: JSONB for evidence-specific data, such as matched criteria,
  response summaries, mistake codes, or scoring version.

Example evidence:

```json
{
  "sourceType": "initial_diagnostic",
  "sourceId": "diagnostic-attempt-item-uuid",
  "score": 0.8,
  "confidence": 0.7,
  "details": {
    "schemaVersion": 1,
    "scoringRuleVersion": "word-bank-sequence-v1",
    "matchedCriteria": [
      "all_required_words_used",
      "correct_subject_verb_order"
    ],
    "missedCriteria": ["correct_article_before_job"]
  }
}
```

## JSONB details fields

The `details` and `metadata` fields are escape hatches for versioned curriculum
payloads, not unstructured storage for arbitrary data.

Use a JSONB field when all of these are true:

- The data varies by target language, catalog version, item format, or scoring
  version.
- The planner doesn't need to filter or join on that data yet.
- Application code validates the payload with a Zod schema before use.
- The payload includes a `schemaVersion` when its shape may evolve.

Promote JSONB data to columns when planner queries, diagnostic selection,
reporting, or database constraints need to inspect it directly.

## Scoring rule examples

`scoringRule` must be deterministic for the initial diagnostic. The runtime
can use an LLM to author drafts offline, but runtime scoring must not depend on
LLM judgment.

For the MVP, the scorer produces one item-level `score` and `confidence`.
Evidence is distributed to the primary and supporting diagnostic targets using
target weights when the attempt completes.

### Word bank sequence

Use this shape when the learner selects or arranges provided words.

```json
{
  "schemaVersion": 1,
  "kind": "word_bank_sequence",
  "maxScore": 1,
  "correctSequences": [["I", "am", "a", "teacher"]],
  "normalization": {
    "case": "lower",
    "trimWhitespace": true,
    "ignoreTerminalPunctuation": true
  },
  "partialCredit": [
    {
      "criterion": "all_required_words_used",
      "score": 0.4
    },
    {
      "criterion": "correct_subject_verb_order",
      "score": 0.4
    },
    {
      "criterion": "correct_article_before_job",
      "score": 0.2
    }
  ],
  "passingScore": 0.75,
  "evidenceConfidence": 0.7
}
```

This rule gives full credit for the exact sequence. It can also award partial
credit for observable criteria. The scoring implementation must define how
each criterion is detected.

### Multiple choice

Use this shape when one or more fixed options are correct.

```json
{
  "schemaVersion": 1,
  "kind": "multiple_choice",
  "maxScore": 1,
  "correctOptionIds": ["option_b"],
  "distractors": {
    "option_a": {
      "mistakeCode": "uses_subject_instead_of_object_pronoun"
    },
    "option_c": {
      "mistakeCode": "wrong_verb_form"
    }
  },
  "passingScore": 1,
  "evidenceConfidence": 0.8
}
```

Distractor metadata helps convert wrong answers into useful evidence and
feedback without changing the deterministic score.

### Fill blank choice

Use this shape when the learner chooses one option for a blank inside a
sentence or short text.

```json
{
  "schemaVersion": 1,
  "kind": "fill_blank_choice",
  "maxScore": 1,
  "blankId": "blank_1",
  "correctOptionIds": ["option_an"],
  "distractors": {
    "option_a": {
      "mistakeCode": "wrong_article_before_vowel_sound"
    }
  },
  "passingScore": 1,
  "evidenceConfidence": 0.75
}
```

### Independent text with checklist scoring

Use this shape only for tightly constrained text answers. The initial
diagnostic should unlock these items only after strong assisted-item evidence.

```json
{
  "schemaVersion": 1,
  "kind": "checklist_text",
  "maxScore": 1,
  "acceptedPatterns": [
    {
      "pattern": "^i am (a|an) [a-z ]+$",
      "flags": "i"
    },
    {
      "pattern": "^my name is [a-z ]+$",
      "flags": "i"
    }
  ],
  "criteria": [
    {
      "criterion": "uses_first_person_introduction",
      "score": 0.5
    },
    {
      "criterion": "uses_valid_basic_clause",
      "score": 0.5
    }
  ],
  "passingScore": 0.75,
  "evidenceConfidence": 0.55
}
```

Prefer constrained formats when possible. Free text is harder to score
deterministically and should carry lower evidence confidence unless the rule
is narrow and well-tested.

## Authoring guidelines

- Keep `key` values stable for the life of a catalog version.
- Prefer `details` for examples, common errors, forms, and authoring notes.
- Prefer columns for data needed in selection, filtering, joins, constraints,
  or planner scoring.
- Use `CompetencyGoalPriority` for goal relevance. Don't duplicate
  competencies for each goal.
- Use `CompetencyPrerequisite` for readiness relationships. Don't encode
  prerequisite graphs only inside JSONB.
- Write every diagnostic item with one primary competency, even when it also
  produces supporting evidence.
- Keep `diagnosticRoles` in `DiagnosticItem.details` for the MVP. Promote them
  to columns or a relation only if database-level role queries become necessary.
- Treat don't-know responses as answered items, not skipped items.
- Create formal diagnostic `CompetencyEvidence` only when a diagnostic attempt
  completes. Abandoned attempt items remain available for analytics but do not
  update the learner's competency profile.
- Store formal observations in `CompetencyEvidence`; update
  `LearnerCompetencyState` as the current summary.
