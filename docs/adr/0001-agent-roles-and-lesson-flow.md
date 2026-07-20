# ADR 0001: Agent Roles and Lesson Flow

Status: Accepted

## Context

The product generates highly personalized language lessons. The lesson must stay fast to produce, consistent in quality, and adaptable to user context, lesson emphasis, and prior mistakes.

A single monolithic agent would be simpler to start with, but it would mix concerns:

- lesson creation
- policy and module validation
- exercise correction and feedback
- external content discovery

This makes the system harder to reason about and harder to evolve safely.

## Decision

We will split lesson generation into separate agent roles:

- `Lesson generator`: creates the core lesson
- `Validator`: checks consistency, module fit, and policy fit
- `Exercise reviewer`: corrects answers and produces feedback/report output
- `External content curator`: optional agent that finds external material and links it to a lesson when it makes sense

## Lesson flow

1. The `Lesson generator` creates the core lesson using:
   - `Goal`
   - `User profile`
   - `Lesson emphasis`
   - `Module`
   - `Top mistakes`
   - `Review points`
   - `Lesson length`

2. The `Validator` checks whether the lesson is coherent, aligned with the user profile, and appropriate for the active module and focus.

3. The `External content curator` may enrich the lesson or post-lesson experience with optional external material.

4. The lesson is delivered.

5. The `Exercise reviewer` evaluates the user's answers, records the lesson report, and generates friendly feedback.

6. The next lesson uses the lesson report, with the active `Module` as the main input and `Top mistakes` adapting the module outline over time.

## Consequences

### Positive

- Each agent has a single responsibility.
- Lesson generation stays flexible without needing a rigid template.
- Validation can evolve independently from content generation.
- External content remains optional and does not block the core lesson.
- Correction and feedback can improve without affecting generation logic.

### Trade-offs

- More orchestration is required.
- There are more boundaries to define between agents.
- The system needs shared vocabulary and shared inputs to avoid drift.

### MVP guidance

- Keep the `Validator` lightweight at first.
- Keep the `External content curator` optional.
- Prioritize a reliable `Lesson generator` and `Exercise reviewer` before adding more complexity.
