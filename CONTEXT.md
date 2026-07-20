# Glossary

## Instruction language

Language chosen by the user to receive explanations, examples, and support content.

## Target language

Language the user wants to learn.

## Learner

Authenticated person using the app to study a target language.

## Authenticated session

App-owned web session created after successful Cognito authentication and resolved by the backend to a learner.

## Onboarding phrasing

"I speak [Instruction language], I want to learn [Target language]".

## Onboarding progress

Saved position in the onboarding flow that lets a learner resume from the last completed onboarding step instead of starting over.

## User profile

Relevant personal context for lesson personalization, captured directly or inferred from a learner-provided introduction:

- Display name
- Job / field
- Interests
- Daily routine
- Study context (optional)
- Other

## User profile input policy

The primary onboarding path for `User profile` is a learner-recorded introduction about the learner's interests and routines. Closed profile blocks are an alternate path for learners who do not want to record.

`Learner age range`, `Goal`, `Lesson emphasis`, and `Study pace` are separate constrained onboarding inputs. They are never extracted or inferred from the recorded introduction.

The recorded introduction may populate only information the learner states explicitly:

- Job / field
- Interests
- Daily routine
- Study context
- Other

`Job / field` and `Interests` are required profile details. `Daily routine`, `Study context`, and `Other` are optional. The recording prompt and closed inputs should encourage the learner to share `Daily routine` because it improves personalization. After extraction, the learner reviews the recovered details and completes required details that remain missing through closed inputs.

Recorded introductions are used only to infer the `User profile`; raw audio is not retained after extraction.
Recorded introductions should feel short and natural, with a 90-second maximum.
Recorded introductions should be made in the learner's `Instruction language`.
Learners under 13 should use closed profile blocks instead of recorded introductions.

## Display name

Name the app uses to address the learner in the product experience. It is not a login identifier or a public username.

During onboarding, ask "How would you like me to address you?" with an optional editable input prefilled from the auth-provider name when available. `Display name` is never extracted from the recorded introduction.

## Learner age range

Approximate age band selected during onboarding for age-appropriate lesson personalization.

Learner age range options:

- Under 13
- 13-17
- 18-24
- 25-39
- 40-59
- 60+

## Goal

Learning target chosen from fixed options:

- Everyday conversation
- Work
- Travel

Goal policy:

- 1 primary goal is required
- Up to 2 additional goals are optional
- Optional goals can be chosen from:
  - Everyday conversation
  - Work
  - Travel

`Exam prep` and learner-facing `CEFR level` goals are outside the MVP. CEFR-like levels may be used only as internal difficulty references for competency selection and lesson planning.

## Internal difficulty reference

Approximate proficiency band used internally to calibrate competencies, diagnostics, and lesson difficulty. It is not presented as a learner goal or certification promise.

## Initial diagnostic

Optional short adaptive assessment performed during onboarding. It provides initial evidence for the learner's `Competency profile`; the `Beginner path` skips it, and remaining uncertainty is resolved through lesson performance.

## Onboarding starting point

Learner's choice between a `Beginner path` and a `Diagnostic path` during onboarding.

## Beginner path

Onboarding route for a learner who is starting from zero. It skips the `Initial diagnostic`.

## Diagnostic path

Onboarding route for a learner who already knows some of the target language. It runs the `Initial diagnostic`.

## Competency profile

Per-target-language view of the learner's estimated knowledge across concepts and derived ability across relevant competencies, together with the confidence of each estimate. It guides lesson focus and evolves as new evidence is collected.

## Learner competency state

Current estimate for one learner's partial or integrated ability and confidence in one catalog competency. It may combine direct evidence with a `Competency mastery projection`, but it does not replace the component states relevant to a particular activity.

## Competency catalog

Versioned set of measurable capabilities and their learning relationships for one target language. Adaptive planning and the `Pedagogical policy` both reference this shared catalog.

## Concept

Reusable unit of linguistic knowledge that a competency may contain, assume, or use as support. A concept has no proficiency level and may itself be a learning or assessment target.

## Component concept

Concept that directly composes the observable performance described by a competency.

## Assumed concept

Concept whose declared `Capability` is expected before a learner attempts a competency or activity, without being part of the performance being measured.

## Supporting concept

Concept that is relevant to a competency or activity without composing its primary performance or acting as assumed knowledge.

## Capability

Degree of language control at which a learner can demonstrate a concept: recognition, controlled production, contextualized use, or independent use.

## Learner concept state

Current estimate of one learner's knowledge and confidence for one concept at one `Capability`. It distinguishes direct from inferred evidence and persists across compatible catalog versions.

## Competency mastery projection

Non-authoritative summary of partial mastery across a competency's component concept states. It preserves variation between components while providing a competency-level estimate when needed.

## Published competency catalog

Approved version of a `Competency catalog` used for learner planning, diagnostics, lesson generation, and progress tracking.

## Competency identifier

Stable catalog-specific reference for one competency. It is used to connect catalog authoring, diagnostics, planning, and learner evidence without depending on learner-facing wording.

## Competency family

Broad kind of capability represented by a competency, such as situational communication, grammar, vocabulary, comprehension, or production.

## Competency tag

Metadata label used to group or filter catalog competencies when the distinction is not already captured by level, family, goal weight, or a learning relationship.

## Competency prerequisite

Learning relationship where one competency should usually be present before another competency is taught, assessed, or used as a module objective.

## Prerequisite strength

Relative importance of a `Competency prerequisite` for readiness. Stronger prerequisites should have more influence on planning than weak supporting relationships.

## Competency evidence

Observation from a diagnostic, lesson, review, or activity response that informs the learner's `Competency profile`.

## Competency evidence source

Origin of a `Competency evidence` observation, such as an initial diagnostic, lesson activity, review, or manual correction.

## Concept evidence

Observation from a diagnostic, lesson, review, or activity response that informs a `Learner concept state`. It records whether the observation is direct or inferred.

## Supporting competency

Competency practiced or observed inside a module, diagnostic item, or lesson activity without being the primary objective.

## Module

Bounded learning unit that organizes several lessons around a small set of competencies from the `Competency catalog`.

## Module objective

Primary competency or learning outcome the `Module` is designed to advance.

## Module prerequisite

Competency that should usually be present before a `Module` starts or before it advances to a harder step.

## Module outline

Ordered list of competencies and lesson focuses within a `Module`. The objective stays stable while the remaining outline may adapt to evidence from lessons.

## Module completion

State that the learner has shown enough evidence to leave a `Module` and move to the next planned unit.

## Module candidate score

Internal ranking of possible next `Module` objectives for a learner. It compares eligible candidates using prerequisite readiness, goal weight, competency gaps, uncertainty, review needs, lesson emphasis fit, and recent learning focus.

## Pedagogical policy

Product-owned, revisable weights that influence adaptive content selection without defining a fixed `Learning plan`. It is separate from the relatively stable linguistic facts in a `Competency catalog`.

## Goal weight

Relative relevance assigned by the `Pedagogical policy` to a concept or competency for a particular `Goal`. It influences adaptive selection without predetermining lesson order.

## Base priority

Goal-independent importance assigned by the `Pedagogical policy` to a competency. It expresses foundational relevance as a graduated weight rather than a binary classification.

## Foundation weight

Relative suitability of a competency as an initial learning entry point. It helps select beginner foundations without defining a fixed sequence.

## Learning priorities

Ordered competencies and vocabulary selected for a learner from profile evidence, knowledge gaps, goals, and review needs. They define what the learning experience should address next.

## Learning plan

Internal, revisable sequence of upcoming `Module`s and lesson focuses derived from the learner's `Learning priorities`. It changes as lessons add evidence to the `Competency profile`.

## Vocabulary set

Related target-language terms associated with one or more competencies, goals, or personalization topics. Individual vocabulary terms are learning content, not competencies.

## Personalization topics

Learner-specific interests and contexts used to make examples, vocabulary, and activities relevant. They are not competencies or mandatory learning requirements.

## Diagnostic item

Assessment prompt designed to collect evidence primarily about one competency or concept at a known difficulty.

## Diagnostic target

Competency or concept that a `Diagnostic item` is intentionally designed to assess. Each diagnostic item has one primary diagnostic target and may also have supporting targets.

## Diagnostic target role

Purpose of a `Diagnostic target` within a diagnostic item, such as primary or supporting.

## Diagnostic item role

Selection purpose of a `Diagnostic item` inside a `Diagnostic attempt`, such as
foundation, ceiling, repair, confidence, or goal_probe. See
`docs/diagnostic-question-roles.md`.

## Diagnostic target weight

Relative contribution of a diagnostic item response to one `Diagnostic target`.

## Evidence mapping

Declared relationship from a question response to a concept and `Capability`, together with the strength of the resulting evidence.

## Question mode

Primary language channel that a diagnostic item or learning activity is intended to collect evidence about: reading, writing, listening, or speaking. It is distinct from the response format used to capture the learner's answer.

## Scoring rule

Reviewed rule that converts a diagnostic response into score and evidence. It should be deterministic for the `Initial diagnostic`.

## Audited onboarding question bank

Versioned collection of diagnostic items reviewed before learner use. Each item has a target language, primary `Diagnostic target`, difficulty, `Question mode`, response format, scoring rule, and `Evidence mapping`s.

## Diagnostic attempt

One learner execution of the `Initial diagnostic` for a `LearningTrack`. A diagnostic attempt records which diagnostic items were presented, in what order, and how the attempt finished. An in-progress attempt may be resumed for up to 48 hours; stale incomplete attempts are abandoned before a new attempt starts.

## Diagnostic attempt purpose

Reason a `Diagnostic attempt` exists, such as initial onboarding calibration, future recalibration, or internal quality review. The MVP learner experience uses the initial onboarding purpose.

## Diagnostic attempt item

One `Diagnostic item` presented inside a `Diagnostic attempt`. It records the item's position in the attempt, the learner's structured response when answered, and the deterministic scoring result used to create concept or competency evidence. In the MVP, whether an attempt item was answered is inferred from response data rather than stored as a separate item status.

## Diagnostic selection policy

Versioned deterministic rule set that chooses the next `Diagnostic item` during a `Diagnostic attempt`. It may use item roles, previous answers, goals, difficulty, and current evidence estimates, but it does not use runtime LLM judgment.

## Diagnostic response duration

Time between showing a `Diagnostic attempt item` and receiving the learner's response. It is collected for analysis, but should not affect MVP scoring or confidence until enough item-specific data exists to interpret it.

Diagnostic response duration is derived from item timestamps rather than stored as a separate duration value.

## Diagnostic don't-know response

Explicit learner response that they do not know how to answer a `Diagnostic attempt item`. It is treated as an answered item with no positive score, not as a skipped item or abandoned attempt.

## Diagnostic completion

End of a `Diagnostic attempt` after the selection policy decides enough items have been answered or no useful next item remains. The MVP completes the diagnostic automatically instead of asking the learner to manually finish it.

## Word bank item

Constrained diagnostic item answered by selecting or arranging provided words. It measures assisted sentence construction, not independent written production.

## Fill blank choice item

Constrained diagnostic item answered by choosing an option for a blank inside a sentence or short text.

## Multiple choice item

Constrained diagnostic item answered by choosing one option from a fixed option set.

## Independent production item

Diagnostic item answered without provided language choices. In the initial diagnostic, it is an optional high-difficulty item unlocked by strong performance on assisted items.

## Study pace

Study cadence preference, collected in the same onboarding step as `Lesson emphasis`. For the MVP, limited to two modes: relaxed or accelerated.

## Study pace policy

Study pace is optional in onboarding.

## Lesson emphasis

Optional onboarding preference for how the lesson should be delivered:

- Reading
- Writing
- Listening

## Lesson emphasis policy

Lesson emphasis is a multi-select field. `Speaking` is excluded from the MVP.

## Lesson length

Default lesson size used at start.

## Lesson length policy

Use one default size for new users. After the first lesson, ask for feedback:

- Too long
- About right
- Too short

If the user says `Too long`, reduce future lesson size.

## Lesson report

Summary of student performance in a lesson, generated from activity responses and reviewed before creating the next lesson.

## Lesson report policy

The IA stores richer internal notes, and also shows the user a friendly feedback version that includes:

- Strengths
- Points for improvement
- How those points will be addressed in the next lesson
- A clear invitation to continue

## Next lesson policy

The active `Module` should be used as the main input for the next lesson. `Top mistakes` from the previous lesson should adapt the outline inside that module.

## Review points policy

The next lesson should also bring back selected review points from older lessons from time to time.
Review points should be lightweight and should not override the main focus from the latest report.
Suggested cadence: 1 to 2 review points every 3 lessons.

## Mistake priority policy

- Most frequent mistakes should reappear in the next lesson
- Rare mistakes should be used only as light reference
- If a mistake appears 2 times or more, it gets high priority
- The AI should not repeat everything, only what blocks progress the most inside the active `Module`

## Lesson generator guidelines

The lesson generator should follow a light contract, not a rigid template.
It should always consider:

- Goal
- User profile
- Lesson emphasis
- Module
- Top mistakes
- Review points
- Lesson length

It can adapt the activities and wording freely as long as the lesson stays personalized and consistent.

## Agent roles

### Lesson generator

Agent responsible for creating the core lesson.

### Validator

Agent responsible for checking consistency, module fit, and policy fit.

### Exercise reviewer

Agent responsible for correcting activities and producing feedback.

### External content curator

Optional agent responsible for finding external material and linking it to the lesson.

## Bonus content policy

After the core lesson, the user may receive optional bonus content if it makes sense.
Bonus content can use external material and follow-up exercises, but it should never block the core lesson.

## Content source policy

External content should rely on public web sources.
Music content may be presented as Spotify links when available.
YouTube content may be embedded when appropriate.

## Language policy

All glossary terms and all ADRs must be written in English.
