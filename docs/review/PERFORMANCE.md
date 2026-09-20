# Performance and technical correctness review

Reviewed 20 September 2026 against the existing React/Vite/TypeScript app. This completes the Nerd brief's profiling, prioritisation and first implementation. No PLAN.md existed when this review started; the coordinating review creates the project plan. Runtime changes are limited to `src/lib/decisionReuse.ts` and focused regression tests. Concurrent evidence, UI and optional AI work is owned elsewhere.

## Three prioritised findings

| Priority | Finding and measured evidence | Action and verification |
|---|---|---|
| 1 — correctness | Product-set keys joined with `\|` collide for valid imported IDs. `['a\|b','c']` and `['a','b\|c']` incorrectly match. A structurally valid fixture reproduced one unrelated candidate. | **Fixed.** JSON array encoding of sorted unique IDs retains boundaries. The same fixture now returns zero candidates; exact sets still match irrespective of order. |
| 2 — scale | Reuse retrieval scans the question list for every eligible draft. In a supported 4.78 MB mixed-topic fixture, 2,412 questions / 2,399 drafts took a median 41.8151 ms before and 38.1364 ms after the scoped change. | **Improved.** Build a lazy, invocation-local question Map, preserve first occurrence and candidate ordering, and still revalidate evidence. That run reduced time by 8.8%; small fixtures were effectively unchanged. Further validator scans remain. |
| 3 — delivery cost | The measured production entry chunk contains all application areas: 629,077 bytes minified / 198,099 gzip, zero dynamic imports. Follower-card entry therefore receives canvas dependencies too. This is a byte-cost finding, not a measured load-time failure. | **Documented, not implemented.** Test route-level splitting of creator canvas and follower view once the concurrent App integration settles. Gate on reduced initial follower bytes plus no delayed canvas regression; preserve fallback and error behaviour. |

The highest-priority correctness repair was implemented first. A concurrent integration guard also preserves the originating draft mode and copied AI metadata when reusing reviewed wording. The copied missing-evidence list is independent; approval state is not copied. Drafts that currently carry an AI evidence flag remain ineligible through the existing validator.

## Reproducible measurements

Run from the app directory; existing dependencies suffice:

```sh
./node_modules/.bin/tsx scripts/benchmarks/decision-reuse.ts --runtime
./node_modules/.bin/tsx scripts/benchmarks/core-profile.ts
node scripts/benchmarks/bundle-profile.mjs
```

The frozen retrieval baseline is in the benchmark script. It deliberately retains the former delimiter behaviour to reproduce the defect. Every ordinary before/after fixture asserts identical ordered candidate IDs; the delimiter fixture separately asserts the intended correction. Fixtures are constructed and validated outside timed loops, retain the ten-product catalogue, and remain below the existing 5 MB import limit. The script warms each implementation ten times, alternates order across eleven samples, and reports medians and p90 values. Batch size is calibrated and reported, not hidden.

Measurement host: Apple M4 Max, macOS arm64, Node v26.8.1. These are local Node microbenchmarks under ordinary development load. They do not measure browser rendering, React commits, network transfer, device storage I/O, mobile latency or memory pressure. Repeat on a representative device before claiming end-user speed. Small differences should be treated as noise; the largest fixture is a deliberate scale stress test, not the supplied case-file workload.

### Retrieval medians, milliseconds per invocation

| Questions / drafts | Topic mix | Before | After | Interpretation |
|---|---|---:|---:|---|
| 24 / 11 | All matching | 0.3214 | 0.3224 | No material change |
| 24 / 11 | Half matching | 0.1542 | 0.1550 | No material change |
| 132 / 119 | All matching | 3.3857 | 3.3724 | No material change |
| 132 / 119 | Half matching | 1.7169 | 1.7125 | No material change |
| 1,212 / 1,199 | All matching | 35.5683 | 35.0290 | 1.5% lower in this run |
| 1,212 / 1,199 | Half matching | 18.7830 | 18.0774 | 3.8% lower in this run |
| 2,412 / 2,399 | All matching | 76.4757 | 73.0062 | 4.5% lower in this run |
| 2,412 / 2,399 | Half matching | 41.8151 | 38.1364 | 8.8% lower in this run |

The index removes one nested lookup, not all work proportional to both drafts and questions. `validateDraft` still locates the source question and repeatedly checks product evidence; each eligible answer remains independently validated. No whole-pipeline linear-time claim is made.

Raw measurements: [retrieval comparison](decision-reuse-benchmark.json), [core profile](core-profile.json), [bundle profile](bundle-profile.json).

### Core profile context

| Operation | Supplied seed, 12 questions / 0 drafts | Stress fixture, 2,412 questions / 2,399 drafts |
|---|---:|---:|
| Group all questions | 0.0043 ms | 0.4587 ms |
| Draft one answer | 0.0075 ms | 0.0057 ms |
| Validate one early-list answer | 0.0287 ms | 0.0264 ms |
| Retrieve reusable answers | 0.0080 ms | 72.3931 ms |
| Validate workspace structure | 0.0096 ms | 2.2152 ms |
| Serialise workspace | 0.0346 ms | 12.1960 ms |
| Parse and validate backup | 0.0564 ms | 13.7407 ms |
| Find questions without a draft | 0.0003 ms | 5.6750 ms |

Single-answer validation uses an early-list question; it must not be extrapolated to late-list lookup cost. Complete retrieval validates candidates throughout the question array. The core profile and paired comparison are separate runs, so their absolute timings differ.

Whole-workspace serialisation and parsing are the next persistence measurement targets: the current save path performs these operations on workspace changes. Debouncing or moving work off the main thread would need explicit durability and crash-recovery acceptance criteria. This review does not weaken save guarantees merely to improve a microbenchmark.

## Validation and limits

Sixteen targeted tests passed: nine existing decision tests plus seven new regression tests covering delimiter collisions, exact-set equivalence, duplicate-ID first-match semantics, fresh question/evidence changes, order/reference preservation, AI provenance copying and AI evidence-flag rejection.

The bundle profiler builds in memory with `write:false`; it leaves the served `dist` directory unchanged. The reported module attribution is pre-minification `renderedLength`, while final byte/gzip totals apply to the whole chunk. These quantities must not be mixed. Bundle size is a dated snapshot while another task adds optional AI; the final coordinated build can differ.

Browser visual, accessibility, interaction and whole-system tests are reported by the coordinating review. This report makes no claim that a Node microbenchmark proves smooth dragging or fast interaction on a phone.
