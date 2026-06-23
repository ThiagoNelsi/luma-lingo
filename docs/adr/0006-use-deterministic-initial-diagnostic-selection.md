# ADR 0006: Use deterministic initial-diagnostic selection

The `Initial diagnostic` needs reproducible difficulty and scoring so its `Competency profile` and confidence estimates remain explainable and testable. Diagnostic items will be generated before learner use, reviewed, versioned, and stored in an `Audited onboarding question bank`; a deterministic procedural algorithm will select items and update estimates from response evidence.

An LLM may assist the offline authoring workflow, but it will not generate, select, score, or sequence items at runtime. This gives up unlimited runtime variation in exchange for stable item metadata, repeatable assessments, auditable outcomes, and deterministic tests.
