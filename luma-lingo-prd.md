## Problem Statement

Language learners need a way to study a target language in a way that feels relevant to their life, adapts to their progress, and keeps improving from one lesson to the next. Existing generic learning experiences often do not use the learner's context well enough, do not react strongly enough to mistakes, and do not provide a clear loop from lesson performance to the next lesson.

The user needs a personalized learning experience that can generate lessons quickly, focus on the learner's goal, emphasize the right skill mix, review prior mistakes, and keep motivation high through useful feedback and optional enrichment.

## Solution

Build an AI-powered language learning app that generates personalized lessons based on the user's `Instruction language`, `Target language`, `Level check`, `User profile`, `Goal`, `Lesson emphasis`, and prior performance.

The app should:

- collect a lightweight onboarding profile
- estimate the user's current level through a `Level check`
- generate a core lesson immediately
- evaluate responses and produce a `Lesson report`
- use `Top mistakes` and `Review points` to shape the next lesson
- optionally provide bonus content after the core lesson using public web sources
- keep the MVP focused on a narrow, reliable learning loop

## User Stories

1. As a learner, I want to choose my `Instruction language`, so that the app can explain lessons in a language I understand.
1. As a learner, I want to choose my `Target language`, so that the app can generate lessons for the language I want to learn.
1. As a learner, I want the onboarding to reflect the phrase "I speak [Instruction language], I want to learn [Target language]", so that the app feels simple and intuitive.
1. As a learner, I want to check my current level before studying, so that the app can calibrate the first lesson.
1. As a learner, I want to self-assess my level with friendly options like `Beginner (A1)` and `Intermediate (B1)`, so that I do not need to know CEFR labels to start.
1. As a learner, I want the app to offer `I don't know` when I am unsure of my level, so that I can continue without guessing.
1. As a learner, I want the app to optionally run a short diagnostic test after the self-check, so that the level estimate can be confirmed or adjusted.
1. As a learner, I want to describe my `User profile`, so that lessons can feel relevant to my daily life and interests.
1. As a learner, I want to record a short introduction about myself and my interests as the main profile setup path, so that I can provide personalization context naturally and honestly without writing a long profile.
1. As a learner, I want the app to extract `User profile` details from my introduction, so that lessons can use my context without extra manual work.
1. As a learner, I want a "try another way" option that opens closed profile blocks, so that I can complete onboarding even if I do not want to record.
1. As a learner, I want to review and edit the `User profile` extracted from my introduction, so that I can correct anything the app misunderstood.
1. As a learner, I want the app not to retain my raw introduction audio after profile extraction, so that the onboarding feels private and trustworthy.
1. As a learner, I want the app to explain how my recording will be used before asking for microphone permission, so that I understand the privacy trade-off.
1. As a learner, I want recorded introductions to be capped at 90 seconds, so that onboarding stays lightweight.
1. As a learner, I want to record my introduction in my `Instruction language`, so that I can describe myself naturally without turning profile setup into speaking practice.
1. As a learner under 13, I want to use closed profile blocks instead of recorded introductions, so that onboarding avoids collecting voice recordings from younger learners.
1. As a learner, I want to review and edit my onboarding summary before the first lesson is generated, so that the first lesson uses correct context.
1. As a learner, I want to see a short lesson-generation screen after confirming onboarding, so that I understand the app is building a personalized first lesson.
1. As a learner, I want to provide my `Job / field`, so that lessons can include workplace vocabulary when useful.
1. As a learner, I want to provide my `Interests`, so that lessons can include topics that keep me engaged.
1. As a learner, I want to provide my `Daily routine`, so that lessons can use situations I actually encounter.
1. As a learner, I want to optionally provide `Study context`, so that the app can use extra detail when I want to share it.
1. As a learner, I want to provide `Goal`, so that the app can focus on the kind of progress I want to make.
1. As a learner, I want to select one primary goal, so that the app has a clear main learning direction.
1. As a learner, I want to optionally select up to two additional goals, so that the app can blend a small number of learning intents without making onboarding heavy.
1. As a learner, I want to choose `Everyday conversation` as a goal, so that I can practice practical communication.
1. As a learner, I want to choose `Work` as a goal, so that I can practice vocabulary and situations related to my job.
1. As a learner, I want to choose `Travel` as a goal, so that I can prepare for common travel situations.
1. As a learner, I want to choose `Exam prep` as a goal, so that I can study toward a test-oriented objective.
1. As a learner, I want to choose a `CEFR level` as a goal, so that I can study toward a defined proficiency level.
1. As a learner, I want the CEFR goal to be limited to `A1`, `A2`, `B1`, and `B2`, so that the MVP stays focused on beginners and intermediate learners.
1. As a learner, I want to choose `Lesson emphasis`, so that lessons can weight reading, writing, and listening according to how I prefer to study.
1. As a learner, I want `Lesson emphasis` to be multi-select, so that I can combine more than one mode in a lesson.
1. As a learner, I want `Speaking` excluded from the MVP, so that the experience stays focused on modes the product can support reliably.
1. As a learner, I want to choose `Reading`, so that the lesson can include more text and comprehension work.
1. As a learner, I want to choose `Writing`, so that the lesson can include productive written practice.
1. As a learner, I want to choose `Listening`, so that the lesson can include audio or audio-like comprehension practice.
1. As a learner, I want to choose `Study pace`, so that the app can default the lesson rhythm to a relaxed or accelerated mode.
1. As a learner, I want `Study pace` to be optional, so that onboarding stays lightweight.
1. As a learner, I want the app to start with one default `Lesson length`, so that I do not need to tune lesson size before I begin.
1. As a learner, I want the app to ask me after the first lesson whether it felt too long, about right, or too short, so that future lessons can fit my preferred pace better.
1. As a learner, I want the app to shorten future lessons if I say the first one was too long, so that the experience adapts quickly.
1. As a learner, I want lessons to appear as a guided activity stack, so that I can move through structured practice without managing an open-ended chat.
1. As a learner, I want the app to generate the next lesson from my previous `Lesson report`, so that my learning path keeps improving.
1. As a learner, I want the app to analyze my answers and create a `Lesson report`, so that I can see how I did.
1. As a learner, I want the `Lesson report` to show strengths, so that I can understand what I am doing well.
1. As a learner, I want the `Lesson report` to show points for improvement, so that I can see where to focus next.
1. As a learner, I want the `Lesson report` to explain how those points will be addressed in the next lesson, so that I can trust the learning loop.
1. As a learner, I want the `Lesson report` to invite me to continue, so that the app encourages me to keep studying.
1. As a learner, I want error feedback to feel calm and tutor-like, so that mistakes feel useful rather than punitive.
1. As a learner, I want the home screen to focus on a clear primary action, so that I can continue or start the next lesson without navigating a dense dashboard.
1. As a learner, I want to choose a dark theme, so that the app is comfortable in low-light contexts.
1. As a learner, I want the app to prioritize `Top mistakes` from my last lesson, so that the next lesson focuses on what blocks me most.
1. As a learner, I want frequent mistakes to reappear in the next lesson, so that the app reinforces difficult points.
1. As a learner, I want rare mistakes to be used only as light reference, so that the lesson does not become cluttered.
1. As a learner, I want mistakes seen two times or more to get high priority, so that recurring gaps are not ignored.
1. As a learner, I want the app not to repeat everything, so that the lesson stays efficient and focused.
1. As a learner, I want `Review points` from older lessons to appear occasionally, so that I retain older material over time.
1. As a learner, I want `Review points` to be lightweight, so that they support the main lesson without taking it over.
1. As a learner, I want the app to bring back one or two review points about every three lessons, so that review happens in a controlled cadence.
1. As a learner, I want the app to use a light lesson contract rather than a rigid template, so that lessons can be personalized without feeling repetitive.
1. As a learner, I want the app to always consider my goal, profile, emphasis, top mistakes, review points, and lesson length, so that each lesson feels coherent.
1. As a learner, I want the app to adapt activities and wording freely, so that the content feels natural and contextual.
1. As a learner, I want a `Lesson generator` agent to create my core lesson, so that lesson creation is specialized.
1. As a learner, I want a `Validator` agent to check the lesson, so that the content stays consistent, level-appropriate, and policy-aligned.
1. As a learner, I want an `Exercise reviewer` agent to correct my answers, so that I get useful feedback after I practice.
1. As a learner, I want an `External content curator` agent to optionally find external material, so that the app can enrich lessons when relevant.
1. As a learner, I want the core lesson to work even when no external content is found, so that progress does not depend on external availability.
1. As a learner, I want optional `Bonus content` after the core lesson, so that I can go deeper when it makes sense.
1. As a learner, I want bonus content to use public web sources, so that the app can show real-world material.
1. As a learner, I want music content to appear as Spotify links when available, so that I can access audio content easily.
1. As a learner, I want video content to be embeddable from YouTube when appropriate, so that I can consume listening material without leaving the experience.
1. As a learner, I want optional bonus exercises after external content, so that I can practice from the material I just consumed.
1. As a learner, I want the next lesson to be available immediately after finishing the current one or later, so that I can continue when I am ready.
1. As a learner, I want the app to encourage me to come back without forcing immediate continuation, so that the experience feels flexible.
1. As a learner, I want the app to stay focused on beginners and intermediate learners, so that the content matches the intended audience.
1. As a learner, I want the app to avoid speaking practice in the MVP, so that the learning modes stay within what the product can support well.
1. As a learner, I want the app to avoid social features and marketplaces in the MVP, so that the product stays simple and focused.
1. As a learner, I want the app to avoid streak pressure in the MVP, so that the experience stays learning-first rather than gamification-first.

## Implementation Decisions

- The onboarding flow will place the `Level check` near the end of initial onboarding so the optional diagnostic sub-flow does not interrupt the earliest setup steps.
- The onboarding flow order will be: language entry; `Learner age range`, `Display name`, and `Goal`; recorded introduction with asynchronous `User profile` extraction; `Lesson emphasis` with `Study pace`; `Level check`; extracted-profile review and missing-field completion; review summary; then first lesson generation.
- The `Level check` will use friendly labels such as `Beginner (A1)`, `Beginner plus (A2)`, `Intermediate (B1)`, and `Upper intermediate (B2)`.
- The `Level check` will also allow `I don't know`.
- A short diagnostic test may optionally follow the self-assessment to confirm or adjust the level estimate.
- The onboarding flow will collect `Instruction language` and `Target language` only for language entry.
- `Goal` will use fixed options, with one primary goal required and up to two optional goals.
- `CEFR level` will be a selectable goal with explicit level choices from `A1` through `B2`.
- `Lesson emphasis` will be a multi-select field limited to `Reading`, `Writing`, and `Listening`.
- `Speaking` will be excluded from the MVP.
- `Study pace` will exist as a lightweight onboarding option with relaxed and accelerated modes.
- The app will make a short recorded introduction the primary `User profile` input path.
- The app will offer closed profile blocks through an alternate "try another way" path for learners who do not want to record.
- The app will let learners review and edit the `User profile` extracted from a recorded introduction.
- Recorded-introduction processing will run asynchronously so the learner can continue through `Lesson emphasis`, `Study pace`, and `Level check` while extraction completes.
- After `Level check`, the app will show the extracted `User profile` and request any required details that were not recovered before the final onboarding review.
- `Job / field` and `Interests` will be required profile details. `Daily routine`, `Study context`, and `Other` will be optional, while the interface will encourage `Daily routine` because it improves personalization.
- Recorded introductions may populate only explicitly stated `Job / field`, `Interests`, `Daily routine`, `Study context`, and `Other`; they must not infer `Learner age range`, `Goal`, `Lesson emphasis`, `Study pace`, or `Display name`.
- The app will not retain raw recorded introduction audio after profile extraction.
- The app will explain recording use and non-retention before requesting microphone permission.
- Recorded introductions will have a 90-second maximum and should allow re-recording before submission.
- Recorded introductions will be made in the learner's `Instruction language`.
- The onboarding flow will collect `Learner age range` before the `User profile` input step.
- Learners under 13 will use closed profile blocks instead of recorded introductions.
- The onboarding review summary will show the learner's selected language entry, goal, profile, lesson preferences, and level before first lesson generation.
- The onboarding review summary will allow editing individual items before first lesson generation.
- After the onboarding review summary is confirmed, the app will show a short generation screen while preparing the first lesson.
- The recorded introduction is an onboarding input method, not speaking practice.
- The app will begin with one default `Lesson length` and adjust after user feedback from the first lesson.
- Lessons will use a guided activity stack rather than an open-ended chat interface.
- Error feedback should use calm tutor language and avoid punitive wording.
- `Lesson report` will have an internal version for the AI and a friendly user-facing version.
- The user-facing report will include strengths, improvement points, the next-lesson plan, and a call to continue.
- The post-onboarding home screen will prioritize a primary call to action for continuing or starting the next lesson.
- The MVP UI will be mobile-first and responsive to larger screens without introducing a separate complex desktop layout.
- The MVP will use design tokens for core color, spacing, and radius values so the visual identity can evolve without broad UI rewrites.
- The MVP will support a learner-selectable dark theme.
- Initial UI components should include an onboarding shell, progress header, choice card, primary and secondary buttons, lesson activity card, and report section.
- `Top mistakes` from the latest lesson report will be the main driver for the next lesson.
- `Review points` from older lessons will appear lightly on a cadence rather than continuously.
- The next lesson will mix recent mistakes and older review points, with recent mistakes taking priority.
- The lesson generator will follow a light contract with required inputs rather than a rigid output template.
- The core lesson will be independent from optional bonus content.
- Bonus content will be post-lesson and optional.
- External content will be sourced from public web sources.
- Music content will be linked through Spotify when available.
- Video content will be embedded through YouTube when appropriate.
- Agent responsibilities will be split into generator, validator, exercise reviewer, and optional external content curator.
- The validator should remain lightweight in the MVP and focus on level alignment, consistency, and policy fit.
- The external content curator should remain optional in the MVP.
- The app should support creating the next lesson immediately after the current lesson or at a later time.

## Testing Decisions

- Good tests should verify external behavior only, not implementation details.
- The onboarding flow should be tested to ensure `Level check` collects a self-assessed level first and can optionally trigger a short diagnostic test.
- The onboarding flow should be tested to ensure onboarding follows the intended step order from language entry through first lesson generation.
- The onboarding flow should be tested to ensure it collects `Instruction language`, `Target language`, `Goal`, `Lesson emphasis`, and optional `Study pace` correctly.
- The onboarding flow should be tested to ensure a learner can provide `User profile` context through the primary recorded-introduction path or alternate closed profile blocks.
- The onboarding flow should be tested to ensure learners can review and edit the `User profile` extracted from a recorded introduction.
- The onboarding flow should be tested to ensure profile extraction can continue asynchronously through later preference and level steps, then resolves before final onboarding review.
- The onboarding flow should be tested to ensure missing required `Job / field` and `Interests` details are collected through closed inputs while optional profile details remain optional.
- The onboarding flow should be tested to ensure raw recorded introduction audio is not retained after profile extraction.
- The onboarding flow should be tested to ensure recording use and non-retention are explained before microphone permission is requested.
- The onboarding flow should be tested to ensure recorded introductions are capped at 90 seconds and can be re-recorded before submission.
- The onboarding flow should be tested to ensure recorded introductions use the learner's `Instruction language`.
- The onboarding flow should be tested to ensure `Learner age range` is collected before `User profile` input.
- The onboarding flow should be tested to ensure learners under 13 use closed profile blocks instead of recorded introductions.
- The onboarding flow should be tested to ensure learners can review and edit individual summary items before first lesson generation.
- The onboarding flow should be tested to ensure a short generation screen appears after onboarding is confirmed and before the first lesson is shown.
- The lesson UI should be tested to ensure lessons render as a guided activity stack.
- The lesson generation flow should be tested to ensure it consumes `Goal`, `User profile`, `Lesson emphasis`, `Top mistakes`, `Review points`, and `Lesson length`.
- The lesson report flow should be tested to ensure strengths, improvement points, and next-lesson guidance are produced.
- The home screen should be tested to ensure the primary lesson call to action is available after onboarding.
- The UI should be tested to ensure mobile-first layouts remain usable on larger responsive viewports.
- The UI should be tested to ensure light and dark themes are available and preserve readable contrast.
- The feedback loop should be tested to ensure `Top mistakes` influence the next lesson.
- The review loop should be tested to ensure older `Review points` return occasionally without displacing the main focus.
- The content-source flow should be tested to ensure bonus content is optional and does not block the core lesson.
- The content-source flow should be tested to ensure Spotify links and YouTube embeds are used when appropriate.
- The validator should be tested to ensure it rejects or flags lessons that are misaligned with the selected level or policy.
- The exercise reviewer should be tested to ensure incorrect answers produce meaningful feedback and report output.
- Similar prior art in the repo is limited because the repository currently contains mainly glossary and ADR documentation, so the first tests will likely be behavior-level tests added alongside the app implementation.

## Out of Scope

- Speaking practice in the MVP.
- Marketplace features for third-party content.
- Social features.
- Streak mechanics in the MVP.
- Manual teacher review as a product requirement.
- A rigid lesson template that limits personalization.
- Guaranteed external content for every lesson.
- Detailed success metrics, which are intentionally deferred.
- Advanced gamification beyond the core learning loop.
- Full music licensing strategy beyond public-source and platform-link assumptions.

## Further Notes

- The MVP should stay small and reliable: the core lesson must work even when optional external material is unavailable.
- The MVP should focus on beginners and intermediate learners, with CEFR goal support limited to `A1` through `B2`.
- The product's main loop is: onboarding -> core lesson -> review and feedback -> next lesson.
- The user experience should feel encouraging rather than punitive.
- The AI should focus on the few mistakes that most strongly block progress.
- `Review points` should be treated as a light retention mechanism, not a second primary curriculum.
- Success metrics are still open and should be defined before launch planning is finalized.
- The current repository already documents glossary terms and the agent-flow ADR; this PRD should be read as a synthesis of those decisions rather than a replacement.
