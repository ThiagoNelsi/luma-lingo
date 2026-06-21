# ADR 0005: Process recorded profile introductions in API memory

Status: Accepted

## Context

The onboarding flow asks eligible learners for a short recorded introduction.
The app transcribes the recording and extracts only explicitly stated profile
details: job or field, interests, daily routine, study context, and other useful
facts. It must not retain raw audio or infer constrained onboarding choices.

The development environment has no durable job queue or private temporary
object storage. Adding those services now would increase cost and expand the
privacy and operational surface before expected load requires them.

## Decision

The web app records at most 90 seconds of audio in the learner's `Instruction
language`. It explains the recording's use and non-retention before requesting
microphone permission, lets the learner listen or record again, and offers a
manual path. Learners under 13 always use the manual path.

The API accepts one multipart audio file of at most 12 MiB. It validates the
declared size, MIME type, and browser-reported duration before accepting the
submission. The service then:

1. Marks the profile introduction as `pending`.
2. Schedules processing in the API process and returns `202 Accepted`.
3. Sends the in-memory audio to Gemini for transcription.
4. Sends the transcript to Gemini for structured extraction.
5. Persists only status, attempt metadata, errors, and extracted profile fields.
6. Overwrites the audio buffer after completion or failure.

Processing retries at most three times with a short exponential delay. On API
startup, the service marks interrupted `pending` and `processing` records as
failed because their audio is no longer available.

Gemini-specific behavior stays behind transcription and extraction provider
interfaces. The development default is `gemini-3.5-flash`, configured through
`GEMINI_API_KEY` and `GEMINI_MODEL`.

## Consequences

### Positive

- The implementation does not persist raw audio or transcripts.
- The HTTP request returns without waiting for transcription and extraction.
- Provider interfaces keep application behavior independent from Gemini.
- The current design adds no queue or object-storage infrastructure.

### Trade-offs

- A process restart loses any recording that is still being processed.
- Work runs in the API process and competes with HTTP traffic for memory and
  capacity.
- The duration check trusts browser metadata rather than decoding the media.
- In-process scheduling doesn't provide durable backpressure or job recovery.
- Real learner recordings require production-appropriate provider data terms;
  the current free-tier setup is limited to synthetic development data.

### Guidance

- Do not log audio, transcripts, extracted profile content, or provider prompts.
- Do not use real learner recordings with development free-tier data terms.
- Keep new transcription and extraction providers behind the existing
  interfaces.
- Move processing to a durable queue and encrypted temporary storage before
  traffic or reliability requirements outgrow in-process work.
- Verify media duration on the server when abuse or duration-based billing risk
  justifies a media-processing dependency.
