# Onboarding diagnostic word-bank criteria rewriter prompt

Use this prompt with an agent that rewrites `word_bank_sequence` scoring
criteria after questions have already been authored.

```text
You are reviewing and rewriting LumaLingo's onboarding diagnostic
word_bank_sequence scoring criteria.

Your job is not to create new diagnostic questions. Your job is to read the
existing word_bank_sequence question bank and replace weak criteria with
diagnostically useful deterministic criteria.

Primary file to review and update:

- data/catalogs/en/onboarding-diagnostic-word-bank-sequence-question-bank.json

Required reference files:

- packages/shared/src/diagnostic-question.ts
- packages/shared/src/diagnostic-question.test.ts
- docs/diagnostic-word-bank-sequence-generalization.md
- docs/onboarding-diagnostic-question-generator-prompt.md
- docs/onboarding-diagnostic-question-reviewer-prompt.md
- data/catalogs/en/onboarding-diagnostic-question-plan.json
- data/catalogs/en/grammar-competencies.json
- data/catalogs/en/non-grammar-competencies.json

Problem to fix:

Most or all current criteria may use token_at_position. That is too rigid and
too weak diagnostically when used as the default.

Do not use token_at_position as the default criterion type.

Use token_at_position only when the absolute position is the grammatical target,
such as:

- first auxiliary in a yes/no question;
- first wh-word in a wh-question;
- first be form in a be yes/no question;
- a language-specific position rule that is explicitly the diagnostic target.

Prefer relative_order for relationships such as:

- subject before verb;
- verb before object;
- auxiliary before main verb;
- be before complement;
- negation marker after auxiliary or be;
- preposition before complement;
- question word before auxiliary;
- auxiliary before subject in questions.

Use adjacency only when a multi-token unit should stay together, such as:

- going to;
- every day;
- from Peru;
- at home;
- a fixed phrasal unit used by the item.

Use all_required_tokens_used in most items.

Do not add feature to any criterion.

Keep scoring deterministic. Do not rely on runtime LLM judgment.

For every rewritten item:

1. Preserve the item key, prompt, targets, details, responseFormat, and
   correctTokenSequences unless the current target sequence is clearly wrong.
2. Replace generic token_at_position-only criteria with relationship-based
   criteria.
3. Make mistakeCodeOnFail describe the failed linguistic relationship, not the
   token's absolute position.
4. Keep passingScore at 1 unless there is a specific pedagogical reason to
   accept partial answers.
5. Make sure no clearly invalid sequence can reach passingScore.
6. Keep total criteria scores summing to 1.
7. Validate the result against authoredDiagnosticQuestionBankSchema.

Good mistakeCodeOnFail examples:

- grammar.be.wrong_position
- grammar.question.word_order
- grammar.subject.wrong_position
- grammar.verb_subject.wrong_order
- grammar.verb_object.wrong_order
- grammar.auxiliary.wrong_position
- grammar.negation.wrong_position
- grammar.preposition.wrong_position
- grammar.time_expression.wrong_position
- grammar.phrase.incomplete_unit
- response.incomplete_sequence
- response.invalid_sequence

Bad pattern to remove:

{
  "id": "token_3_position",
  "type": "token_at_position",
  "token": "token_from_3",
  "position": 3,
  "score": 0.25,
  "mistakeCodeOnFail": "grammar.be.wrong_position",
  "rationale": "The token \"from\" should be in position 3."
}

Why it is weak:

- It duplicates the exact answer sequence.
- It says little about the actual language relationship.
- The mistake code may point to the wrong skill. A misplaced preposition or
  complement is not always a be-position error.

Better example 1: simple SVO

Target sentence:

I like music.

Tokens:

[
  { "id": "token_i", "text": "I" },
  { "id": "token_like", "text": "like" },
  { "id": "token_music", "text": "music" }
]

Use criteria like:

{
  "criteria": [
    {
      "id": "subject_before_verb",
      "type": "relative_order",
      "left": ["token_i"],
      "right": ["token_like"],
      "score": 0.4,
      "mistakeCodeOnFail": "grammar.verb_subject.wrong_order",
      "rationale": "The subject should appear before the verb."
    },
    {
      "id": "verb_before_object",
      "type": "relative_order",
      "left": ["token_like"],
      "right": ["token_music"],
      "score": 0.4,
      "mistakeCodeOnFail": "grammar.verb_object.wrong_order",
      "rationale": "The verb should appear before the object."
    },
    {
      "id": "all_tokens_used",
      "type": "all_required_tokens_used",
      "score": 0.2,
      "mistakeCodeOnFail": "response.incomplete_sequence",
      "rationale": "All required tokens should be used."
    }
  ],
  "fallbackMistakeCode": "response.invalid_sequence"
}

Better example 2: be yes/no question

Target sentence:

Are you ready?

Tokens:

[
  { "id": "token_are", "text": "Are" },
  { "id": "token_you", "text": "you" },
  { "id": "token_ready", "text": "ready?" }
]

Here token_at_position is justified for the first token because first-position
be is the diagnostic target.

Use criteria like:

{
  "criteria": [
    {
      "id": "be_question_first",
      "type": "token_at_position",
      "token": "token_are",
      "position": 1,
      "score": 0.4,
      "mistakeCodeOnFail": "grammar.question.word_order",
      "rationale": "The be form should appear first in this yes/no question."
    },
    {
      "id": "subject_before_complement",
      "type": "relative_order",
      "left": ["token_you"],
      "right": ["token_ready"],
      "score": 0.4,
      "mistakeCodeOnFail": "grammar.subject.wrong_position",
      "rationale": "The subject should appear before the complement."
    },
    {
      "id": "all_tokens_used",
      "type": "all_required_tokens_used",
      "score": 0.2,
      "mistakeCodeOnFail": "response.incomplete_sequence",
      "rationale": "All required tokens should be used."
    }
  ],
  "fallbackMistakeCode": "response.invalid_sequence"
}

Better example 3: present simple negative

Target sentence:

They do not work today.

Tokens:

[
  { "id": "token_they", "text": "They" },
  { "id": "token_do", "text": "do" },
  { "id": "token_not", "text": "not" },
  { "id": "token_work", "text": "work" },
  { "id": "token_today", "text": "today" }
]

Use criteria like:

{
  "criteria": [
    {
      "id": "subject_before_auxiliary",
      "type": "relative_order",
      "left": ["token_they"],
      "right": ["token_do"],
      "score": 0.2,
      "mistakeCodeOnFail": "grammar.verb_subject.wrong_order",
      "rationale": "The subject should appear before the auxiliary in this negative statement."
    },
    {
      "id": "auxiliary_before_not",
      "type": "relative_order",
      "left": ["token_do"],
      "right": ["token_not"],
      "score": 0.25,
      "mistakeCodeOnFail": "grammar.negation.wrong_position",
      "rationale": "The negation marker should appear after the auxiliary."
    },
    {
      "id": "not_before_main_verb",
      "type": "relative_order",
      "left": ["token_not"],
      "right": ["token_work"],
      "score": 0.25,
      "mistakeCodeOnFail": "grammar.negation.wrong_position",
      "rationale": "The negation marker should appear before the main verb."
    },
    {
      "id": "verb_before_time_expression",
      "type": "relative_order",
      "left": ["token_work"],
      "right": ["token_today"],
      "score": 0.1,
      "mistakeCodeOnFail": "grammar.time_expression.wrong_position",
      "rationale": "The time expression should follow the verb phrase in this item."
    },
    {
      "id": "all_tokens_used",
      "type": "all_required_tokens_used",
      "score": 0.2,
      "mistakeCodeOnFail": "response.incomplete_sequence",
      "rationale": "All required tokens should be used."
    }
  ],
  "fallbackMistakeCode": "response.invalid_sequence"
}

Better example 4: going to

Target sentence:

She is going to call you.

Tokens:

[
  { "id": "token_she", "text": "She" },
  { "id": "token_is", "text": "is" },
  { "id": "token_going", "text": "going" },
  { "id": "token_to", "text": "to" },
  { "id": "token_call", "text": "call" },
  { "id": "token_you", "text": "you" }
]

Use criteria like:

{
  "criteria": [
    {
      "id": "subject_before_be",
      "type": "relative_order",
      "left": ["token_she"],
      "right": ["token_is"],
      "score": 0.15,
      "mistakeCodeOnFail": "grammar.verb_subject.wrong_order",
      "rationale": "The subject should appear before the be form."
    },
    {
      "id": "be_before_going",
      "type": "relative_order",
      "left": ["token_is"],
      "right": ["token_going"],
      "score": 0.2,
      "mistakeCodeOnFail": "grammar.be.wrong_position",
      "rationale": "The be form should appear before going in this future expression."
    },
    {
      "id": "going_to_adjacent",
      "type": "adjacency",
      "tokens": ["token_going", "token_to"],
      "score": 0.25,
      "mistakeCodeOnFail": "grammar.phrase.incomplete_unit",
      "rationale": "Going to should stay together as the future marker in this item."
    },
    {
      "id": "to_before_base_verb",
      "type": "relative_order",
      "left": ["token_to"],
      "right": ["token_call"],
      "score": 0.2,
      "mistakeCodeOnFail": "grammar.verb_form.wrong_form",
      "rationale": "To should appear before the base verb in the going to future."
    },
    {
      "id": "all_tokens_used",
      "type": "all_required_tokens_used",
      "score": 0.2,
      "mistakeCodeOnFail": "response.incomplete_sequence",
      "rationale": "All required tokens should be used."
    }
  ],
  "fallbackMistakeCode": "response.invalid_sequence"
}

Partial scoring safety check:

For every rewritten item, test at least three likely wrong orders. If any
clearly invalid order can reach passingScore, the criteria are too permissive.

Example unsafe target:

I drink coffee every day.

If criteria only check:

- I before drink;
- drink before coffee;
- every adjacent to day;
- all tokens used.

Then this invalid order can still pass:

I drink every day coffee.

Fix it by adding a criterion such as:

{
  "id": "object_before_time_expression",
  "type": "relative_order",
  "left": ["token_coffee"],
  "right": ["token_every"],
  "score": 0.2,
  "mistakeCodeOnFail": "grammar.time_expression.wrong_position",
  "rationale": "The time expression should follow the object in this item."
}

Output requirements:

1. First, summarize how many items were reviewed and how many criteria changed.
2. List any items you could not rewrite safely and explain why.
3. Save the rewritten JSON back to:
   data/catalogs/en/onboarding-diagnostic-word-bank-sequence-question-bank.json
4. Do not modify non-word_bank_sequence files.
5. Validate the final JSON against authoredDiagnosticQuestionBankSchema.
6. Report any remaining risks.
```
