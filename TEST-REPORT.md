# GoodCall — review and test results

Reviewed 20 September 2026. Local app: http://127.0.0.1:4341/

## Current integrated review — 20 September 2026

The final combined run after the dialog-focus repair passed **288 automated tests**: **167 Node tests and 121 DOM tests across 17 Vitest files**. `npm run build` passed with Node.js 26.8.1 and npm 11.19.0. JavaScript is 655.93 kB minified / 206.41 kB gzip; CSS is 111.92 kB / 22.62 kB gzip. The JavaScript bundle advisory is non-blocking.

This review adds publication preflight and persistence guarantees, exact damaged-chat preservation, collision-safe reviewed-answer reuse, a measured retrieval index, mobile layout/contrast corrections and modal focus restoration. The final combined snapshot includes the concurrent 18-record case-evidence library, design copy and optional OpenAI proxy/draft/chat workflow.

Real integrated-browser inspection was completed at **1440 × 1000** and **390 × 844**. It exercised Fit, answer review, evidence search/reset, an empty result and Enter/Escape dialog exit. Phone introduction height fell from 345 px to 86 px; the graph viewport now fits below its controls. Focus returns to Case evidence after closing its dialog. Saved captures and the numbered journey are in [AUDIT.md](docs/review/AUDIT.md). The earlier browser-policy block below is historical and does not describe this session.

A separate read-only code review found no actionable issue in the scoped publication, recovery, reuse, CSS and modal cleanup changes. Automated failure tests use isolated fixtures; they did not deliberately corrupt the user's browser data.

A user-connected OpenAI session then attempted **one authorised live answer request** using `gpt-5.4-mini`. OpenAI rejected it with HTTP 429. The UI displayed a rate-limit/quota message, inserted no draft and overwrote no current answer. Testing stopped without retry or a second request. The app response does not distinguish rate limiting from unavailable quota. Successful live generation and answer quality remain unverified.

Physical microphone/speaker operation, real touch/dragging, a complete screen-reader audit, clipboard/download acceptance and participant usability remain separate checks. Tano and social accounts are not connected. The paired large-fixture reuse benchmark showed an 8.8% median reduction in one Node run; it does not establish end-user latency. See [PERFORMANCE.md](docs/review/PERFORMANCE.md).

[All nine task results](docs/review/TASK-RESULTS.md) · [Architecture](ARCHITECTURE.md) · [Usability checks](USABILITY-CHECKS.md)

## Historical initial GitHub release verification — 20 September 2026

The initial integrated release passed **212 automated tests**: 106 Node rule/storage tests and 106 simulated-interface tests across 14 Vitest files. The production build passed with Node.js 26.8.1 and npm 11.19.0. The local app returned HTTP 200.

This release includes the canvas navigation and keyboard fixes, reusable decisions, chat and voice controls, draft comparison/history/restoration, workspace backup/recovery, publication preview, local follower feedback and the six audience acceptance scenarios. The repository also includes the GoodCall pitch as PDF and editable PowerPoint.

The publication check matched the build task's final source snapshot before staging. The 77 published source, test and configuration files have SHA-256 digest `3f15113c9861dd7845f54a851d35004f09a62173172b599ed94bb0c2abf4ef38` (sorted relative paths, each followed by a NUL byte, file contents and a NUL byte). Editor state is excluded.

The build reports a non-blocking bundle-size advisory: the main JavaScript bundle is 594.67 kB (187.14 kB gzip). No performance benchmark or browser layout sign-off is claimed. Physical microphone/speaker operation, phone layout, real canvas dragging, downloads and clipboard behaviour remain manual acceptance checks; see [USABILITY-CHECKS.md](USABILITY-CHECKS.md).

The sections below are historical review snapshots. Their test counts, recommendations and limitations describe those earlier versions rather than the current release. Current feature behaviour and integration boundaries are documented in the README.

## Historical chat verification — 20 September 2026

The subsequent chat feature adds typed conversations, editable dictation, per-reply reading and opt-in spoken replies. Its 38 additional checks cover conversation routing, bounded context, source references, storage, speech lifecycle and the creator workflow. The final chat validation passed **116 scoped checks** (60 rule/storage tests and 56 simulated-interface tests) and the production build.

Concurrent reusable-decision work was being prepared in another task. Its pending tests were excluded from this chat release check; that task owns the final combined verification after its integration. The earlier review results below describe the pre-chat version.

At that historical checkpoint, microphone capture, audible playback and visual browser acceptance were unverified because of the browser policy block. Chat then used a local case-file assistant without a connected language model. The current review above supersedes the browser and integration status.

## Historical pre-chat verification

All **78 automated tests passed** in the final combined run: 39 rule, sharing, persona and command tests, plus 39 simulated-interface tests. The production build passed. The app and source PDF respond locally.

This establishes tested application behaviour. It does not establish visual layout, real pointer dragging, microphone capture, speaker playback or live account integration. Browser access was denied because the browser tool could not verify an administrator-enforced policy. No workaround was used.

The build raised a non-blocking bundle-size advisory; no performance benchmark was performed.

## Defects corrected during this review

| Finding | Corrected behaviour |
|---|---|
| “Cloud Cream costs £38, but I can only spend £30” could ignore the limit. | The £30 limit is enforced. Numeric “30 pounds” also works. An unparsed limit such as “my budget is thirty” asks for clarification. |
| Some unsupported product-use and clinical claims passed the bounded checks. | Reproduced medicine-combination, eye-area and child-use questions are held for evidence. Additional ingredient and clinical assertions are flagged. This remains a limited ruleset. |
| An explicit preference conflict could be ignored. | A follower who describes oily skin and dislikes rich creams receives a clarification hold for the dry/rich Cloud Cream record. This identifies a catalogue/preference conflict, not clinical unsuitability. |
| A notebook-to-answer connection could be visual only. | Connecting the card attaches its source and removes prior approval. Disconnecting removes that source and approval. Regeneration retains still-connected notebook evidence. |
| New cards of different types could occupy the same location. | New cards use a free position among neighbouring cards, leaving existing positions intact. The placement logic is tested; actual rendered overlap remains a browser check. |
| Glass Drop regeneration could retain an obsolete fixed price judgement. | Current product price and note drive the new draft. The wording repair landed with the concurrent persona work and is covered by a regression test. |

## Additional scenarios verified

- A supported answer can be drafted, reviewed, published and shared.
- Missing Barrier Cream information prevents approval even if its report entry is marked resolved.
- Product corrections invalidate earlier approval and require regeneration.
- A £39.50 correction remains £39.50 in the public answer and product display.
- Generated share payloads omit original private question records and private workspace provenance.
- A newer publication is distinguishable from a previously saved copy; saving replaces that copy.
- Storage failure is reported without claiming the answer was saved.
- Clipboard failure provides a selectable link.
- Question clarification preserves the original source and updates the draft's evidence connections.
- Persona and voice command behaviour is covered using mocked speech APIs; commands cannot approve or publish.

These tests use isolated fixtures and simulated browser storage. They did not alter saved data in the user's real browser.

## Recommendations recorded at the earlier review

These recommendations describe that review snapshot. Consult the README for subsequently implemented features.

### 1. Make product roles explicit

Record whether a product is already owned, being compared or proposed for purchase. This is the most useful next correctness improvement.

Two current examples still expose the gap:

- “Cloud Cream or Daily Gel, just one under £40” is treated as a £62 basket, although the question is choosing one item.
- “I already have Cloud Cream, budget £0. Do I need anything?” counts the owned cream as a new £38 purchase.

Acceptance: compare alternatives separately, exclude owned items from new spending, and preserve each follower's own constraints.

### 2. Show recurring demand clearly

Add visible counts to decision groups, with quick access to questions awaiting context and drafts ready for review. Keep the original messages separate; sharing a topic does not make their answers interchangeable.

### 3. Make published advice independently discoverable

Provide a searchable advice library with topic filters and a direct Saved answers entry. Page 14 of Operation Shade explicitly directs attention to followers who save, share and return without messaging. This is a direction from the brief, not independently verified audience research.

Retain Warm studio as the visual default. Assess contrast, card density and responsiveness when browser access becomes available; no visual sign-off is claimed here.

## Limits recorded at the earlier review

- Free-text validation is not comprehensive. Unrecognised invented product names and differently phrased assertions can still evade the rules; human review is necessary.
- Saved-workspace loading checks the outer shape but not every nested record. Malformed stored data such as a null question can prevent the question view from rendering. A future recovery path should validate records and preserve the damaged original before restoring defaults.
- Links are local, unsigned snapshots. They are not public internet publication or revocable shared records.
- Live AI, Tano and social accounts remain unconnected. Speech APIs have only been mocked in tests.

## Historical verification commands

```sh
npm test
npm run build
```

Pre-chat counts: 24 engine, 5 draft-persona, 5 persona-reply, 2 share and 3 voice-command tests; 12 creator/follower workflow, 5 additional review, 18 voice-panel and 4 persona-workflow tests.
