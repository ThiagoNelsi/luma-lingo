# Infrastructure

This directory contains the first Terraform slice for LumaLingo: Cognito Managed Login for MVP auth.

It intentionally creates only the resources needed by issue #15:

- Cognito user pool for learner identities
- Cognito app client for authorization code flow
- Cognito managed-login domain
- Optional Google social identity provider
- Outputs that define the API/web auth configuration contract

## First Terraform mental model

Terraform files describe desired infrastructure. The usual loop is:

1. `terraform init` downloads the provider plugins declared in `versions.tf`.
2. `terraform plan` compares these files with Terraform state and AWS, then previews changes.
3. `terraform apply` executes the plan and updates state.

In this folder:

- `versions.tf` says which Terraform and AWS provider versions this root module expects.
- `variables.tf` defines inputs for each environment.
- `cognito.tf` defines the Cognito Managed Login resources.
- `cognito-outputs.tf` prints values needed by the API and web app.
- `dev.tfvars.example` is a copyable local development input file with no real secrets.

## Local dev setup

Create an uncommitted `dev.tfvars` from the example:

```sh
cp dev.tfvars.example dev.tfvars
```

Change `cognito_domain_prefix` to a globally unique value. The prefix must not contain `aws`, `amazon`, or `cognito`.

Run:

```sh
terraform init
terraform fmt
terraform validate
terraform plan -var-file=dev.tfvars
```

Apply only after reviewing the plan:

```sh
terraform apply -var-file=dev.tfvars
```

## Google identity provider

For the MVP, Google is the only social identity provider. Keep it disabled until an operator creates a Google OAuth client.

When enabled, configure the Google OAuth client with this authorized redirect URI:

```txt
https://<cognito-domain>/oauth2/idpresponse
```

For the default Cognito prefix domain, `<cognito-domain>` has this shape:

```txt
<cognito_domain_prefix>.auth.<aws_region>.amazoncognito.com
```

Then pass the Google credentials without committing them:

```sh
terraform plan \
  -var-file=dev.tfvars \
  -var='enable_google_idp=true' \
  -var='google_client_id=...' \
  -var='google_client_secret=...'
```

Prefer environment variables or a local ignored tfvars file for real values.

## API and web environment contract

The API needs:

- `AWS_REGION`
- `COGNITO_USER_POOL_ID`
- `COGNITO_APP_CLIENT_ID`
- `COGNITO_APP_CLIENT_SECRET`
- `COGNITO_DOMAIN`
- `AUTH_CALLBACK_URL`
- `AUTH_LOGOUT_URL`
- `FRONTEND_ORIGIN`
- `API_ORIGIN`
- `SESSION_COOKIE_NAME`
- `SESSION_COOKIE_SECURE`
- `SESSION_TTL_DAYS=7`

The web app needs only public values:

- `VITE_API_ORIGIN`
- `VITE_AUTH_LOGIN_URL`, or a backend route such as `/auth/login` that starts the redirect
- `VITE_FRONTEND_ORIGIN`

Do not expose Cognito tokens or the Cognito app client secret to browser JavaScript.

## Backend session contract

After Cognito redirects to the backend callback, the API exchanges the authorization code for tokens, validates the identity, checks `email_verified`, creates or finds the learner by Cognito `sub`, and creates a Postgres-backed opaque session id.

The cookie stores only the random session id and should be:

- `HttpOnly`
- `Secure` except localhost development
- `SameSite=Lax`
- fixed seven-day expiry

The MVP does not persist Cognito refresh tokens server-side.

## Test guidance for issue #14

Behavior-level tests should not call live AWS. Keep Cognito behind a narrow backend boundary and mock:

- managed-login redirect start
- callback token exchange
- verified-email session creation
- unverified-email rejection
- `/me` with and without a valid app session
- logout clearing the app cookie and redirecting through Cognito logout

Missing auth/session environment variables should fail clearly at API startup.

## State and secrets

Terraform state can contain sensitive values, including the generated Cognito app client secret. Do not commit state files. Before production, move state to a locked remote backend such as S3 plus DynamoDB locking or HCP Terraform.
