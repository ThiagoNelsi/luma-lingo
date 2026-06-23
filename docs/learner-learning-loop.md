# Learner Learning Loop

This diagram shows the product flow from first login through onboarding, first lesson creation, and the repeated lesson loop.

```mermaid
flowchart TD
  A[First login] --> B[Authenticate with Cognito]
  B --> C[Backend resolves authenticated session]
  C --> D[Start onboarding]

  D --> E[Choose instruction language]
  E --> F[Choose target language]
  F --> G[Choose display name]
  G --> H[Choose age range]
  H --> I[Choose primary goal and optional goals]
  I --> J[Record or enter user profile]
  J --> K[Choose lesson emphasis and study pace]
  K --> L{Onboarding starting point}

  L --> M[Beginner path]
  L --> N[Diagnostic path]
  N --> O[Run initial diagnostic]
  O --> P[Update competency profile and confidence]
  M --> Q[Skip initial diagnostic]
  Q --> R[Build initial learning priorities]
  P --> R

  R --> S[Build learning plan]
  S --> T[Select first module]
  T --> U[Generate first lesson]
  U --> V[Deliver guided activity stack]
  V --> W[Collect responses]
  W --> X[Create lesson report]
  X --> Y[Update competency profile]
  Y --> Z[Update module progress]
  Z --> AA{Module complete?}

  AA -->|No| AB[Adapt current module outline]
  AB --> U

  AA -->|Yes| AC[Select next module from learning plan]
  AC --> U

  X --> AD[Show learner strengths, improvement points, and next step]

  AD --> AE{Learner continues now or later?}
  AE -->|Now| U
  AE -->|Later| AF[Return to home screen]
  AF --> AG[Resume next lesson later]
  AG --> U
```

## Notes

- `Beginner path` skips the initial diagnostic.
- `Diagnostic path` runs the initial diagnostic and seeds the first competency estimates.
- The `Learning plan` is revisable and points to the next `Module`.
- `Top mistakes` refine the active module outline instead of replacing the module objective.
- `Review points` are added lightly alongside the active module.

## Sequence View

```mermaid
sequenceDiagram
  actor Learner
  participant WebApp as Web app
  participant API as API
  participant Cognito as Cognito
  participant Planner as Learning planner
  participant Generator as Lesson generator
  participant Reviewer as Exercise reviewer

  Learner->>WebApp: Open app and sign in
  WebApp->>Cognito: Authenticate
  Cognito-->>WebApp: Authenticated session
  WebApp->>API: Resolve session and load onboarding state
  API-->>WebApp: Onboarding state

  Learner->>WebApp: Complete onboarding inputs
  WebApp->>API: Save languages, goals, profile, and preferences
  API-->>WebApp: Saved

  Learner->>WebApp: Choose Beginner path or Diagnostic path
  alt Beginner path
    WebApp->>API: Skip initial diagnostic
  else Diagnostic path
    WebApp->>API: Start initial diagnostic
    API->>Planner: Score diagnostic evidence
    Planner-->>API: Updated competency profile
  end

  API->>Planner: Build learning priorities and learning plan
  Planner-->>API: First module
  API->>Generator: Generate first lesson from module
  Generator-->>API: Lesson
  API-->>WebApp: Show lesson

  Learner->>WebApp: Answer lesson activities
  WebApp->>API: Submit responses
  API->>Reviewer: Review responses and create report
  Reviewer-->>API: Lesson report and feedback
  API->>Planner: Update competency profile and module progress
  Planner-->>API: Next module or updated outline
  API-->>WebApp: Show lesson report and next step

  loop Continue learning
    Learner->>WebApp: Start next lesson
    WebApp->>API: Request next lesson
    API->>Generator: Generate lesson from active module
    Generator-->>API: Lesson
    API-->>WebApp: Show lesson
  end
```
