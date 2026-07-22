# Diagnostic completion batch benchmark

Recorded on 2026-07-22 while addressing the transaction timeout observed when
the initial diagnostic published learner evidence and state.

## Result

| Metric                               | Sequential upserts | Batch upserts |  Change |
| ------------------------------------ | -----------------: | ------------: | ------: |
| Median transaction wall time         |       10,404.38 ms |   2,296.37 ms | -77.93% |
| Median Prisma-reported database time |          10,290 ms |      2,267 ms | -77.97% |
| Typical SQL statements               |                 71 |             8 | -88.73% |
| Median speedup                       |                  — |             — |   4.53x |

The batch implementation kept the two append-only evidence inserts and
replaced per-evidence state upserts with one competency-state statement and one
concept-state statement. The transaction timeout was raised from Prisma's
5-second default to 15 seconds before measuring the sequential implementation;
the batch itself completes well below either limit in these samples.

## Protocol

- Database: the configured pooled Neon development endpoint.
- Five independent runs per implementation.
- Each run created a temporary learner and learning track, completed one
  diagnostic attempt, then removed only the benchmark-owned synthetic data.
- Each attempt contained 16 published diagnostic items selected in stable key
  order, producing 16 competency evidence rows and 49 concept evidence rows.
- Timing starts immediately before `completeAttempt` and stops immediately
  after it resolves. Scenario setup, semantic validation, and cleanup are not
  timed.
- SQL statement count comes from Prisma query events and includes transaction
  control statements. It is a proxy for database round trips, not a Neon
  billing metric.
- No catalog identifiers, descriptors, relationships, prompts, or answers are
  present in the recorded output.

Run the benchmark with:

```bash
pnpm --filter @luma-lingo/api benchmark:diagnostic-completion
```

The command is development-only. Cleanup briefly disables the append-only
delete trigger inside a transaction and removes only synthetic users carrying
the benchmark email prefix; do not point it at a production database.

Raw samples and calculated values are stored in
`diagnostic-completion-batch-benchmark.json` beside this document.

The sequential samples are a historical baseline from revision `e56c4e0` with
only the transaction timeout changed to 15 seconds. The command above now runs
the batch implementation; it does not reconstruct the old sequential loops.

## Semantic validation

The final benchmark also queried the synthetic learning track after completion:

- 16 append-only competency evidence rows became 6 sparse competency states,
  whose `evidenceCount` values summed to 16.
- 49 append-only concept evidence rows became 34 capability-specific concept
  states, whose direct and inferred counts summed to 49.
- The evidence history therefore remained intact while state writes were
  consolidated.
- A real `ON CONFLICT` check then applied inference-only evidence to an existing
  directly mastered concept state. Its mastery, confidence, and direct count
  remained unchanged while its inferred count increased by one.

## Interpretation and limitations

The statement-count reduction is deterministic for this scenario. Wall time is
not: Neon load, network latency, connection reuse, and compute state can change
between runs. The historical baseline and final batch runs were not interleaved
and did not discard explicit warm-up samples, so the latency comparison may
include compute or connection warming bias. These figures are development
measurements with five samples, not a production load test. For a public
write-up, lead with the deterministic SQL reduction, and report the latency
protocol and raw range rather than presenting 77.93% as a universal guarantee.
