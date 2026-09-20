# GoodCall — review and test results

Reviewed 20 September 2026. Local app: http://127.0.0.1:4341/

## Current decision tools — 20 September 2026

**446 automated tests passed: 274 Node tests and 172 DOM tests across 23 Vitest files.** This adds 50 tests covering readiness, comparison, follow-ups, sections and their integration. The final publication check repeated the full `npm test` and `npm run build` runs after the browser frame correction; both passed. JavaScript is **711.19 kB / 223.21 kB gzip** and CSS is **129.19 kB / 25.83 kB gzip**. The existing large-chunk advisory remains non-blocking.

The update adds separate answer-readiness badges with complete evidence checks, two- or three-product comparison with explicit purchase roles and optional budget, one clarification follow-up per question, and named decision sections derived from member-card bounds. Tests cover changed/missing evidence on approved answers, alternative versus combined costs, owned products and repurchases, unknown or over-budget amounts, legacy backups, validation limits and references, and private workflow data remaining outside AI requests and published advice. An independent source review found no substantive blocker.

Native Chrome interaction checks on `127.0.0.1:4341` verified creating a waiting follow-up for the existing Cloud Cream question, creating and focusing its named section, and both records surviving a reload. Actual box selection opened the comparison for Cloud Cream and Daily Gel. A temporary £30 comparison budget produced separate £38/£24 options (£8 over / £6 remaining); marking Cloud Cream already owned produced £0 new spending. A local Barrier Cream draft displayed **Checks needed · 3**, opened all blockers and source excerpts, and retained disabled approval. Escape closed evidence review and restored focus to its badge. The browser check caught and corrected section nodes remaining unmeasured/invisible; frames now have explicit dimensions and render beneath evidence cards.

The live Claude connection was preserved, with generation temporarily paused only to prepare the local test draft and then re-enabled. No provider generation, approval or advice publication was performed. The local browser now contains the waiting follow-up, a sample **Cloud Cream value** section, Daily Gel evidence card and an unapproved local Barrier Cream draft with its supporting cards. Comparison settings remained temporary. The browser connector could not initialise, so these checks used the supported native Chrome interface.

Desktop Chrome behaviour was checked; phone/touch layout, exhaustive screen-reader coverage and real clipboard copying were not re-verified for the new panels. Clipboard success/failure is covered by DOM tests. [Usage guide](docs/CANVAS-TOOLS.md).

## Previous canvas editing tools — 20 September 2026

**396 automated tests passed: 243 Node tests and 153 DOM tests across 19 Vitest files.** The full `npm test` and `npm run build` runs passed after the final canvas correction. JavaScript is **682.62 kB / 215.28 kB gzip** and CSS is **116.38 kB / 23.34 kB gzip**. The existing large-chunk advisory remains.

The canvas adds multiple selection, group movement, Select/Pan modes, measured alignment and spacing, position locks, 50-action session layout history and saved review notes. Tests cover legacy backups, malformed notes/locks, layout-only history, later answer/approval preservation, deletion, external moves, restore, deferred keyboard updates, measured note focus, locked items and placement around notes. Review notes are excluded from AI context, fingerprints, evidence gates and public payloads.

Real browser checks on the separate `localhost:4341` origin covered drag-box selection, moving two cards together, one-step Undo/Redo, attempted movement of locked cards, spacing mixed groups without moving locked cards, arrow-key movement and its Undo/Redo, note editing, actual focus after note creation, note removal and saved notes/locks after reload. The 390 × 844 layout had no horizontal page overflow; its toolbar scrolls sideways and expanded view remains available. This is browser verification, not physical touch-device acceptance.

Two independent review lanes found and helped correct note-placement collisions and unsaved keyboard movement. Browser verification additionally caught a deferred-event timing issue and focus attempted before React Flow measured the note. The final review found no further blocker in those changes. The existing Claude session remained configured throughout; no server restart, new provider generation, answer approval or advice publication was performed for this feature.

[Canvas tools guide](docs/CANVAS-TOOLS.md) · [Verification record](docs/review/canvas-tools-verification-2026-09-20.json)

The nine-file review below records the preceding release. Its provider findings remain relevant; its test totals and canvas drag limitations describe that earlier snapshot.

## Previous nine-file completion — 20 September 2026

**354 automated tests passed: 215 Node tests and 139 DOM tests across 18 Vitest files.** `npm test` and `npm run build` both passed after the last quantity/recommendation correction. Node 26.8.1 and npm 11.19.0 were used. Production JavaScript is **666.46 kB / 210.20 kB gzip**; CSS is **112.03 kB / 22.64 kB gzip**. The existing large-chunk advisory remains. [Machine-readable verification and source snapshot](docs/review/verification-2026-09-20.json).

The repeated review repairs purchase roles, explicit selection/articles, multi-unit clarification, selection-specific spending/remainders, negated comparison intent, standalone AI conversation context, shared-dialog padding dismissal and stale persona copy. Existing source, clinical-claim, review, publication and storage gates remain in place. A separate read-only reviewer rechecked the concrete failures and preservation cases, then read all 39 maintained test/support files; no further release blocker was found in that scoped review.

Fresh browser evidence covers seven steps: unsaved-form failure, its repair, existing-answer review, evidence browsing, empty-state recovery, phone-width layout/keyboard exit and persona/provider wording. Real before/after recordings are included. A single Case evidence click reached its second animation frame with the dialog open in 87.2 ms. This is an animation-frame proxy on one machine, not a universal latency or participant comprehension result. See [AUDIT.md](docs/review/AUDIT.md).

### Live Claude acceptance

The user entered the Anthropic key directly into the app. Four authorised Claude Haiku 4.5 generation requests were observed by the provider-testing task:

| Request | Observed result |
| --- | --- |
| Barrier Cream question (`q-05`) | Sourced clarification draft created; `Need more context`, three sources and approval disabled. Minor wording still needed human review. |
| Daily Gel recommendation | Provider responded, but a Cloud Cream mention lacked linked product evidence and the client correctly held it. Unrelated history/selection was still being sent to the provider. |
| Daily Gel facts with “Do not compare” | Provider responded, but a negated comparison triggered comparison/role/context holds. The same false hold was reproduced locally without history. |
| Final facts retest after client repairs | Correct £24 price, Oily / Combo catalogue label and Light finish, with the product-inventory citation. No false spending/comparison hold. The requested recorded quotation was omitted after an empty note heading. |

Live drafting and a factual chat response are verified within that scope. Exact prompt fulfilment and general answer quality are not guaranteed. The client now drops stale conversation/selection for fresh named questions while retaining genuine follow-ups, and distinguishes negative comparison instructions from actual comparison requests. It still validates sources and required review. No tested action approved or published an answer; no real credential was written to a file, and the running server was not restarted.

### Remaining acceptance and performance limits

Physical microphone/speaker operation, real touch/dragging, complete keyboard/screen-reader coverage, clipboard/download behaviour and representative participant sessions remain separate checks. The three-second scan target is unmeasured. No Tano/social integration or cloud deployment is claimed.

The final paired retrieval benchmark retains a correct delimiter-collision fix. The large mixed fixture's median was 130.7987 → 124.1090 ms, but its p90 worsened; the all-matching improvement was negligible. New correctness checks increased absolute validation time against the earlier snapshot. This is **not an overall speed improvement claim**. See [PERFORMANCE.md](docs/review/PERFORMANCE.md).

The sections below are dated historical snapshots; their earlier counts and acceptance status do not replace the current result.

## Historical Claude provider baseline — 20 September 2026

The provider switch passed **327 automated tests**: **190 Node tests and 137 DOM tests across 18 Vitest files**. The final full suite and production build passed after resolving an independently reproduced Claude enum-capitalisation edge case. The adapter canonicalises known enum values only; all evidence and format checks remain enforced. Independent review confirmed the correction with no further actionable findings. JavaScript is 659.51 kB / 207.49 kB gzip; CSS is 112.03 kB / 22.64 kB gzip. The existing bundle-size advisory remains non-blocking.

Coverage includes Claude request headers/schema adaptation, provider-specific credential routing, atomic replacement failure in both directions, refusal/truncation/error handling, existing OpenAI model switching, UI lifecycle cancellation, and Claude provenance through workspace history/backups. Source checks and human approval requirements remain shared across providers. The real browser displayed Claude (Anthropic), Claude Haiku 4.5 and the password-key field, with Connect disabled while the key was blank.

At that baseline, the integration was implemented and locally verified, while account connection and a live answer were still pending; no successful Claude generation is claimed by these automated results. Form keys remain server-session-only and are forgotten on restart; persistent local server variables are supported but no real credential was written to a file by this change.

## Previous integrated review — 20 September 2026

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

At that earlier review, these two examples exposed the gap; the current derived purchase-context repair above covers them:

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
