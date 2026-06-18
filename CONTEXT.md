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
Relevant personal context for lesson personalization, captured through fixed blocks:
- Display name
- Learner age range
- Job / field
- Interests
- Daily routine
- Study context (optional)
- Other

## Display name
Name the app uses to address the learner in the product experience. It is not a login identifier or a public username.

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
- Exam prep
- CEFR level
- Other

Goal policy:
- 1 primary goal is required
- Up to 2 additional goals are optional
- Optional goals can be chosen from:
	- Everyday conversation
	- Work
	- Travel

When `CEFR level` is selected, the user must choose one level:
- A1
- A2
- B1
- B2

## Level check
Onboarding step used to estimate the user's current level.

## Level check policy
Ask the user to self-assess first with these friendly options:
- Beginner (A1)
- Beginner plus (A2)
- Intermediate (B1)
- Upper intermediate (B2)
- I don't know

Then optionally run a short diagnostic test to confirm or adjust the estimate.

## Study pace
Study cadence preference, collected in same onboarding step as Goal. For the MVP, limited to two modes: relaxed or accelerated.

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
`Top mistakes` from the previous lesson should be used as the main input for the next lesson.

## Review points policy
The next lesson should also bring back selected review points from older lessons from time to time.
Review points should be lightweight and should not override the main focus from the latest report.
Suggested cadence: 1 to 2 review points every 3 lessons.

## Mistake priority policy
- Most frequent mistakes should reappear in the next lesson
- Rare mistakes should be used only as light reference
- If a mistake appears 2 times or more, it gets high priority
- The AI should not repeat everything, only what blocks progress the most

## Lesson generator guidelines
The lesson generator should follow a light contract, not a rigid template.
It should always consider:
- Goal
- User profile
- Lesson emphasis
- Top mistakes
- Review points
- Lesson length

It can adapt the activities and wording freely as long as the lesson stays personalized and consistent.

## Agent roles
### Lesson generator
Agent responsible for creating the core lesson.

### Validator
Agent responsible for checking consistency, level, and policy fit.

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
