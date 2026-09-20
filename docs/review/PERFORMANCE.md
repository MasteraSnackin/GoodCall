# Performance and technical correctness review

Reviewed and rechecked on 20 September 2026 against the React/Vite/TypeScript app and the current [plan](../../PLAN.md). The original Nerd review implemented the product-set correction and invocation-local index in `src/lib/decisionReuse.ts`. The refresh reran the existing offline benchmarks; a subsequently authorised correctness repair updated purchase interpretation and validation. The final paired retrieval run below uses that repaired path. No benchmark script, served build or browser storage was changed by this lane.

## Three prioritised findings

| Priority | Finding and measured evidence | Action and verification |
|---|---|---|
| 1 — correctness | Product-set keys joined with `\|` collide for valid imported IDs. `['a\|b','c']` and `['a','b\|c']` incorrectly match. A structurally valid fixture reproduced one unrelated candidate. | **Fixed.** JSON array encoding of sorted unique IDs retains boundaries. The same fixture now returns zero candidates; exact sets still match irrespective of order. |
| 2 — scale | The former origin lookup scanned the question list for every eligible draft; validation still has separate scans. On final repaired code, the supported 4.78 MB mixed-topic fixture (2,412 questions / 2,399 drafts) took a median 130.7987 ms with the frozen retrieval baseline and 124.1090 ms with the current implementation. | **Index retained; speed benefit is limited.** The lazy invocation-local Map preserves first occurrence and candidate order. The largest mixed median was 5.1% lower, but p90 was worse; most other differences were negligible. The earlier 8.8% and 10.3% figures describe earlier snapshots. No reliable general speed improvement is established, and absolute retrieval cost rose after the validation repairs. |
| 3 — delivery cost | The 12:29 pre-repair entry snapshot contains all application areas: 659,514 bytes minified / 207,494 gzip, zero dynamic imports. Follower-card entry therefore receives canvas dependencies too. This is a dated byte-cost finding, not the final build size or a measured load-time failure. | **Documented, not implemented.** Test route-level splitting of creator canvas and follower view as a separate, measured change. Gate on reduced initial follower bytes plus no delayed canvas regression; preserve fallback and error behaviour. The final build is recorded by the coordinating lane. |

The highest-priority correctness repair was implemented first. A concurrent integration guard also preserves the originating draft mode and copied AI metadata when reusing reviewed wording. The copied missing-evidence list is independent; approval state is not copied. Drafts that currently carry an AI evidence flag remain ineligible through the existing validator.

## Reproducible measurements

Run from the app directory; existing dependencies suffice:

```sh
./node_modules/.bin/tsx scripts/benchmarks/decision-reuse.ts --runtime
./node_modules/.bin/tsx scripts/benchmarks/core-profile.ts
node scripts/benchmarks/bundle-profile.mjs
```

The frozen retrieval baseline is in the benchmark script. It deliberately retains the former delimiter behaviour to reproduce the defect. Both baseline and current retrieval call the current drafting and validation functions; the comparison isolates the retrieval change rather than replaying an old application build. Every ordinary before/after fixture asserts identical ordered candidate IDs; the delimiter fixture separately asserts the intended correction. Fixtures are constructed and validated outside timed loops, retain the ten-product catalogue, and remain below the existing 5 MB import limit. The script warms each implementation ten times, alternates order across eleven samples, and reports medians and p90 values. Batch size is calibrated and reported, not hidden.

Measurement host: Apple M4 Max, macOS arm64, Node v26.8.1. These are local Node microbenchmarks under ordinary development load. They do not measure browser rendering, React commits, network transfer, device storage I/O, mobile latency or memory pressure. Repeat on a representative device before claiming end-user speed. Small differences should be treated as noise; the largest fixture is a deliberate scale stress test, not the supplied case-file workload.

### Final retrieval medians, milliseconds per invocation

Final timestamp: 20 September 2026, 12:49:30 UTC, after the selection-verb, multiunit, arithmetic and negated-comparison corrections were frozen and independently rechecked. Command: `./node_modules/.bin/tsx scripts/benchmarks/decision-reuse.ts --runtime`. Ordinary ordered-output equivalence and the collision correction passed again.

| Questions / drafts | Topic mix | Before | After | Interpretation |
|---|---|---:|---:|---|
| 24 / 11 | All matching | 1.1085 | 1.0928 | No material change |
| 24 / 11 | Half matching | 0.5122 | 0.5169 | No material change |
| 132 / 119 | All matching | 11.8020 | 11.7127 | No material change |
| 132 / 119 | Half matching | 5.8839 | 5.8181 | No material change |
| 1,212 / 1,199 | All matching | 118.2852 | 117.1808 | No material change |
| 1,212 / 1,199 | Half matching | 59.3600 | 59.0118 | No material change |
| 2,412 / 2,399 | All matching | 240.5701 | 238.9676 | 0.7% lower; negligible |
| 2,412 / 2,399 | Half matching | 130.7987 | 124.1090 | 5.1% lower median; p90 worse |

The largest mixed fixture's p90 increased from 142.9098 to 153.4293 ms, so its median difference must not be presented as consistent latency improvement. Both sides use the same final validator. Across dated runs, absolute runtime medians rose substantially: the largest all-matching fixture was 71.8311 ms at 12:29 and 238.9676 ms after the correctness repairs. The validator now does additional purchase-role and arithmetic work; these snapshots are not a controlled causal attribution, but they rule out claiming a net application speed-up from this review. Do not weaken those checks to recover the earlier timings. Profile their repeated work before proposing another optimisation.

### Pre-repair retrieval snapshot

Recheck timestamp: 20 September 2026, 12:29 UTC. These measurements precede the subsequent purchase-context, persona-copy and modal repairs in this review. They remain a dated source snapshot, not final timings for those repairs. The original measurements remain available for comparison.

| Questions / drafts | Topic mix | Before | After | Interpretation |
|---|---|---:|---:|---|
| 24 / 11 | All matching | 0.3265 | 0.3325 | No material change |
| 24 / 11 | Half matching | 0.1566 | 0.1570 | No material change |
| 132 / 119 | All matching | 3.3610 | 3.3861 | No material change |
| 132 / 119 | Half matching | 1.7011 | 1.7114 | No material change |
| 1,212 / 1,199 | All matching | 34.9000 | 34.2131 | 2.0% lower in this run |
| 1,212 / 1,199 | Half matching | 18.2215 | 17.5157 | 3.9% lower in this run |
| 2,412 / 2,399 | All matching | 76.2577 | 71.8311 | 5.8% lower in this run |
| 2,412 / 2,399 | Half matching | 41.7824 | 37.4750 | 10.3% lower in this run |

The index removes one nested lookup, not all work proportional to both drafts and questions. `validateDraft` still locates the source question and repeatedly checks product evidence; each eligible answer remains independently validated. No whole-pipeline linear-time claim is made.

Final raw retrieval: [frozen repaired code](decision-reuse-final-2026-09-20.json). Earlier measurements remain unchanged: [12:29 retrieval](decision-reuse-recheck-2026-09-20.json), [12:46 intermediate retrieval before the expanded quantity guard](decision-reuse-intermediate-2026-09-20.json), [pre-repair core profile](core-profile-recheck-2026-09-20.json), [pre-repair bundle profile](bundle-profile-recheck-2026-09-20.json). Original measurements: [retrieval](decision-reuse-benchmark.json), [core](core-profile.json), [bundle](bundle-profile.json).

### Core profile context

These are the 12:29 pre-repair figures, retained for traceability. Core and bundle profiling were not repeated after the final correctness changes; this table is not a final-runtime claim.

| Operation | Supplied seed, 12 questions / 0 drafts | Stress fixture, 2,412 questions / 2,399 drafts |
|---|---:|---:|
| Group all questions | 0.0043 ms | 0.4575 ms |
| Draft one answer | 0.0074 ms | 0.0057 ms |
| Validate one early-list answer | 0.0296 ms | 0.0270 ms |
| Retrieve reusable answers | 0.0077 ms | 72.8861 ms |
| Validate workspace structure | 0.0095 ms | 2.2290 ms |
| Serialise workspace | 0.0349 ms | 12.2494 ms |
| Parse and validate backup | 0.0563 ms | 13.7842 ms |
| Find questions without a draft | 0.0003 ms | 4.3914 ms |

Single-answer validation uses an early-list question; it must not be extrapolated to late-list lookup cost. Complete retrieval validates candidates throughout the question array. The core profile and paired comparison are separate runs, so their absolute timings differ.

Whole-workspace serialisation and parsing are the next persistence measurement targets: the current save path performs these operations on workspace changes. Debouncing or moving work off the main thread would need explicit durability and crash-recovery acceptance criteria. This review does not weaken save guarantees merely to improve a microbenchmark.

## Gaps before making user-facing speed claims

- **Question-list work is not covered by a single retrieval timing.** `App.tsx` calls `findReusableAnswers` for each visible question that has no draft. The synthetic stress fixture gives almost every question a draft and times one retrieval. It does not measure a large unanswered queue against a large reviewed library. Add that workload and a production browser profile before proposing memoisation or shared validation context.
- **Save-path timings omit device writes.** At 4.76 MB, serialisation takes 12.2494 ms and parsing/validation takes 13.7842 ms in this run. `saveWorkspace` also checks structure, creates a byte-size Blob and writes recovery plus primary data. The table is not the total save cost. Long answer histories, quota pressure, actual browser storage and crash recovery need separate measurement.
- **Optional AI needs separate latency and quality evaluation.** The existing benchmarks do not time request-context construction, network requests, provider generation or post-response checks. They do not compare Claude with OpenAI or establish reliable generated advice. No provider request or credential handling was performed for this refresh.

The ten-product fixtures remain within the import limit but are synthetic and omit accumulated draft history. Repeated medians establish local behaviour of these fixtures, not statistical significance, a memory bound or an end-user service target. No further runtime optimisation is justified by this recheck alone.

## Validation and limits

The original implementation passed sixteen targeted tests: nine existing decision tests plus seven new regression tests covering delimiter collisions, exact-set equivalence, duplicate-ID first-match semantics, fresh question/evidence changes, order/reference preservation, AI provenance copying and AI evidence-flag rejection.

The bundle profiler builds in memory with `write:false`; it leaves the served `dist` directory unchanged. The reported module attribution is pre-minification `renderedLength`, while final byte/gzip totals apply to the whole chunk. These quantities must not be mixed. The recheck includes the provider-aware interface present at 12:29 UTC. Bundle size is a dated snapshot; later source changes require a new measurement.

Browser visual, accessibility, interaction and whole-system tests are reported by the coordinating review. This report makes no claim that a Node microbenchmark proves smooth dragging or fast interaction on a phone.

The documentation refresh reran the three benchmark commands above, then repeated only paired retrieval after the subsequent correctness changes. The 12:46 intermediate run is retained separately; 12:49 is the final frozen-source run. All completed successfully. Retrieval assertions confirmed ordinary ordered-output equivalence and rejection of the delimiter collision. The final repair also passed `./node_modules/.bin/tsx --test tests/purchaseContext.test.ts tests/engine.test.ts`: 44 tests, zero failures. Independent in-memory review confirmed the concrete bypasses were closed and affordable choices/neutral price evidence preserved. The full automated suite and normal production build belong to the coordinating testing lane and were not repeated here.

The coordinating testing lane reported 327 passing checks (190 Node and 137 DOM) plus a successful production build for the provider-switch runtime before the subsequent purchase-context, persona-copy and modal repairs. That is historical baseline evidence. Consult [TEST-REPORT.md](../../TEST-REPORT.md) for the final coordinated aggregate, separate from this lane's focused tests and benchmark executions.
