# Onboarding diagnostic question generator prompt

Use this prompt with an agent that will author onboarding diagnostic questions
for the English catalog.

```text
You are generating authored diagnostic questions for LumaLingo's onboarding
diagnostic question bank.

Do not generate the final question bank yet. First, read the required files,
then output only an authoring plan. The plan must list every question you intend
to generate with:

- level
- primary competency key
- response format
- diagnostic role
- short item idea
- why this item is useful

Wait for explicit user approval before generating any final JSON items.

Required files to consult before planning:

- CONTEXT.md
- packages/shared/src/diagnostic-question.ts
- packages/shared/src/diagnostic-question.test.ts
- docs/diagnostic-word-bank-sequence-generalization.md
- docs/competency-database-schema.md
- docs/adr/0006-use-deterministic-initial-diagnostic-selection.md
- docs/adr/0007-use-competencies-for-learning-progression.md
- docs/adr/0010-use-diagnostic-attempts-for-onboarding-auditability.md
- data/catalogs/en/onboarding-diagnostic-question-plan.json
- data/catalogs/en/grammar-competencies.json
- data/catalogs/en/non-grammar-competencies.json

Primary goal:

Generate deterministic onboarding diagnostic questions for English learners.
Prioritize foundation competencies, but include A2-B2 ceiling, confidence, and
goal-probe items so the MVP is not beginner-only.

Do not use runtime LLM judgment as part of the question design. Every item must
be scoreable through the shared Zod contract.

Supported response formats:

- multiple_choice
- fill_blank_choice
- word_bank_sequence

Supported diagnostic roles:

- foundation: checks whether the learner has the minimum prerequisite skill
- ceiling: checks whether the learner can safely start above this competency
- repair: targets a common misconception after a wrong or uncertain answer
- confidence: independently confirms a prior signal
- goal_probe: connects the diagnostic signal to practical language use

Supported item statuses:

- draft
- reviewed
- published

Use draft for generated items unless the user explicitly asks otherwise.

Supported difficulty bands:

- Pre-A1
- A1
- A2
- B1
- B2

Language rules:

- The target language is English.
- Use contentLanguage: "en" for all English diagnostic content.
- Include instructionLocalizations for both "pt" and "en".
- The instruction text must be in the learner's instruction language.
- The diagnostic content must stay in the target language.
- Do not translate English answer options into Portuguese.

Question bank root shape:

{
  "schemaVersion": 1,
  "targetLanguage": "en",
  "catalogVersion": "<short version string>",
  "purpose": "onboarding_initial",
  "items": []
}

Each item must have these top-level attributes:

- key: stable unique key, max 160 characters
- status: draft, reviewed, or published
- primaryCompetencyKey: must match exactly one primary target
- difficultyBand: Pre-A1, A1, A2, B1, or B2
- responseFormat: multiple_choice, fill_blank_choice, or word_bank_sequence
- prompt: response-format-specific prompt object
- scoringRule: response-format-specific scoring object
- targets: 1-5 competency targets
- details: authoring metadata

Key convention:

Use this pattern:

en.diag.<level>.<short-competency>.<role>.<number>

Examples:

- en.diag.pre-a1.be-present.foundation.001
- en.diag.a1.present-simple.repair.001
- en.diag.b1.reading-contrast.ceiling.001

Use lowercase letters, numbers, hyphens, and dots in keys.

Prompt contract:

All prompts include:

- schemaVersion: 1
- kind: must match responseFormat
- instructionLocalizations: object with "pt" and "en"
- contentLanguage: "en"

multiple_choice prompt:

- kind: "multiple_choice"
- stem: the question text, max 1000 characters
- options: 2-6 objects with id and text

fill_blank_choice prompt:

- kind: "fill_blank_choice"
- text: target-language sentence with one blank
- blankId: component id for the blank
- options: 2-6 objects with id and text

word_bank_sequence prompt:

- kind: "word_bank_sequence"
- tokens: 2-12 token objects with stable ids and learner-facing text

Component id rules:

- Use lowercase snake_case.
- Start with a letter.
- Use only letters, numbers, and underscores.
- Examples: option_is, token_ready, blank_1, subject_before_be.

Scoring rule base:

Every scoringRule includes:

- schemaVersion: 1
- kind: must match responseFormat
- maxScore: 1
- passingScore: number from 0 to 1
- evidenceConfidence: number from 0 to 1

multiple_choice scoring:

- correctOptionIds: 1-6 option ids
- distractors: object keyed by wrong option id
- each distractor has mistakeCode and rationale

fill_blank_choice scoring:

- blankId: must match prompt.blankId
- correctOptionIds: 1-6 option ids
- distractors: object keyed by wrong option id
- each distractor has mistakeCode and rationale

word_bank_sequence scoring:

- correctTokenSequences: 1-5 accepted token-id sequences
- tokenGroups: optional object of local token groups
- criteria: optional array of deterministic criteria
- fallbackMistakeCode: optional broad fallback mistake code
- Do not include feature on criteria.

word_bank_sequence partial-scoring safety:

- Exact matches in correctTokenSequences are always valid.
- Criteria are useful for partial credit and mistake diagnosis, but they must
  not let clearly invalid English reach passingScore.
- Before finalizing a word_bank_sequence item, test likely wrong orders in your
  head. If a wrong order can pass all criteria, revise the item.
- Keep passingScore at 1 unless there is a specific reason to accept partial
  answers.
- If a longer sentence makes criteria hard to verify safely, simplify the
  sentence.

Bad example to avoid:

Target sequence:

["token_i", "token_drink", "token_coffee", "token_every", "token_day"]

If the criteria only check:

- token_i before token_drink
- token_drink before token_coffee
- token_every adjacent to token_day
- all tokens used

Then this invalid order can still get full score:

["token_i", "token_drink", "token_every", "token_day", "token_coffee"]

That is not acceptable. Fix this by doing one of the following:

- simplify the item to "I drink coffee";
- add an explicit criterion such as token_coffee before token_every;
- revise the criteria so every sequence that reaches passingScore is genuinely
  acceptable English.

Supported word_bank_sequence criteria:

- all_required_tokens_used
- no_extra_tokens
- relative_order
- adjacency
- token_at_position
- token_before_group
- token_after_group

Criterion base fields:

- id: stable component id
- type: one supported criterion type
- score: number from 0 to 1
- mistakeCodeOnFail: normalized mistake code
- rationale: short explanation

relative_order criteria:

- left: 1-12 token ids
- right: 1-12 token ids

adjacency criteria:

- tokens: 2-12 token ids in required adjacent order

token_at_position criteria:

- token: token id
- position: 1-based position, from 1 to 12

token_before_group and token_after_group criteria:

- token: token id
- group: token group id that must exist in tokenGroups

Targets:

Each target includes:

- competencyKey
- role: primary or supporting
- weight: integer from 0 to 100
- details: optional object with schemaVersion: 1 and scoringNotes

Rules:

- Every item must have exactly one primary target.
- The primary target competencyKey must equal primaryCompetencyKey.
- The primary target should normally have weight 100.
- Add supporting targets only when the item clearly gives evidence for them.
- Supporting targets should use weights such as 40, 60, or 80.
- Avoid more than two supporting targets.

Details:

Each item details object includes:

- schemaVersion: 1
- diagnosticRoles: array with 1-5 roles
- rationale: why this item exists
- safetyNotes: array
- localizationNotes: array
- distractorRationale: object keyed by option id when applicable
- authoringSource: optional object with plan and variant

Use authoringSource like this:

{
  "plan": "onboarding-diagnostic-question-plan",
  "variant": "foundation"
}

Mistake code rules:

- Use normalized dot-separated mistake codes.
- Format: {domain}.{family}.{error}
- Do not include target language in the mistake code.
- Use the most specific code the item can justify.
- Put language-specific explanation in rationale.
- Use broad fallback codes only when no criterion explains the wrong answer.

Good examples:

- grammar.be.wrong_form
- grammar.be.wrong_position
- grammar.subject.wrong_pronoun
- grammar.subject.number_mismatch
- grammar.article.a_an_confusion
- grammar.article.definite_article_confusion
- grammar.verb_agreement.missing_third_person_s
- grammar.verb_form.wrong_form
- grammar.verb_tense.base_form_in_past_context
- grammar.verb_tense.present_in_past_context
- grammar.auxiliary.wrong_position
- grammar.question.word_order
- grammar.verb_subject.wrong_order
- grammar.verb_object.wrong_order
- grammar.wh_word.wrong_question_word
- reading.time_reference.misread_contrast
- reading.time_reference.misread_sequence
- reading.detail.wrong_object
- reading.contrast.missed_connector
- reading.inference.unsupported_inference
- reading.author_stance.misidentified_concern
- response.incomplete_sequence
- response.extra_token
- response.invalid_sequence

Confidence defaults:

Use this formula when assigning evidenceConfidence:

evidenceConfidence =
  variantBaseConfidence * formatReliability * structureReliability

Clamp to min 0.4 and max 0.9.

Variant base confidence:

- foundation: 0.75
- ceiling: 0.8
- repair: 0.65
- confidence: 0.85
- goal_probe: 0.7

Format reliability:

- multiple_choice: 0.95
- fill_blank_choice: 1.0
- word_bank_sequence: 1.05

multiple_choice structureReliability by option count:

- 2 options: 0.80
- 3 options: 0.90
- 4 options: 1.00
- 5 options: 1.03
- 6 options: 1.05

fill_blank_choice structureReliability by option count:

- 2 options: 0.85
- 3 options: 0.95
- 4 options: 1.00
- 5-6 options: 1.02

word_bank_sequence structureReliability by token count:

- 2 tokens: 0.85
- 3 tokens: 0.95
- 4-6 tokens: 1.00
- 7-9 tokens: 1.03
- 10-12 tokens: 1.05

Advanced reading multiple-choice items:

For A2, B1, and B2, you may create short reading-comprehension
multiple-choice items. These are still responseFormat: "multiple_choice"; do
not create a new response format.

Use advanced reading items only for:

- ceiling
- confidence
- goal_probe

Do not use longer reading items for Pre-A1 or A1 foundation checks.

Reading item constraints:

- Use at most one short paragraph.
- Use at most 3 sentences in the paragraph.
- Add exactly one objective question.
- Use 3 or 4 answer options.
- Include exactly one correct answer.
- Do not require external cultural knowledge.
- Do not write trick questions.
- Keep the stem under the schema limit.
- The paragraph and question may live together in prompt.stem.

Example 1: fill_blank_choice

{
  "key": "en.diag.pre-a1.be-present.foundation.001",
  "status": "draft",
  "primaryCompetencyKey": "pre-a1-core-be-present-affirmative",
  "difficultyBand": "Pre-A1",
  "responseFormat": "fill_blank_choice",
  "prompt": {
    "schemaVersion": 1,
    "kind": "fill_blank_choice",
    "instructionLocalizations": {
      "pt": "Escolha a palavra correta.",
      "en": "Choose the correct word."
    },
    "contentLanguage": "en",
    "text": "She ___ tired.",
    "blankId": "blank_1",
    "options": [
      { "id": "option_is", "text": "is" },
      { "id": "option_are", "text": "are" },
      { "id": "option_am", "text": "am" }
    ]
  },
  "scoringRule": {
    "schemaVersion": 1,
    "kind": "fill_blank_choice",
    "maxScore": 1,
    "blankId": "blank_1",
    "correctOptionIds": ["option_is"],
    "distractors": {
      "option_are": {
        "mistakeCode": "grammar.be.wrong_form",
        "rationale": "Uses a plural or second-person be form with a third-person singular subject."
      },
      "option_am": {
        "mistakeCode": "grammar.be.wrong_form",
        "rationale": "Uses the first-person be form with a third-person singular subject."
      }
    },
    "passingScore": 1,
    "evidenceConfidence": 0.71
  },
  "targets": [
    {
      "competencyKey": "pre-a1-core-be-present-affirmative",
      "role": "primary",
      "weight": 100
    }
  ],
  "details": {
    "schemaVersion": 1,
    "diagnosticRoles": ["foundation"],
    "rationale": "Checks whether the learner can choose the correct present form of be.",
    "safetyNotes": [],
    "localizationNotes": ["Instructions must not reveal the target grammar point."],
    "distractorRationale": {
      "option_are": "Common agreement error with third-person singular subjects.",
      "option_am": "Common overgeneralization of am."
    },
    "authoringSource": {
      "plan": "onboarding-diagnostic-question-plan",
      "variant": "foundation"
    }
  }
}

Example 2: multiple_choice

{
  "key": "en.diag.pre-a1.subject-pronouns.foundation.001",
  "status": "draft",
  "primaryCompetencyKey": "pre-a1-core-subject-pronouns",
  "difficultyBand": "Pre-A1",
  "responseFormat": "multiple_choice",
  "prompt": {
    "schemaVersion": 1,
    "kind": "multiple_choice",
    "instructionLocalizations": {
      "pt": "Escolha a melhor resposta.",
      "en": "Choose the best answer."
    },
    "contentLanguage": "en",
    "stem": "Maria is a teacher. ___ is from Brazil.",
    "options": [
      { "id": "option_she", "text": "She" },
      { "id": "option_he", "text": "He" },
      { "id": "option_they", "text": "They" },
      { "id": "option_it", "text": "It" }
    ]
  },
  "scoringRule": {
    "schemaVersion": 1,
    "kind": "multiple_choice",
    "maxScore": 1,
    "correctOptionIds": ["option_she"],
    "distractors": {
      "option_he": {
        "mistakeCode": "grammar.subject.wrong_pronoun",
        "rationale": "Selects a masculine subject pronoun for Maria."
      },
      "option_they": {
        "mistakeCode": "grammar.subject.number_mismatch",
        "rationale": "Selects a plural subject pronoun for one person."
      },
      "option_it": {
        "mistakeCode": "grammar.subject.wrong_pronoun",
        "rationale": "Selects a non-person subject pronoun for a person."
      }
    },
    "passingScore": 1,
    "evidenceConfidence": 0.71
  },
  "targets": [
    {
      "competencyKey": "pre-a1-core-subject-pronouns",
      "role": "primary",
      "weight": 100
    }
  ],
  "details": {
    "schemaVersion": 1,
    "diagnosticRoles": ["foundation"],
    "rationale": "Checks whether the learner can choose a subject pronoun from a short context.",
    "safetyNotes": [],
    "localizationNotes": ["Keep the name Maria unchanged across instruction languages."],
    "distractorRationale": {
      "option_he": "Wrong gender cue.",
      "option_they": "Wrong number cue.",
      "option_it": "Wrong personhood cue."
    },
    "authoringSource": {
      "plan": "onboarding-diagnostic-question-plan",
      "variant": "foundation"
    }
  }
}

Example 3: word_bank_sequence

{
  "key": "en.diag.pre-a1.be-present.repair.001",
  "status": "draft",
  "primaryCompetencyKey": "pre-a1-core-be-present-affirmative",
  "difficultyBand": "Pre-A1",
  "responseFormat": "word_bank_sequence",
  "prompt": {
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
  },
  "scoringRule": {
    "schemaVersion": 1,
    "kind": "word_bank_sequence",
    "maxScore": 1,
    "correctTokenSequences": [["token_i", "token_am", "token_ready"]],
    "tokenGroups": {},
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
        "id": "be_before_complement",
        "type": "relative_order",
        "left": ["token_am"],
        "right": ["token_ready"],
        "score": 0.4,
        "mistakeCodeOnFail": "grammar.be.wrong_position",
        "rationale": "The be form should appear before the adjective complement."
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
    "evidenceConfidence": 0.65
  },
  "targets": [
    {
      "competencyKey": "pre-a1-core-be-present-affirmative",
      "role": "primary",
      "weight": 100
    }
  ],
  "details": {
    "schemaVersion": 1,
    "diagnosticRoles": ["repair"],
    "rationale": "Checks whether the learner can order a simple present-be statement.",
    "safetyNotes": [],
    "localizationNotes": ["Token text must stay in English."],
    "distractorRationale": {},
    "authoringSource": {
      "plan": "onboarding-diagnostic-question-plan",
      "variant": "repair"
    }
  }
}

Example 4: A2 reading multiple_choice

Use this kind of longer stem only for A2-B2 ceiling, confidence, or goal_probe
items.

{
  "key": "en.diag.a2.reading-time-reference.ceiling.001",
  "status": "draft",
  "primaryCompetencyKey": "a2-short-everyday-texts",
  "difficultyBand": "A2",
  "responseFormat": "multiple_choice",
  "prompt": {
    "schemaVersion": 1,
    "kind": "multiple_choice",
    "instructionLocalizations": {
      "pt": "Leia o texto e escolha a melhor resposta.",
      "en": "Read the text and choose the best answer."
    },
    "contentLanguage": "en",
    "stem": "Mia usually takes the bus to work. Yesterday, she woke up late, so she called a taxi. She arrived at the office at 9:15.\n\nHow did Mia get to work yesterday?",
    "options": [
      { "id": "option_taxi", "text": "By taxi" },
      { "id": "option_bus", "text": "By bus" },
      { "id": "option_foot", "text": "On foot" },
      { "id": "option_train", "text": "By train" }
    ]
  },
  "scoringRule": {
    "schemaVersion": 1,
    "kind": "multiple_choice",
    "maxScore": 1,
    "correctOptionIds": ["option_taxi"],
    "distractors": {
      "option_bus": {
        "mistakeCode": "reading.time_reference.misread_contrast",
        "rationale": "Uses the usual habit instead of the specific past event."
      },
      "option_foot": {
        "mistakeCode": "reading.detail.wrong_object",
        "rationale": "Chooses information that is not stated in the text."
      },
      "option_train": {
        "mistakeCode": "reading.detail.wrong_object",
        "rationale": "Chooses information that is not stated in the text."
      }
    },
    "passingScore": 1,
    "evidenceConfidence": 0.76
  },
  "targets": [
    {
      "competencyKey": "a2-short-everyday-texts",
      "role": "primary",
      "weight": 100
    }
  ],
  "details": {
    "schemaVersion": 1,
    "diagnosticRoles": ["ceiling"],
    "rationale": "Checks whether the learner can distinguish a habitual action from a specific past event in a short text.",
    "safetyNotes": [],
    "localizationNotes": ["Keep the passage short and avoid cultural assumptions."],
    "distractorRationale": {
      "option_bus": "Habitual action distractor.",
      "option_foot": "Unsupported detail.",
      "option_train": "Unsupported detail."
    },
    "authoringSource": {
      "plan": "onboarding-diagnostic-question-plan",
      "variant": "ceiling"
    }
  }
}

Example 5: B1 reading multiple_choice

Use this kind of longer stem only for A2-B2 ceiling, confidence, or goal_probe
items.

{
  "key": "en.diag.b1.past-continuous-reading.ceiling.001",
  "status": "draft",
  "primaryCompetencyKey": "b1-core-past-continuous-vs-past-simple",
  "difficultyBand": "B1",
  "responseFormat": "multiple_choice",
  "prompt": {
    "schemaVersion": 1,
    "kind": "multiple_choice",
    "instructionLocalizations": {
      "pt": "Leia o texto e escolha a melhor resposta.",
      "en": "Read the text and choose the best answer."
    },
    "contentLanguage": "en",
    "stem": "Mark was cooking dinner when his phone rang. He turned off the stove and answered it. The caller was his manager.\n\nWhat was Mark doing when the phone rang?",
    "options": [
      { "id": "option_cooking", "text": "Cooking dinner" },
      { "id": "option_answering", "text": "Answering the phone" },
      { "id": "option_working", "text": "Working with his manager" },
      { "id": "option_shopping", "text": "Shopping for dinner" }
    ]
  },
  "scoringRule": {
    "schemaVersion": 1,
    "kind": "multiple_choice",
    "maxScore": 1,
    "correctOptionIds": ["option_cooking"],
    "distractors": {
      "option_answering": {
        "mistakeCode": "reading.time_reference.misread_sequence",
        "rationale": "Chooses the action after the interruption instead of the action in progress."
      },
      "option_working": {
        "mistakeCode": "reading.detail.wrong_object",
        "rationale": "Chooses information related to the caller, not Mark's action."
      },
      "option_shopping": {
        "mistakeCode": "reading.detail.wrong_object",
        "rationale": "Chooses information that is not stated in the text."
      }
    },
    "passingScore": 1,
    "evidenceConfidence": 0.81
  },
  "targets": [
    {
      "competencyKey": "b1-core-past-continuous-vs-past-simple",
      "role": "primary",
      "weight": 100
    }
  ],
  "details": {
    "schemaVersion": 1,
    "diagnosticRoles": ["ceiling"],
    "rationale": "Checks whether the learner can identify an action in progress interrupted by a simple past event.",
    "safetyNotes": [],
    "localizationNotes": ["Do not make the passage longer than three sentences."],
    "distractorRationale": {
      "option_answering": "Confuses the interrupted event with the action in progress.",
      "option_working": "Misreads the caller as the action.",
      "option_shopping": "Unsupported detail."
    },
    "authoringSource": {
      "plan": "onboarding-diagnostic-question-plan",
      "variant": "ceiling"
    }
  }
}

Example 6: B2 reading multiple_choice

Use B2 sparingly as a high ceiling signal.

{
  "key": "en.diag.b2.past-perfect-reading.ceiling.001",
  "status": "draft",
  "primaryCompetencyKey": "b2-core-past-perfect",
  "difficultyBand": "B2",
  "responseFormat": "multiple_choice",
  "prompt": {
    "schemaVersion": 1,
    "kind": "multiple_choice",
    "instructionLocalizations": {
      "pt": "Leia o texto e escolha a melhor resposta.",
      "en": "Read the text and choose the best answer."
    },
    "contentLanguage": "en",
    "stem": "By the time Nina arrived, the meeting had already started. She quietly found a seat and opened her notebook. Later, her manager summarized the first point for her.\n\nWhat happened before Nina arrived?",
    "options": [
      { "id": "option_meeting_started", "text": "The meeting started" },
      { "id": "option_nina_opened_notebook", "text": "Nina opened her notebook" },
      { "id": "option_manager_summarized", "text": "The manager summarized the first point" },
      { "id": "option_nina_found_seat", "text": "Nina found a seat" }
    ]
  },
  "scoringRule": {
    "schemaVersion": 1,
    "kind": "multiple_choice",
    "maxScore": 1,
    "correctOptionIds": ["option_meeting_started"],
    "distractors": {
      "option_nina_opened_notebook": {
        "mistakeCode": "grammar.verb_tense.past_perfect_sequence",
        "rationale": "Chooses an event after Nina arrived instead of the earlier event."
      },
      "option_manager_summarized": {
        "mistakeCode": "grammar.verb_tense.past_perfect_sequence",
        "rationale": "Chooses a later event instead of the event completed before arrival."
      },
      "option_nina_found_seat": {
        "mistakeCode": "grammar.verb_tense.past_perfect_sequence",
        "rationale": "Chooses an event after arrival instead of the earlier completed event."
      }
    },
    "passingScore": 1,
    "evidenceConfidence": 0.81
  },
  "targets": [
    {
      "competencyKey": "b2-core-past-perfect",
      "role": "primary",
      "weight": 100
    }
  ],
  "details": {
    "schemaVersion": 1,
    "diagnosticRoles": ["ceiling"],
    "rationale": "Checks whether the learner can interpret sequence using past perfect in a short text.",
    "safetyNotes": [],
    "localizationNotes": ["Keep the passage short and avoid specialized vocabulary."],
    "distractorRationale": {
      "option_nina_opened_notebook": "Later event after arrival.",
      "option_manager_summarized": "Later event after arrival.",
      "option_nina_found_seat": "Later event after arrival."
    },
    "authoringSource": {
      "plan": "onboarding-diagnostic-question-plan",
      "variant": "ceiling"
    }
  }
}

Planning output format:

Before writing final items, output a markdown table with these columns:

| # | Level | Competency | Format | Role | Item idea | Why this item |
|---|-------|------------|--------|------|-----------|---------------|

Also include planned totals:

- total question count
- count by level
- count by response format
- count by diagnostic role
- count by source catalog if available

After the user approves the plan:

1. Generate the final question bank JSON.
2. Make every item validate against authoredDiagnosticQuestionBankSchema.
3. Use only competencies present in data/catalogs/en.
4. Do not invent new response formats.
5. Do not include commentary inside the JSON.
6. If you are writing to a repo file, prefer a filename such as
   data/catalogs/en/onboarding-diagnostic-question-bank.json.

Quality checklist:

- Every key is unique.
- Every prompt.kind matches responseFormat.
- Every scoringRule.kind matches responseFormat.
- Every item has exactly one primary target.
- primaryCompetencyKey equals the primary target competencyKey.
- Every option id referenced by scoring exists in the prompt.
- Every token id referenced by scoring exists in the prompt.
- Every token group referenced by criteria exists in tokenGroups.
- Every mistakeCode uses dot-separated normalized format.
- No word_bank_sequence criterion includes feature.
- No invalid word_bank_sequence order can reach passingScore through partial
  criteria.
- A2-B2 longer reading items are only ceiling, confidence, or goal_probe.
- Reading passages have at most 3 sentences and one objective question.
- instructionLocalizations includes both pt and en.
- contentLanguage is en.
- status is draft unless instructed otherwise.
```
