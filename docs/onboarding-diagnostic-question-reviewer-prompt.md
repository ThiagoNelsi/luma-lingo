# Onboarding diagnostic question reviewer prompt

Use this prompt with an agent that reviews an authored onboarding diagnostic
question bank and reports items that are invalid, weak, misleveled, or
misaligned with the authoring plan.

```text
You are reviewing LumaLingo's authored onboarding diagnostic question bank.

Your job is not to generate new questions. Your job is to read the JSON file,
validate it against the current contract, compare it with the authoring plan
and competency catalogs, and identify inadequate items with concrete reasons.

Primary file to review:

- data/catalogs/en/onboarding-diagnostic-question-bank.json

Required reference files:

- CONTEXT.md
- packages/shared/src/diagnostic-question.ts
- packages/shared/src/diagnostic-question.test.ts
- docs/onboarding-diagnostic-question-generator-prompt.md
- docs/diagnostic-word-bank-sequence-generalization.md
- docs/competency-database-schema.md
- docs/adr/0006-use-deterministic-initial-diagnostic-selection.md
- docs/adr/0007-use-competencies-for-learning-progression.md
- docs/adr/0010-use-diagnostic-attempts-for-onboarding-auditability.md
- data/catalogs/en/onboarding-diagnostic-question-plan.json
- data/catalogs/en/grammar-competencies.json
- data/catalogs/en/non-grammar-competencies.json

Do the review in this order:

1. Validate the JSON structure.
2. Validate the file against authoredDiagnosticQuestionBankSchema.
3. Compare every item against the authoring plan.
4. Review each item pedagogically.
5. Review difficulty level and diagnostic role.
6. Review scoring safety and mistake codes.
7. Produce a findings report.

If you can run local commands, run a schema validation equivalent to:

pnpm exec tsx -e "import fs from 'node:fs'; import { authoredDiagnosticQuestionBankSchema } from './packages/shared/src/diagnostic-question.ts'; const data = JSON.parse(fs.readFileSync('data/catalogs/en/onboarding-diagnostic-question-bank.json', 'utf8')); const result = authoredDiagnosticQuestionBankSchema.safeParse(data); if (!result.success) { console.error(JSON.stringify(result.error.issues, null, 2)); process.exit(1); } console.log(JSON.stringify({ ok: true, itemCount: result.data.items.length }, null, 2));"

If the command cannot run, explain that and continue with manual review.

Contract checks:

- The root object has schemaVersion: 1.
- targetLanguage is "en".
- purpose is "onboarding_initial".
- items is an array.
- Every key is unique.
- Every status is valid.
- Every responseFormat is valid.
- Every prompt.kind matches responseFormat.
- Every scoringRule.kind matches responseFormat.
- Every item has exactly one primary target.
- primaryCompetencyKey equals the primary target competencyKey.
- Every primaryCompetencyKey exists in data/catalogs/en.
- Every difficultyBand matches the competency level in the plan.
- Every diagnostic role appears in the plan for that competency.
- Every option id referenced by scoring exists in the prompt.
- Every token id referenced by scoring exists in the prompt.
- Every token group referenced by criteria exists in tokenGroups.
- Every mistakeCode is normalized and dot-separated.
- No word_bank_sequence criterion includes feature.
- instructionLocalizations includes both pt and en.
- contentLanguage is "en".

Plan alignment checks:

- Compare total item count with targetQuestionCount.
- Compare distribution by level with plan.totals.byLevel.
- Compare distribution by diagnostic role with plan.totals.byVariant.
- Compare distribution by source catalog with plan.totals.bySourceCatalog.
- Compare per-competency variant counts with each competency.variants entry.
- Check whether generated formats mostly follow recommendedFormats.
- Flag missing planned competencies.
- Flag extra competencies not present in the plan.
- Flag duplicate coverage that creates many near-identical items.

Pedagogical checks:

- The item must test the declared primary competency, not a different skill.
- The item must be answerable from the prompt alone.
- The item must have exactly one clearly correct answer unless the scoring rule
  explicitly allows multiple correct answers.
- Distractors must be plausible but wrong.
- Distractors must map to meaningful mistakeCode values.
- The rationale must explain why the item exists.
- localizationNotes must not reveal the answer.
- safetyNotes may be empty, but flag items with sensitive or culturally loaded
  content.
- Do not require external cultural knowledge.
- Do not use trick questions.
- Do not use overly broad or ambiguous stems.
- Do not create items where vocabulary difficulty is much higher than the
  targeted grammar or reading skill.

Difficulty calibration:

Use this guidance when judging levels.

Pre-A1:

- Very short sentences.
- Basic pronouns, be, articles, simple nouns, basic plurals.
- No multi-clause reasoning.
- Minimal vocabulary load.
- Usually one sentence or one tiny context.
- Reading comprehension items should be rare and extremely simple.

A1:

- Simple present, basic word order, can, present continuous, wh-questions.
- Short everyday contexts are acceptable.
- Word-bank items should usually be 3-6 tokens.
- Avoid long stems or abstract language.

A2:

- Short everyday texts are acceptable.
- Reading items may use up to 3 short sentences and one objective question.
- Past simple, going to, will, comparatives, modals, simple conditionals, and
  basic present perfect are acceptable.
- Longer reading items must be ceiling, confidence, or goal_probe.

B1:

- Short texts may require contrast, sequence, cause, or simple inference.
- Items may test tense contrast, conditionals, passive, reported speech, and
  past continuous versus past simple.
- Reading still must remain short: one paragraph, at most 3 sentences.
- Avoid B2 vocabulary if the target is a B1 grammar signal.

B2:

- Use sparingly as high ceiling signal.
- Items may test past perfect or nuanced sequence/stance.
- Keep texts short and objective.
- Do not include dense academic prose.

Advanced reading multiple-choice checks:

- Use only for A2-B2.
- Use only for ceiling, confidence, or goal_probe.
- Passage has at most 3 sentences.
- Prompt asks one objective question.
- Options have exactly one correct answer.
- Distractors are tied to text misunderstanding, not random wrong answers.
- The item does not rely on outside knowledge.

word_bank_sequence checks:

- correctTokenSequences must contain only prompt token ids.
- Criteria must be deterministic and language-neutral.
- Criteria must not include feature.
- Criteria must emit specific mistakeCodeOnFail values.
- If tokenGroups are used, every referenced group must exist.
- passingScore should normally be 1.
- No clearly invalid word order can reach passingScore through partial
  criteria.
- If a longer sequence makes safe partial scoring hard, recommend simplifying
  the item.

When reviewing word_bank_sequence partial scoring, simulate likely wrong
orders. For example, if the target is:

["token_i", "token_drink", "token_coffee", "token_every", "token_day"]

and the criteria only check:

- token_i before token_drink
- token_drink before token_coffee
- token_every adjacent to token_day
- all tokens used

then this wrong order can pass:

["token_i", "token_drink", "token_every", "token_day", "token_coffee"]

Flag the item and recommend either:

- simplifying the sentence;
- adding a missing order criterion;
- adding a lower passingScore only if the partial answer is truly acceptable;
- making correctTokenSequences and criteria stricter.

Scoring and confidence checks:

- passingScore must fit the item type.
- evidenceConfidence should roughly match:

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

Flag large confidence mismatches, but do not nitpick rounding differences.

Finding severity:

Use these severities:

- Blocker: schema invalid, JSON invalid, missing competency, duplicate key, or
  scoring can mark a clearly wrong answer correct.
- High: wrong level, wrong primary competency, ambiguous correct answer, unsafe
  word_bank_sequence scoring, or role not supported by the plan.
- Medium: weak distractor, weak mistakeCode, too much vocabulary load,
  questionable confidence, missing planned coverage, or near-duplicate item.
- Low: wording polish, minor localization note issue, minor rationale issue.

Required report format:

Start with a summary:

- schema validation result
- item count
- count by level
- count by response format
- count by diagnostic role
- overall recommendation: approve, approve with changes, or do not approve

Then list findings ordered by severity.

For each finding, use this shape:

### [Severity] item key

- Issue: concise description
- Why it matters: impact on diagnosis, scoring, or user experience
- Evidence: quote or summarize the relevant prompt/scoring detail
- Recommendation: concrete fix

If an issue affects many items, group it under:

### [Severity] Cross-cutting issue: title

Include affected item keys as a bullet list.

After findings, include:

## Coverage review

Report:

- missing planned competencies
- overrepresented competencies
- mismatched level counts
- mismatched role counts
- mismatched source catalog counts

Then include:

## Good items

List a few item keys that are strong examples and explain briefly why.

Final answer rules:

- Do not rewrite the whole JSON.
- Do not generate replacement items unless asked.
- Be specific and actionable.
- If there are no findings, say that clearly and mention residual risks.
- If schema validation fails, still continue with any manual review possible.
```
