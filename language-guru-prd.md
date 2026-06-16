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
2. As a learner, I want to choose my `Target language`, so that the app can generate lessons for the language I want to learn.
3. As a learner, I want the onboarding to reflect the phrase "I speak [Instruction language], I want to learn [Target language]", so that the app feels simple and intuitive.
4. As a learner, I want to check my current level before studying, so that the app can calibrate the first lesson.
5. As a learner, I want to self-assess my level with friendly options like `Beginner (A1)` and `Intermediate (B1)`, so that I do not need to know CEFR labels to start.
6. As a learner, I want the app to offer `I don't know` when I am unsure of my level, so that I can continue without guessing.
7. As a learner, I want the app to optionally run a short diagnostic test after the self-check, so that the level estimate can be confirmed or adjusted.
8. As a learner, I want to describe my `User profile`, so that lessons can feel relevant to my daily life and interests.
9. As a learner, I want to provide my `Job / field`, so that lessons can include workplace vocabulary when useful.
10. As a learner, I want to provide my `Interests`, so that lessons can include topics that keep me engaged.
11. As a learner, I want to provide my `Daily routine`, so that lessons can use situations I actually encounter.
12. As a learner, I want to optionally provide `Study context`, so that the app can use extra detail when I want to share it.
13. As a learner, I want to provide `Goal`, so that the app can focus on the kind of progress I want to make.
14. As a learner, I want to select one primary goal, so that the app has a clear main learning direction.
15. As a learner, I want to optionally select up to two additional goals, so that the app can blend a small number of learning intents without making onboarding heavy.
16. As a learner, I want to choose `Everyday conversation` as a goal, so that I can practice practical communication.
17. As a learner, I want to choose `Work` as a goal, so that I can practice vocabulary and situations related to my job.
18. As a learner, I want to choose `Travel` as a goal, so that I can prepare for common travel situations.
19. As a learner, I want to choose `Exam prep` as a goal, so that I can study toward a test-oriented objective.
20. As a learner, I want to choose a `CEFR level` as a goal, so that I can study toward a defined proficiency level.
21. As a learner, I want the CEFR goal to be limited to `A1`, `A2`, `B1`, and `B2`, so that the MVP stays focused on beginners and intermediate learners.
22. As a learner, I want to choose `Lesson emphasis`, so that lessons can weight reading, writing, and listening according to how I prefer to study.
23. As a learner, I want `Lesson emphasis` to be multi-select, so that I can combine more than one mode in a lesson.
24. As a learner, I want `Speaking` excluded from the MVP, so that the experience stays focused on modes the product can support reliably.
25. As a learner, I want to choose `Reading`, so that the lesson can include more text and comprehension work.
26. As a learner, I want to choose `Writing`, so that the lesson can include productive written practice.
27. As a learner, I want to choose `Listening`, so that the lesson can include audio or audio-like comprehension practice.
28. As a learner, I want to choose `Study pace`, so that the app can default the lesson rhythm to a relaxed or accelerated mode.
29. As a learner, I want `Study pace` to be optional, so that onboarding stays lightweight.
30. As a learner, I want the app to start with one default `Lesson length`, so that I do not need to tune lesson size before I begin.
31. As a learner, I want the app to ask me after the first lesson whether it felt too long, about right, or too short, so that future lessons can fit my preferred pace better.
32. As a learner, I want the app to shorten future lessons if I say the first one was too long, so that the experience adapts quickly.
33. As a learner, I want the app to generate the next lesson from my previous `Lesson report`, so that my learning path keeps improving.
34. As a learner, I want the app to analyze my answers and create a `Lesson report`, so that I can see how I did.
35. As a learner, I want the `Lesson report` to show strengths, so that I can understand what I am doing well.
36. As a learner, I want the `Lesson report` to show points for improvement, so that I can see where to focus next.
37. As a learner, I want the `Lesson report` to explain how those points will be addressed in the next lesson, so that I can trust the learning loop.
38. As a learner, I want the `Lesson report` to invite me to continue, so that the app encourages me to keep studying.
39. As a learner, I want the app to prioritize `Top mistakes` from my last lesson, so that the next lesson focuses on what blocks me most.
40. As a learner, I want frequent mistakes to reappear in the next lesson, so that the app reinforces difficult points.
41. As a learner, I want rare mistakes to be used only as light reference, so that the lesson does not become cluttered.
42. As a learner, I want mistakes seen two times or more to get high priority, so that recurring gaps are not ignored.
43. As a learner, I want the app not to repeat everything, so that the lesson stays efficient and focused.
44. As a learner, I want `Review points` from older lessons to appear occasionally, so that I retain older material over time.
45. As a learner, I want `Review points` to be lightweight, so that they support the main lesson without taking it over.
46. As a learner, I want the app to bring back one or two review points about every three lessons, so that review happens in a controlled cadence.
47. As a learner, I want the app to use a light lesson contract rather than a rigid template, so that lessons can be personalized without feeling repetitive.
48. As a learner, I want the app to always consider my goal, profile, emphasis, top mistakes, review points, and lesson length, so that each lesson feels coherent.
49. As a learner, I want the app to adapt activities and wording freely, so that the content feels natural and contextual.
50. As a learner, I want a `Lesson generator` agent to create my core lesson, so that lesson creation is specialized.
51. As a learner, I want a `Validator` agent to check the lesson, so that the content stays consistent, level-appropriate, and policy-aligned.
52. As a learner, I want an `Exercise reviewer` agent to correct my answers, so that I get useful feedback after I practice.
53. As a learner, I want an `External content curator` agent to optionally find external material, so that the app can enrich lessons when relevant.
54. As a learner, I want the core lesson to work even when no external content is found, so that progress does not depend on external availability.
55. As a learner, I want optional `Bonus content` after the core lesson, so that I can go deeper when it makes sense.
56. As a learner, I want bonus content to use public web sources, so that the app can show real-world material.
57. As a learner, I want music content to appear as Spotify links when available, so that I can access audio content easily.
58. As a learner, I want video content to be embeddable from YouTube when appropriate, so that I can consume listening material without leaving the experience.
59. As a learner, I want optional bonus exercises after external content, so that I can practice from the material I just consumed.
60. As a learner, I want the next lesson to be available immediately after finishing the current one or later, so that I can continue when I am ready.
61. As a learner, I want the app to encourage me to come back without forcing immediate continuation, so that the experience feels flexible.
62. As a learner, I want the app to stay focused on beginners and intermediate learners, so that the content matches the intended audience.
63. As a learner, I want the app to avoid speaking practice in the MVP, so that the learning modes stay within what the product can support well.
64. As a learner, I want the app to avoid social features and marketplaces in the MVP, so that the product stays simple and focused.
65. As a learner, I want the app to avoid streak pressure in the MVP, so that the experience stays learning-first rather than gamification-first.
## Implementation Decisions

- The onboarding flow will begin with a `Level check`.
- The `Level check` will use friendly labels such as `Beginner (A1)`, `Beginner plus (A2)`, `Intermediate (B1)`, and `Upper intermediate (B2)`.
- The `Level check` will also allow `I don't know`.
- A short diagnostic test may optionally follow the self-assessment to confirm or adjust the level estimate.
- The onboarding flow will collect `Instruction language` and `Target language` only for language entry.
- `Goal` will use fixed options, with one primary goal required and up to two optional goals.
- `CEFR level` will be a selectable goal with explicit level choices from `A1` through `B2`.
- `Lesson emphasis` will be a multi-select field limited to `Reading`, `Writing`, and `Listening`.
- `Speaking` will be excluded from the MVP.
- `Study pace` will exist as a lightweight onboarding option with relaxed and accelerated modes.
- The app will begin with one default `Lesson length` and adjust after user feedback from the first lesson.
- `Lesson report` will have an internal version for the AI and a friendly user-facing version.
- The user-facing report will include strengths, improvement points, the next-lesson plan, and a call to continue.
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
- The onboarding flow should be tested to ensure it collects `Instruction language`, `Target language`, `Goal`, `Lesson emphasis`, and optional `Study pace` correctly.
- The lesson generation flow should be tested to ensure it consumes `Goal`, `User profile`, `Lesson emphasis`, `Top mistakes`, `Review points`, and `Lesson length`.
- The lesson report flow should be tested to ensure strengths, improvement points, and next-lesson guidance are produced.
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
