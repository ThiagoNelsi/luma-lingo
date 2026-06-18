# Future Improvements

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
