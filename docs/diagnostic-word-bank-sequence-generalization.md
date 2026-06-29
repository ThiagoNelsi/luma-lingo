# Diagnostic word bank sequence generalization

This document defines how `word_bank_sequence` diagnostic items should scale
across target languages without turning the runtime scorer into a language-
specific grammar engine.

Use this document when authoring onboarding diagnostic items, extending the
diagnostic question schemas, or implementing deterministic scoring for
`word_bank_sequence`.

For the broader persistence model, see
`docs/competency-database-schema.md`. For diagnostic attempt auditability, see
`docs/adr/0010-use-diagnostic-attempts-for-onboarding-auditability.md`.

## Problem

`multiple_choice` and `fill_blank_choice` items have fixed wrong options. A
wrong answer can map directly to a distractor-level `mistakeCode`.

`word_bank_sequence` is different. The learner can arrange tokens in many wrong
orders. If the scorer tries to understand every possible sentence
linguistically, it will become:

- too coupled to English grammar;
- hard to extend to Spanish, French, German, Chinese, or other languages;
- hard to test deterministically;
- hard to author safely without runtime LLM judgment.

The app needs a format that supports useful diagnostic feedback while keeping
runtime logic generic and deterministic.

## Decision

For `word_bank_sequence`, `mistakeCode`s should come from failed declarative
criteria in the item's `scoringRule`, not from hard-coded grammar logic.
Each criterion should emit the most specific `mistakeCode` it can justify.
Generic codes such as `grammar.word_order.wrong_order` must be fallbacks, not
the default for every ordering problem.

Do not store a separate `feature` attribute on each criterion in the MVP. In
most cases, it duplicates the `mistakeCode`. For example,
`grammar.be.wrong_position` already says the failed criterion is about the
position of `be`. If selection needs a broader grouping later, derive that
grouping from a declarative mistake map keyed by `mistakeCode`.

The runtime scorer should understand only a small set of generic criterion
types, such as:

- exact sequence match;
- all required tokens used;
- no extra tokens;
- relative order between tokens;
- adjacency between tokens;
- token at a specific position;
- token before or after an item-local group.

The runtime scorer should not have built-in concepts such as:

- subject;
- verb;
- object;
- article;
- adjective;
- German verb-second;
- French negation;
- Chinese word order.

Those concepts may appear in authoring notes, item-local token group names, or
`mistakeCode`s, but the scorer should only evaluate token IDs and generic
criteria.

## Core Principle

The item owns the linguistic interpretation. The runtime owns only deterministic
evaluation.

In other words:

```text
authored item:
  "token_a must appear before token_b"
  "if this fails, emit grammar.be.wrong_position"

runtime:
  compare token positions
  emit the configured mistakeCode when the criterion fails
```

The runtime does not need to know why the token order matters.

This remains generic because the specificity is authored data. The runtime does
not infer that a token is a verb, preposition, negation marker, article, or
object. It only records what the criterion declared.

## Recommended Payload Shape

The current Zod contract accepts `correctTokenSequences` for
`word_bank_sequence`. Before generating richer `word_bank_sequence` items, the
contract should be extended with optional `criteria`.

Recommended shape:

```json
{
  "schemaVersion": 1,
  "kind": "word_bank_sequence",
  "maxScore": 1,
  "correctTokenSequences": [["token_i", "token_am", "token_ready"]],
  "criteria": [
    {
      "id": "subject_before_be",
      "type": "relative_order",
      "left": ["token_i"],
      "right": ["token_am"],
      "score": 0.4,
      "mistakeCodeOnFail": "grammar.be.wrong_position",
      "rationale": "The subject should appear before the be form in this statement."
    },
    {
      "id": "all_tokens_used",
      "type": "all_required_tokens_used",
      "score": 0.2,
      "mistakeCodeOnFail": "response.incomplete_sequence",
      "rationale": "The answer should use all required tokens."
    }
  ],
  "fallbackMistakeCode": "response.invalid_sequence",
  "passingScore": 1,
  "evidenceConfidence": 0.79
}
```

The `id` and `rationale` are for auditability. The runtime only needs `type`,
token references, score, and `mistakeCodeOnFail` to score the item. It should
persist the failed criterion's `id`, `mistakeCodeOnFail`, and `rationale` in
scoring details.

## Prompt Tokens

Prompt tokens should use stable IDs. Display text may contain any target
language script.

Example:

```json
{
  "schemaVersion": 1,
  "kind": "word_bank_sequence",
  "instructionLocalizations": {
    "pt": "Organize as palavras.",
    "en": "Arrange the words."
  },
  "contentLanguage": "en",
  "tokens": [
    { "id": "token_i", "text": "I" },
    { "id": "token_am", "text": "am" },
    { "id": "token_ready", "text": "ready" }
  ]
}
```

The scorer should score token IDs, not display text. This avoids ambiguity from
capitalization, punctuation, scripts without spaces, or repeated words.

If repeated display text appears, IDs still disambiguate each token:

```json
[
  { "id": "token_that_1", "text": "that" },
  { "id": "token_that_2", "text": "that" }
]
```

## Criterion Types

The MVP should start with a small language-neutral vocabulary.

### `all_required_tokens_used`

Passes when the learner selected every required token. Useful for incomplete
answers. If `requiredTokens` is omitted, all prompt token IDs are required.

```json
{
  "id": "all_tokens_used",
  "type": "all_required_tokens_used",
  "requiredTokens": ["token_i", "token_am", "token_ready"],
  "score": 0.2,
  "mistakeCodeOnFail": "response.incomplete_sequence",
  "rationale": "The answer should use all required tokens."
}
```

### `no_extra_tokens`

Passes when the learner selected no token outside the allowed set. This matters
when future variants allow optional distractor tokens.

```json
{
  "id": "no_extra_tokens",
  "type": "no_extra_tokens",
  "score": 0.1,
  "mistakeCodeOnFail": "response.extra_token",
  "rationale": "The answer includes a token that should not be used."
}
```

### `relative_order`

Passes when every token in `left` appears before every token in `right`.

```json
{
  "id": "pronoun_before_be",
  "type": "relative_order",
  "left": ["token_she"],
  "right": ["token_is"],
  "score": 0.4,
  "mistakeCodeOnFail": "grammar.be.wrong_position",
  "rationale": "In this English statement, the subject pronoun appears before the be form."
}
```

The criterion is generic. The rationale explains the language-specific reason.

### `adjacency`

Passes when listed tokens are adjacent in the specified order.

```json
{
  "id": "ne_before_verb",
  "type": "adjacency",
  "tokens": ["token_ne", "token_suis"],
  "score": 0.2,
  "mistakeCodeOnFail": "grammar.negation.wrong_position",
  "rationale": "In this French item, ne should appear immediately before the verb."
}
```

Use this only when adjacency is required by the item. Do not use it for
language patterns where intervening words are valid.

### `token_at_position`

Passes when a token appears at a specific 1-based position.

```json
{
  "id": "verb_second",
  "type": "token_at_position",
  "token": "token_trinke",
  "position": 2,
  "score": 0.4,
  "mistakeCodeOnFail": "grammar.word_order.verb_position",
  "rationale": "In this German main-clause item, the finite verb should appear in second position."
}
```

The runtime does not know German verb-second. It only checks that
`token_trinke` is in position `2`.

### `token_before_group` and `token_after_group`

Passes when a token appears before or after any token in an item-local group.
Groups are defined inside the item, not globally.

```json
{
  "tokenGroups": {
    "finite_verb": ["token_trinke"],
    "time_expression": ["token_heute"],
    "object": ["token_kaffee"]
  },
  "criteria": [
    {
      "id": "time_before_object",
      "type": "token_before_group",
      "token": "token_heute",
      "group": "object",
      "score": 0.2,
      "mistakeCodeOnFail": "grammar.word_order.wrong_order",
      "rationale": "This item expects the time expression before the object."
    }
  ]
}
```

Groups are authoring conveniences. They should not become global semantic roles
that the runtime interprets across languages.

## Mistake Code Rules

Use the existing normalized format:

```text
{domain}.{family}.{error}
```

Examples:

```text
grammar.word_order.wrong_order
grammar.word_order.verb_position
grammar.be.wrong_position
grammar.negation.wrong_position
grammar.preposition.wrong_position
grammar.article.gender_agreement
grammar.noun_number.plural_agreement
response.incomplete_sequence
response.extra_token
response.invalid_sequence
```

Rules:

- Do not include the target language in `mistakeCode`.
- Use the most specific `mistakeCode` that the failed criterion can justify.
- Put language-specific explanation in `rationale`.
- Use the same `mistakeCode` across languages when the conceptual error is
  equivalent.
- Add a future `languageSpecificCode` only if analytics later prove that a
  language-specific split is useful.
- For `word_bank_sequence`, mistake codes come from failed criteria.
- If no criterion explains the wrong sequence, use `fallbackMistakeCode`.
- Keep `fallbackMistakeCode` broad, such as `response.invalid_sequence` or
  `grammar.word_order.wrong_order`.

If selection or analytics need a stable grouping that is broader or different
from the exact `mistakeCode`, define that grouping in a separate mistake map.
Do not repeat it on every criterion.

Example:

```json
{
  "grammar.be.wrong_position": {
    "selectionTags": ["be_position", "auxiliary_position"],
    "repairCompetencies": ["pre-a1-core-be-present-affirmative"]
  }
}
```

This keeps authored items smaller and makes future changes cheaper. Updating a
selection grouping requires one map change, not edits across many questions.

Only add criterion-level metadata later if real data shows that the same
`mistakeCode` must produce different selection behavior depending on the local
criterion. Treat that as a schema evolution, not an MVP requirement.

## Scoring Flow

Recommended deterministic scoring flow:

1. If the response kind is `dont_know`, return score `0`, confidence `0.6`,
   and `response.dont_know`.
2. If the selected token ID sequence exactly matches one of
   `correctTokenSequences`, return score `1` and no mistake code.
3. Otherwise, evaluate every criterion.
4. Add the score from each passing criterion.
5. Emit `mistakeCodeOnFail` for each failed criterion.
6. If no failed criterion emitted a mistake code, emit `fallbackMistakeCode`.
7. Clamp the final score to `0..1`.

The scorer should record matched criteria, failed criteria, score, confidence,
and emitted mistake codes in `DiagnosticAttemptItem.details`.

Recommended failed-criterion detail shape:

```json
{
  "criterionId": "is_before_tired",
  "mistakeCode": "grammar.be.wrong_position",
  "rationale": "The be form should appear before the adjective complement in this item."
}
```

This gives future selection logic enough specificity without making the scorer
language-aware. The selector can look up `grammar.be.wrong_position` in a
declarative mistake map when it needs repair competencies, severity, or
selection tags.

## Confidence

`word_bank_sequence` confidence should use the same general formula as other
diagnostic items:

```text
evidenceConfidence =
  variantBaseConfidence
  * formatReliability
  * structureReliability
```

Then clamp the value:

```text
min 0.4
max 0.9
```

For `word_bank_sequence`, `structureReliability` should come mainly from token
count:

```text
2 tokens: 0.85
3 tokens: 0.95
4-6 tokens: 1.00
7-9 tokens: 1.03
10-12 tokens: 1.05
```

The reason is practical: two-token items are often close to binary choice, while
four to six tokens usually provide a better signal. Longer sequences can add
evidence, but they also increase working-memory load, so the multiplier should
rise slowly and stay capped.

## Example: English

Target sentence:

```text
She is tired.
```

Prompt:

```json
{
  "schemaVersion": 1,
  "kind": "word_bank_sequence",
  "instructionLocalizations": {
    "pt": "Organize as palavras.",
    "en": "Arrange the words."
  },
  "contentLanguage": "en",
  "tokens": [
    { "id": "token_she", "text": "She" },
    { "id": "token_is", "text": "is" },
    { "id": "token_tired", "text": "tired" }
  ]
}
```

Scoring rule:

```json
{
  "schemaVersion": 1,
  "kind": "word_bank_sequence",
  "maxScore": 1,
  "correctTokenSequences": [["token_she", "token_is", "token_tired"]],
  "criteria": [
    {
      "id": "she_before_is",
      "type": "relative_order",
      "left": ["token_she"],
      "right": ["token_is"],
      "score": 0.4,
      "mistakeCodeOnFail": "grammar.be.wrong_position",
      "rationale": "The subject pronoun should appear before the be form in this English statement."
    },
    {
      "id": "is_before_tired",
      "type": "relative_order",
      "left": ["token_is"],
      "right": ["token_tired"],
      "score": 0.4,
      "mistakeCodeOnFail": "grammar.be.wrong_position",
      "rationale": "The be form should appear before the adjective complement in this item."
    },
    {
      "id": "all_tokens_used",
      "type": "all_required_tokens_used",
      "score": 0.2,
      "mistakeCodeOnFail": "response.incomplete_sequence",
      "rationale": "All required tokens should be used."
    }
  ],
  "fallbackMistakeCode": "response.invalid_sequence",
  "passingScore": 1,
  "evidenceConfidence": 0.79
}
```

Wrong response:

```json
{
  "selectedTokenIds": ["token_is", "token_she", "token_tired"]
}
```

Possible result:

```json
{
  "score": 0.6,
  "mistakeCodes": ["grammar.be.wrong_position"],
  "failedCriteria": [
    {
      "criterionId": "she_before_is",
      "mistakeCode": "grammar.be.wrong_position"
    }
  ]
}
```

## Example: Spanish

Target sentence:

```text
Yo no hablo ingles.
```

Spanish often allows subject pronoun omission. The item can accept multiple
correct sequences when the diagnostic target allows it.

Prompt:

```json
{
  "schemaVersion": 1,
  "kind": "word_bank_sequence",
  "instructionLocalizations": {
    "pt": "Organize as palavras.",
    "en": "Arrange the words."
  },
  "contentLanguage": "es",
  "tokens": [
    { "id": "token_yo", "text": "Yo" },
    { "id": "token_no", "text": "no" },
    { "id": "token_hablo", "text": "hablo" },
    { "id": "token_ingles", "text": "ingles" }
  ]
}
```

Scoring rule:

```json
{
  "schemaVersion": 1,
  "kind": "word_bank_sequence",
  "maxScore": 1,
  "correctTokenSequences": [
    ["token_yo", "token_no", "token_hablo", "token_ingles"],
    ["token_no", "token_hablo", "token_ingles"]
  ],
  "criteria": [
    {
      "id": "no_before_hablo",
      "type": "relative_order",
      "left": ["token_no"],
      "right": ["token_hablo"],
      "score": 0.5,
      "mistakeCodeOnFail": "grammar.negation.wrong_position",
      "rationale": "In this Spanish item, no should appear before the conjugated verb."
    },
    {
      "id": "hablo_before_ingles",
      "type": "relative_order",
      "left": ["token_hablo"],
      "right": ["token_ingles"],
      "score": 0.3,
      "mistakeCodeOnFail": "grammar.verb_object.wrong_order",
      "rationale": "This item expects the verb before the object."
    },
    {
      "id": "all_tokens_used_or_allowed_omission",
      "type": "all_required_tokens_used",
      "requiredTokens": ["token_no", "token_hablo", "token_ingles"],
      "score": 0.2,
      "mistakeCodeOnFail": "response.incomplete_sequence",
      "rationale": "The diagnostic target allows omitting yo, but the negative marker, verb, and object should be used."
    }
  ],
  "fallbackMistakeCode": "response.invalid_sequence",
  "passingScore": 0.8,
  "evidenceConfidence": 0.8
}
```

The runtime does not need to know that Spanish allows subject omission. It only
sees two accepted token sequences and a required-token list.

## Example: French

Target sentence:

```text
Je ne suis pas pret.
```

French negation can involve a discontinuous pair. The item can express this
with generic relative-order checks.

```json
{
  "schemaVersion": 1,
  "kind": "word_bank_sequence",
  "maxScore": 1,
  "correctTokenSequences": [
    ["token_je", "token_ne", "token_suis", "token_pas", "token_pret"]
  ],
  "criteria": [
    {
      "id": "ne_before_verb",
      "type": "relative_order",
      "left": ["token_ne"],
      "right": ["token_suis"],
      "score": 0.25,
      "mistakeCodeOnFail": "grammar.negation.wrong_position",
      "rationale": "In this French item, ne should appear before the verb."
    },
    {
      "id": "verb_before_pas",
      "type": "relative_order",
      "left": ["token_suis"],
      "right": ["token_pas"],
      "score": 0.25,
      "mistakeCodeOnFail": "grammar.negation.wrong_position",
      "rationale": "In this French item, pas should appear after the verb."
    },
    {
      "id": "je_before_verb",
      "type": "relative_order",
      "left": ["token_je"],
      "right": ["token_suis"],
      "score": 0.25,
      "mistakeCodeOnFail": "grammar.verb_subject.wrong_order",
      "rationale": "This item expects the subject before the verb."
    },
    {
      "id": "all_tokens_used",
      "type": "all_required_tokens_used",
      "score": 0.25,
      "mistakeCodeOnFail": "response.incomplete_sequence",
      "rationale": "All required tokens should be used."
    }
  ],
  "fallbackMistakeCode": "response.invalid_sequence",
  "passingScore": 1,
  "evidenceConfidence": 0.82
}
```

The scorer is still only comparing token positions.

## Example: German

Target sentence:

```text
Ich trinke heute Kaffee.
```

This item wants to test finite verb position in a simple German main clause.

```json
{
  "schemaVersion": 1,
  "kind": "word_bank_sequence",
  "maxScore": 1,
  "correctTokenSequences": [
    ["token_ich", "token_trinke", "token_heute", "token_kaffee"]
  ],
  "criteria": [
    {
      "id": "finite_verb_second",
      "type": "token_at_position",
      "token": "token_trinke",
      "position": 2,
      "score": 0.5,
      "mistakeCodeOnFail": "grammar.word_order.verb_position",
      "rationale": "In this German main-clause item, the finite verb should appear in second position."
    },
    {
      "id": "ich_before_trinke",
      "type": "relative_order",
      "left": ["token_ich"],
      "right": ["token_trinke"],
      "score": 0.25,
      "mistakeCodeOnFail": "grammar.verb_subject.wrong_order",
      "rationale": "This item expects Ich before trinke."
    },
    {
      "id": "all_tokens_used",
      "type": "all_required_tokens_used",
      "score": 0.25,
      "mistakeCodeOnFail": "response.incomplete_sequence",
      "rationale": "All required tokens should be used."
    }
  ],
  "fallbackMistakeCode": "response.invalid_sequence",
  "passingScore": 1,
  "evidenceConfidence": 0.82
}
```

The runtime does not contain a German grammar rule. It only knows
`token_at_position`.

## Example: Chinese

Target sentence:

```text
我 喜欢 咖啡
```

Chinese is often written without spaces, but a word bank item can still use
tokens as learner-facing units.

Prompt:

```json
{
  "schemaVersion": 1,
  "kind": "word_bank_sequence",
  "instructionLocalizations": {
    "pt": "Organize as palavras.",
    "en": "Arrange the words."
  },
  "contentLanguage": "zh",
  "tokens": [
    { "id": "token_wo", "text": "我" },
    { "id": "token_xihuan", "text": "喜欢" },
    { "id": "token_kafei", "text": "咖啡" }
  ]
}
```

Scoring rule:

```json
{
  "schemaVersion": 1,
  "kind": "word_bank_sequence",
  "maxScore": 1,
  "correctTokenSequences": [["token_wo", "token_xihuan", "token_kafei"]],
  "criteria": [
    {
      "id": "wo_before_xihuan",
      "type": "relative_order",
      "left": ["token_wo"],
      "right": ["token_xihuan"],
      "score": 0.4,
      "mistakeCodeOnFail": "grammar.verb_subject.wrong_order",
      "rationale": "This item expects the experiencer before the verb."
    },
    {
      "id": "xihuan_before_kafei",
      "type": "relative_order",
      "left": ["token_xihuan"],
      "right": ["token_kafei"],
      "score": 0.4,
      "mistakeCodeOnFail": "grammar.verb_object.wrong_order",
      "rationale": "This item expects the verb before the object."
    },
    {
      "id": "all_tokens_used",
      "type": "all_required_tokens_used",
      "score": 0.2,
      "mistakeCodeOnFail": "response.incomplete_sequence",
      "rationale": "All required tokens should be used."
    }
  ],
  "fallbackMistakeCode": "response.invalid_sequence",
  "passingScore": 1,
  "evidenceConfidence": 0.79
}
```

The same runtime code works even though the script and segmentation differ from
English.

## Example: Portuguese

Target sentence:

```text
Eu nao gosto de cafe.
```

Portuguese negation can be represented with relative order, not a runtime
Portuguese rule.

```json
{
  "schemaVersion": 1,
  "kind": "word_bank_sequence",
  "maxScore": 1,
  "correctTokenSequences": [
    ["token_eu", "token_nao", "token_gosto", "token_de", "token_cafe"]
  ],
  "criteria": [
    {
      "id": "nao_before_gosto",
      "type": "relative_order",
      "left": ["token_nao"],
      "right": ["token_gosto"],
      "score": 0.4,
      "mistakeCodeOnFail": "grammar.negation.wrong_position",
      "rationale": "In this Portuguese item, nao should appear before the verb."
    },
    {
      "id": "gosto_before_de_cafe",
      "type": "relative_order",
      "left": ["token_gosto"],
      "right": ["token_de"],
      "score": 0.2,
      "mistakeCodeOnFail": "grammar.preposition.wrong_position",
      "rationale": "This item expects gosto before the complement."
    },
    {
      "id": "de_before_cafe",
      "type": "adjacency",
      "tokens": ["token_de", "token_cafe"],
      "score": 0.2,
      "mistakeCodeOnFail": "grammar.preposition.wrong_position",
      "rationale": "This item expects de cafe as a unit."
    },
    {
      "id": "all_tokens_used",
      "type": "all_required_tokens_used",
      "score": 0.2,
      "mistakeCodeOnFail": "response.incomplete_sequence",
      "rationale": "All required tokens should be used."
    }
  ],
  "fallbackMistakeCode": "response.invalid_sequence",
  "passingScore": 1,
  "evidenceConfidence": 0.82
}
```

## Why This Generalizes

This design generalizes because every language-specific decision lives in the
authored item:

- accepted token sequences;
- required tokens;
- token IDs;
- item-local groups;
- criteria;
- mistake codes;
- rationales.

The runtime scorer stays stable:

- read selected token IDs;
- compare them to accepted sequences;
- evaluate generic criteria;
- emit configured mistake codes;
- compute score and confidence.

Adding a new target language should require new authored items and maybe new
generic criterion types, not a new language-specific scorer.

## What Not To Do

Do not create globally semantic criterion types like this:

```json
{
  "type": "subject_before_main_verb"
}
```

That looks convenient for English but creates pressure to add many language-
specific criterion types:

```text
german_verb_second
french_ne_pas_negation
spanish_subject_omission
chinese_svo_order
```

Those would turn the scorer into a growing set of grammar-specific branches.

Prefer this:

```json
{
  "type": "relative_order",
  "left": ["token_she"],
  "right": ["token_is"],
  "mistakeCodeOnFail": "grammar.word_order.wrong_order"
}
```

or this:

```json
{
  "type": "token_at_position",
  "token": "token_trinke",
  "position": 2,
  "mistakeCodeOnFail": "grammar.word_order.verb_position"
}
```

The rationale can explain the linguistic reason without requiring the runtime
to understand it.

## Relationship To Future Selection

`word_bank_sequence` items should not store `competencySignals` directly.

They should store enough information for the runtime to produce signals later:

- primary competency;
- supporting targets;
- diagnostic roles;
- score;
- confidence;
- failed criteria;
- emitted `mistakeCode`s.

In the deterministic runtime, a later mapping can convert mistake codes into
selection signals:

```text
mistakeCode -> declarative mistake map -> competencySignals -> next item score
```

That keeps question authoring separate from adaptive selection.

## Candidate Selection Example

The selector should not contain branches such as:

```text
if mistakeCode is grammar.be.wrong_position, do X
if mistakeCode is grammar.preposition.wrong_position, do Y
```

Instead, it should load a declarative mistake map. The map can use
`mistakeCode` to boost candidate questions. If the selector later needs a
broader grouping, the map can define derived `selectionTags`. These tags belong
to the map, not to each scoring criterion.

Example mistake map:

```json
{
  "grammar.be.wrong_position": {
    "repairCompetencies": [
      "pre-a1-core-be-present-affirmative",
      "pre-a1-core-be-present-negative"
    ],
    "preferredRoles": ["repair", "foundation"],
    "selectionTags": ["be_position", "auxiliary_position"],
    "avoidRoles": ["ceiling"],
    "severity": "medium",
    "candidateBoost": 35
  },
  "grammar.preposition.wrong_position": {
    "repairCompetencies": [
      "a1-core-prepositions-of-place",
      "a2-core-prepositions-of-movement-and-direction"
    ],
    "preferredRoles": ["repair", "foundation"],
    "selectionTags": ["preposition_position"],
    "avoidRoles": ["ceiling"],
    "severity": "medium",
    "candidateBoost": 30
  },
  "grammar.word_order.verb_position": {
    "repairCompetencies": ["a1-core-simple-word-order-svo"],
    "preferredRoles": ["repair"],
    "selectionTags": ["finite_verb_position"],
    "avoidRoles": ["ceiling"],
    "severity": "high",
    "candidateBoost": 45
  }
}
```

Example failed criterion from an answered attempt item:

```json
{
  "criterionId": "is_before_tired",
  "mistakeCode": "grammar.be.wrong_position",
  "rationale": "The be form should appear before the adjective complement in this item."
}
```

Example candidate items:

```json
[
  {
    "key": "en.diag.pre-a1.be-present.repair.001",
    "primaryCompetencyKey": "pre-a1-core-be-present-affirmative",
    "difficultyBand": "Pre-A1",
    "diagnosticRoles": ["repair"]
  },
  {
    "key": "en.diag.a1.word-order.foundation.001",
    "primaryCompetencyKey": "a1-core-simple-word-order-svo",
    "difficultyBand": "A1",
    "diagnosticRoles": ["foundation"]
  },
  {
    "key": "en.diag.a2.past-simple.ceiling.001",
    "primaryCompetencyKey": "a2-core-past-simple-regular-irregular",
    "difficultyBand": "A2",
    "diagnosticRoles": ["ceiling"]
  }
]
```

The selector can use one generic scoring function:

```text
candidateScore =
  competencyNeedScore
  + mistakeMapCandidateBoost
  + roleMatchBonus
  + difficultyFitBonus
  - repeatedItemPenalty
```

Example role bonuses for this situation:

```json
{
  "repair": 25,
  "foundation": 10,
  "confidence": 5,
  "ceiling": -20
}
```

For the failed `grammar.be.wrong_position` criterion above, the repair item
gets:

- a boost because its primary competency is in `repairCompetencies`;
- a role bonus because it has `repair`;
- no penalty for being a ceiling item.

The A1 word-order item may still be a reasonable later candidate, but it should
rank below the direct be-position repair item. The A2 ceiling item should rank
low immediately after this error because it does not repair the observed
weakness and has a discouraged role.

This keeps runtime selection deterministic and generic:

- the scorer emits declared failed criteria;
- the selector reads a declarative mistake map;
- candidate items are scored through a generic formula;
- adding a target language usually adds new authored items and map entries, not
  new selector branches.

## MVP Recommendation

For the first implementation:

1. Support `correctTokenSequences`.
2. Add optional `criteria` to `word_bank_sequence` scoring rules.
3. Implement only these criterion types:
   - `all_required_tokens_used`
   - `relative_order`
   - `adjacency`
   - `token_at_position`
4. Add `fallbackMistakeCode`.
5. Store failed criteria and mistake codes in attempt item scoring details.
6. Do not add language-specific runtime branches.

This gives enough diagnostic value for English onboarding while preserving a
path to Spanish, French, German, Chinese, Portuguese, and future target
languages.
