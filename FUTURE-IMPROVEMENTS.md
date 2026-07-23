# Future Improvements

## 2026-07-23

### Aggregate Confidence Across Direct Concept Evidence

- **Deferred:** Replace the current “latest direct evidence wins” update for
  `learner_concept_states.confidence` with a calibrated aggregation of
  concordant direct evidence. The aggregation should account for each
  evidence mapping's strength, conflicting results, and correlation between
  probes from the same diagnostic attempt; it must not equate raw evidence
  count with confidence. Include a safe plan to recompute or backfill existing
  states from append-only `concept_evidence` records.
- **Current scope boundary:** The July 23 investigation only diagnosed the
  observed state `019f8b61-47b3-7479-bb21-de974cdabfa7`; it made no product or
  persistence change. Choosing and calibrating an aggregation model requires
  pedagogical policy work and regression coverage beyond that diagnosis.
- **Future value:** Four correct direct observations currently leave that
  state at 23.4% confidence because the final 30%-strength mapping overwrites
  the prior 54.6%, 23.1%, and 22.8% mappings. Aggregation would make
  confidence represent the accumulated certainty in the learner estimate,
  while retaining restraint for repeated or weakly related observations.
- **Revisit when:** Before learner-state confidence drives planning or is
  exposed to learners. Define calibration simulations and expected behavior
  for supporting/weak mappings, independent confirmation, contradictory
  evidence, and same-attempt correlation; then add regression tests and a
  backfill/reprojection procedure.

## 2026-07-22

### Weak Correlated-Component Priors During Onboarding

- **Deferred:** Let strong direct evidence for one component concept create a
  low-confidence prior for explicitly correlated sibling components. For
  example, evidence for an affirmative present-simple form could weakly inform
  the selection of probes for related negative and question forms. Correlations
  should be directional and authorially declared rather than inferred from
  shared competency membership alone.
- **Current scope boundary:** Issue #33 infers weaker positive evidence only for
  assumed concepts and preserves unknown component states during mastery and
  readiness calculations. Automatically spreading evidence across components
  would exceed that issue and could erase meaningful variation between sibling
  forms that the concept model is intended to preserve.
- **Future value:** A weak correlated prior could make a short onboarding
  diagnostic more efficient by choosing better confirmation or repair probes,
  avoiding unnecessarily basic questions, and improving initial ranking while
  still treating unobserved components as unknown for readiness.
- **Revisit when:** The catalog can express explicit directional correlation
  metadata and deterministic simulations can calibrate conservative weights,
  initially around `0.10` to `0.25`. Define separate provenance such as
  `component_correlation`, keep confidence below the known-state threshold, and
  verify that correlated priors never satisfy conjunctive activity requirements
  without stronger evidence.

## 2026-07-20

### Support Competencies In Diagnostic Evidence Mappings

- **Deferred:** Generalize diagnostic evidence mappings so an item can declare
  evidence for competencies as well as concepts, with an explicit target kind
  and target-specific validation. Keep the existing primary target as the
  item's single selection and reporting objective while allowing its Q-matrix
  to describe additional competency evidence when the response genuinely
  diagnoses an integrated performance.
- **Current scope boundary:** Issue #31 is intentionally limited to a small A1
  MVP bank. It keeps concept evidence mappings for competencies with components
  and permits an empty concept mapping only for a primary componentless
  competency such as `en.greetings.a1`, whose existing primary target already
  produces direct competency evidence. A polymorphic Q-matrix would require a
  broader domain contract, database constraints, importer changes, evidence
  processing, selector semantics, retrieval APIs, and regression tests.
- **Future value:** Competency mappings would support retrieving questions by
  integrated performance even when that competency has no component concepts,
  while concept mappings would continue to provide richer cross-competency
  retrieval. Together they could find items whose primary target is different
  but whose response still supplies useful evidence for the learner's current
  competency context, without conflating a primary target with every skill an
  item diagnoses.
- **Revisit when:** Question discovery or lesson activity reuse needs to query
  secondary competency evidence across primary targets, or when more
  componentless competencies require reusable diagnostic coverage. Define how
  competency-mapped evidence avoids duplicating the automatic evidence for the
  primary competency before changing the schema.

## 2026-07-19

### Versioned Curriculum Artifact Metadata And Checksums

- **Deferred:** Add checksum verification for imported curriculum artifacts and
  formal metadata tables for catalog, concept-registry, taxonomy, pedagogical-policy,
  and diagnostic-question-bank versions. Record which immutable artifact versions
  and import runs produced each published runtime dataset.
- **Current scope boundary:** The current MVP runs locally against a disposable
  development database and will rebuild the curriculum from locally versioned
  artifacts after a tested backup. Checksums and a generalized metadata/version
  model are not required to complete that local reset and import safely.
- **Future value:** Explicit artifact provenance will make production imports
  reproducible and auditable, prevent mismatched catalog and question-bank versions,
  support rollback, and clarify which policy, taxonomy, registry, and scoring inputs
  produced learner evidence.
- **Revisit when:** Before publishing curriculum to a non-disposable environment,
  supporting concurrent catalog or question-bank versions, automating imports, or
  adding the planned B1/B2 catalog expansion.

## 2026-06-27

### Reuse Audited Diagnostic Items In Lessons

- **Deferred:** Reuse the audited onboarding question bank after onboarding as
  one source of lesson activities, alongside fully generated lesson questions
  and user-adapted variants prepared before a module starts. A future module
  start flow could select relevant audited items for the module's focus
  competencies, adapt them in the background to the learner's profile, goal, and
  lesson context, and store the resulting learner-specific variants for
  low-latency retrieval during lessons. Some common items may support
  placeholders with safe defaults, such as replacing a default verb with a
  learner-relevant verb when the substitution has been validated.
- **Current scope boundary:** The current diagnostic work is focused on
  deterministic onboarding item selection, scoring, and evidence capture. Using
  the same item bank inside generated lessons introduces a separate lesson
  activity sourcing strategy, variant lifecycle, validation rules, and caching
  model that should not complicate the initial diagnostic.
- **Future value:** Reusing audited items can improve lesson quality and reduce
  dependence on fully generated questions, while learner-specific prepared
  variants preserve personalization without adding runtime LLM latency during a
  lesson. As learner volume grows, many learners will share similar interests,
  goals, jobs, routines, and contexts; adapted variants created for one learner
  may become reusable for others if they are tagged by reusable themes such as
  cooking, football, animals, travel, office work, or parenting. A taggable
  variant bank could let the app retrieve an already validated adaptation
  instead of paying for another LLM generation for the same competency-context
  combination.
- **Revisit when:** Module planning and lesson generation both consume
  competency targets, the audited question bank has enough coverage, and the
  product needs a blended activity strategy with fully generated items, common
  pregenerated items, and pre-adapted learner-specific variants.

## 2026-06-21

### Recorded-Introduction Content Guardrails

- **Deferred:** Add a moderation and data-minimization step before persisting
  profile details extracted from a recorded introduction. Classify the
  transcript and extracted fields, reject or redact disallowed content and
  unnecessary sensitive personal data, and persist only allowlisted profile
  facts. Store a safe processing status or error code instead of the filtered
  content.
- **Current scope boundary:** The current implementation does not persist raw
  audio or transcripts and limits extraction to structured profile fields, but
  it trusts the extraction provider's output after schema validation. Adding a
  defined content policy, moderation provider, redaction rules, user feedback,
  and false-positive handling is outside the current recorded-introduction
  change.
- **Future value:** Defense-in-depth prevents abusive, sexual, violent, hateful,
  self-harm, illegal, or unnecessarily sensitive content from entering learner
  profile records and later influencing generated lessons. Explicit rules also
  make moderation behavior testable and auditable.
- **Revisit when:** Before accepting recordings from real learners or using
  extracted profiles in lesson generation; after defining the product's content
  policy, sensitive-data allowlist, learner-facing fallback, and retention and
  audit requirements.

## 2026-06-20

### Production-Grade Recorded-Introduction Processing

- **Deferred:** Move recorded-introduction transcription and profile extraction out of the API process into bounded worker concurrency backed by a durable queue and encrypted temporary audio storage with automatic TTL deletion. Before accepting real learner recordings, move Gemini usage from the development free tier to a paid account whose data terms do not allow prompts and responses to improve Google products, or choose another provider with equivalent controls through the existing adapters.
- **Current scope boundary:** Issue #4 keeps each short recording in API memory, runs a small bounded retry policy, and persists only extraction status and structured results. Adding Redis/workers and temporary object storage conflicts with the cost-controlled development baseline and would expand the privacy surface before load requires it.
- **Future value:** Dedicated workers isolate provider latency and retries from API capacity, apply backpressure, survive API restarts, and let web traffic scale independently from media processing. Paid production data controls allow recordings from real learners without relying on the free-tier training terms accepted only for synthetic development data.
- **Revisit when:** Before the first test with real learner audio; or when concurrent recordings create material API memory pressure, event-loop latency or request throughput degrades, retries amplify provider traffic, jobs are lost during deploys/restarts, or production already has secure queue and temporary object-storage infrastructure.

### Verified Recorded-Introduction Duration

- **Deferred:** Decode uploaded recorded-introduction media on the backend and verify its real duration instead of trusting the browser-reported duration.
- **Current scope boundary:** Issue #4 caps browser recording at 90 seconds and combines the declared duration with strict MIME and byte-size limits; adding media probing or `ffmpeg` would expand the MVP runtime and deployment surface.
- **Future value:** Server-side verification prevents modified clients from submitting recordings longer than the product limit and gives more reliable resource controls.
- **Revisit when:** The recorded-introduction endpoint faces untrusted-client abuse, duration-based billing risk, or already has a supported media-processing dependency.

### Broader Language Catalog And Regional Variants

- **Deferred:** Expand beyond Portuguese, English, Spanish, Italian, French, German, and Chinese; add languages such as Japanese and Korean, plus explicit regional variants such as `pt-BR`, `pt-PT`, `en-US`, and `en-GB`.
- **Current scope boundary:** Issue #2 uses a small fixed catalog with language-level codes and one representative flag per language so onboarding and lesson inputs stay consistent.
- **Future value:** More languages and regional variants can improve reach, local vocabulary, pronunciation guidance, and culturally accurate content.
- **Revisit when:** Learner demand justifies expanding the catalog and lesson generation can validate each new language/variant across content, typography, and pedagogy.

## 2026-06-19

### Tutor Mascot

- **Deferred:** Introduce a mascot character that represents the tutor or teacher who customizes lessons for the learner.
- **Current scope boundary:** The MVP should avoid mascots and stay focused on the essential learning loop.
- **Future value:** A tutor mascot may make personalization feel more concrete and emotionally memorable once the core product is working.
- **Revisit when:** The product has validated the core lesson loop and is ready to invest in a stronger brand and retention layer.

### Retention-Focused Gamification

- **Deferred:** Add gamification mechanics focused on user retention.
- **Current scope boundary:** The MVP intentionally avoids gamification and streak pressure so the experience stays learning-first.
- **Future value:** Carefully designed gamification may improve return behavior without undermining the app's supportive tone.
- **Revisit when:** The product has baseline retention data and can evaluate which mechanics support learning instead of creating pressure.

### Age-Range-Specific Interface Modes

- **Deferred:** Adapt the interface style by `Learner age range`, especially with more playful, mascot-led, and gamified experiences for children.
- **Current scope boundary:** The MVP should use one mobile-first visual direction that avoids both childishness and excessive seriousness.
- **Future value:** Age-aware presentation may improve comfort, motivation, and appropriateness for very different learner groups.
- **Revisit when:** The app supports enough learners across age ranges to justify maintaining multiple experience modes.

### Inline Per-Activity Feedback

- **Deferred:** Show short corrective feedback immediately after each learner response during a lesson, in addition to the final `Lesson report`.
- **Current scope boundary:** The MVP should keep the first lesson UI focused on the guided activity flow and final report rather than adding more interaction states.
- **Future value:** Inline feedback may help learners correct mistakes earlier and make the tutor feel more responsive.
- **Revisit when:** The core activity stack and lesson report are working and the team can test whether inline feedback improves completion and learning quality.

## 2026-06-18

### Explicit Email Change Flow

- **Deferred:** Support changing `users.primary_email` through an explicit account-management flow.
- **Current scope boundary:** Issue #16 phase 2 should only persist the first verified email received during authentication. The MVP should not automatically update `primary_email` when the auth provider sends a different verified email.
- **Future value:** A deliberate email-change flow can handle confirmation, auditability, rollback, and provider/account consistency without surprising the learner.
- **Revisit when:** The app adds account settings, self-service profile management, email notifications, or requirements for handling changed provider emails.

### Session Device And Network Metadata

- **Deferred:** Store session `user_agent` and `ip_hash` metadata.
- **Current scope boundary:** The first session schema only needs the opaque token hash, user link, expiry, creation time, last-seen timestamp, and revocation timestamp. Device and network metadata add privacy and retention decisions that are not needed for the MVP.
- **Future value:** These fields may support session management, security review, suspicious-login detection, and user-visible active-session lists.
- **Revisit when:** The product needs account-security UI, login auditing, abuse investigation, or a clear LGPD/privacy retention policy for session metadata.

### Account Deletion And Retention Policy

- **Deferred:** Add self-service account deletion, soft-delete fields such as `users.deleted_at`, learner or track archival fields, and the related data-retention/anonymization behavior.
- **Current scope boundary:** ADR 0003 leaves self-service account deletion out of the MVP, and issue #16 phase 2 only needs the first active user, learner, track, and session schema.
- **Future value:** A deliberate deletion and retention design can handle privacy expectations, LGPD compliance, recovery windows, learning-history anonymization, and provider-account cleanup.
- **Revisit when:** The product adds account settings, legal/privacy retention requirements, learner export/deletion requests, or production data-retention policies.
