# Future Improvements

## 2026-06-20

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
