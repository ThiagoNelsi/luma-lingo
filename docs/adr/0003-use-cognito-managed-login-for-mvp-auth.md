# ADR 0003: Use Cognito Managed Login for MVP Auth

Status: Accepted

## Context

ADR 0002 selected Cognito with a custom login screen in the app. After reviewing Cognito Managed Login, we decided to replace the custom login screen for the MVP with Cognito-hosted sign-up and sign-in pages.

## Decision

The MVP auth entry will redirect learners to Cognito Managed Login with the authorization code flow. Cognito owns sign-up, sign-in, password reset, MFA, Google/social identity provider selection, and local username/email/password flows. The backend owns the callback, code exchange, user identity validation, web session cookie, `/me`, logout coordination, and post-auth onboarding/profile flow.

For the web MVP, the frontend must not store Cognito tokens. After the backend exchanges the authorization code with Cognito, it creates an app-owned `HttpOnly` session cookie and redirects the learner back to the frontend. Logout clears the app session cookie, redirects through Cognito logout so Cognito clears its managed-login session too, and returns the learner to the app login route.

The MVP does not persist Cognito refresh tokens server-side. Web sessions use a DB-backed opaque session id: the cookie stores only a random session id, while Postgres stores the session record, learner link, and expiry. Session lifetime is seven days from login, with no sliding extension in the MVP; when it expires, the learner returns through Cognito login.

The web session cookie uses `HttpOnly`, `Secure`, and `SameSite=Lax`. The backend validates OAuth `state` during the Cognito callback, and state-changing app API routes require CSRF protection.

Public self-signup is enabled for the MVP. Learners can sign up with local Cognito credentials or Google, the only social identity provider in MVP scope. App access requires a verified email address. The MVP does not require birthdate or age collection in Cognito; age-related personalization is handled later in onboarding through `Learner age range`.

If the callback identity does not have a verified email address, the backend does not create an app session or learner record. It redirects back to the app login route with an email-verification error.

Local Cognito sign-in uses email and password from the learner's point of view. The app treats Cognito `sub` as the stable identity key and does not introduce a product-level username concept in the MVP. If the app needs to address the learner by name, it uses `Display name` from onboarding or an auth-provider name claim.

After authentication, learners land in the authenticated app shell. The app reads `/me` to decide whether to resume onboarding or continue into the learning experience. Onboarding progress is saved by step so learners can resume from the last completed onboarding step.

The backend creates the learner record just in time on first successful authentication. Existing learners are matched by Cognito `sub`; new learners receive an empty onboarding state and continue into the onboarding flow. The app does not merge learners by email in the MVP. If multiple providers should map to one learner, that linking must happen in Cognito so the backend still sees one `sub`.

Managed Login branding is basic for the MVP: configure enough app name, logo, and color treatment to feel like LumaLingo, but defer deeper theme customization and localization until the learning loop needs it.

Self-service account deletion is out of scope for the MVP.

## Consequences

- The MVP avoids custom auth UI and password-flow maintenance.
- Branding and localization are configured in Cognito instead of the React app.
- Issue #14 should be reframed from a custom login screen to a managed-login redirect flow.
- Self-service profile management remains application-owned because Cognito Managed Login does not cover that surface.
- Token lifecycle complexity stays behind the backend instead of leaking into frontend storage.
- The app must handle first-time learners after authentication because self-signup can create accounts before onboarding is complete.
