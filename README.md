# LumaLingo

LumaLingo is an AI-powered language learning product focused on personalized lessons, a lightweight onboarding flow, and a reliable feedback loop from one lesson to the next.

This repository currently contains the product glossary, the core PRD, and the architecture decision record for the lesson flow. It is a documentation-first workspace, so the source of truth for the product lives in the docs below.

## What the product is

The intended experience is:

1. Collect a small learner profile.
2. Estimate the learner's level with a friendly `Level check`.
3. Generate a core lesson tailored to the learner's `Goal`, `User profile`, `Lesson emphasis`, `Top mistakes`, `Review points`, and `Lesson length`.
4. Review the learner's answers and produce a `Lesson report`.
5. Use that report to shape the next lesson.
6. Optionally add bonus content from public web sources when it makes sense.

The MVP stays focused on beginners and intermediate learners, with speaking excluded from the first version.

## Current repo state

There is no application code in the repository yet. The current work is centered on aligning the product vocabulary and decisions before implementation begins.

## Key docs

- [Glossary and shared terms](CONTEXT.md)
- [Product brief and requirements](luma-lingo-prd.md)
- [ADR 0001: Agent Roles and Lesson Flow](docs/adr/0001-agent-roles-and-lesson-flow.md)
- [ADR 0002: Web MVP Stack and AWS Deployment](docs/adr/0002-web-mvp-stack-and-aws-deployment.md)