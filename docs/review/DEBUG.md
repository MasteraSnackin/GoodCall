# GoodCall debugging report

## Current nine-file follow-up — 20 September 2026

The current pass inspected `git log -6 --oneline`: `ef2efaa` and `79db903` changed the screenshot gallery; `40eb15e` contains the earlier integrated review; `22bbfae` is the initial release. The pending Claude/context changes were inspected separately rather than attributed to those screenshot commits. No reset, revert or competing Git write was used.

Independent source/UI and budget investigators worked in parallel. The UI investigator isolated the shared dialog target check; the budget investigator exercised fresh in-memory seed workspaces. Provider/context acceptance ran in a separate task with the user-entered session.

| Reproduction and expected result | Ranked hypotheses | Confirmed cause and repair |
| --- | --- | --- |
| Unsaved question disappears when clicking inside dialog padding; it should remain open | 1. Bare dialog clicks are mistaken for backdrop clicks. 2. Focus/blur resets the form. 3. Autosave rerenders discard local state. | The click handler used only target equality. A point inside the dialog meets that condition. A rectangle check distinguishes interior padding from the backdrop. The new interior-click test failed before repair; after repair the text remains. |
| Owned Cloud Cream with £0 should add £0, alternatives should cost £38 or £24, and owned Cloud Cream plus SPF 50 should spend £26 | 1. All evidence links are summed as purchases. 2. The budget parser chooses the wrong amount. 3. Duplicate or stale prices change the total. | Both generation and validation used all linked prices. A shared derived purchase context separates explicit ownership, alternatives and new purchases without removing evidence links or changing saved records. |
| A clear £62 choice must not pass a £40 comparison budget; a £38 choice leaves £2 rather than £16 | 1. Selection wording is not recognised as purchase intent. 2. Arithmetic accepts any comparison remainder. 3. A stale product price causes the error. | Independent review reproduced missed selection/articles and unioned alternative amounts. Focused intent and remainder checks preserve neutral price evidence while checking the selected purchase. Unsupported quantities request clarification. |
| A one-product facts request says “Do not compare”; it should not demand a second product | 1. A negated keyword triggers comparison rules. 2. Previous chat contaminates this request. 3. The provider omitted context. | The false hold reproduces without history: positive/negated comparison intent needs to be distinguished centrally. Separately, standalone named questions should not send unrelated prior selection/history to the provider. |

Actual [before](current-audit/dialog-before.mp4) and [after](current-audit/dialog-after.mp4) recordings show typing, the click response and preserved/lost form state. Fresh [screenshots and numbered observations](AUDIT.md) cover the same repair. See [recording provenance](current-audit/RECORDINGS.md) for timing, format and decode checks. These clips contain real interactions, not rendered mockups.

Budget acceptance includes zero-cost ownership, separate alternatives, a mixed owned/new purchase with £4 remaining, genuine combined overspend, repurchase, ambiguous roles, explicit expensive selections, unsupported quantities and selection-specific remainders. The current test report is the source for the final combined counts and live-provider outcome; earlier figures below remain historical.

Prevention: keep one resolver shared by draft generation and validation, retain the decision/source/clinical gates, test both positive and negated intent, and check actual browser geometry when changing dialogs. Natural-language checks remain bounded; these fixes do not promise arbitrary wording verification.

## Earlier integrated repair record

Reviewed 20 September 2026. Reliability inspection, performance analysis, documentation and independent review ran in separate ownership lanes. Changes were focused on reproduced defects; the concurrent evidence, design and AI implementation was preserved.

## Reproduction and diagnosis

| Defect and expected behaviour | Ranked hypotheses | Confirmed root cause and minimal repair |
| --- | --- | --- |
| Malformed or partly valid chat must survive loading and subsequent autosave. Instead, damaged original text could become `[]` or a filtered list. | 1. Saving the filtered load result overwrites the original. 2. A migration removes unsupported fields. 3. The browser independently evicts storage. | `loadChat` returned a bounded usable list and the App autosave replaced the primary without preserving excluded input. Protection now sits at the write boundary, covers save/retry/clear and verifies an exact recovery copy before replacement. No browser eviction was required to reproduce it. |
| A valid 5,500-character Unicode answer must either yield a shareable preview or remain unpublished with an error. It could pass content validation but exceed the encoded token limit. | 1. UTF-8/base64 expansion exceeds the link limit. 2. A source reference is invalid. 3. A stale approval was incorrectly accepted. | Text length and encoded snapshot length are different constraints. `createPublicationPreview` and `commitPublication` preflight the actual encoded payload; failure leaves the approved draft unchanged and allows shortening/retry. |
| A failed workspace save must not show publication success. | 1. React state advances before persistence. 2. Snapshot decoding changes the status. 3. A duplicate action bypasses approval. | Publishing previously changed state before the later save effect. The new commit operation prepares the snapshot/history, persists the proposed workspace and returns success only after the save succeeds. False or thrown persistence failures leave the input unchanged. |
| Reviewed-answer reuse must compare exact product sets. | 1. Delimiter keys collide. 2. Topic matching is too broad. 3. Candidate ordering picks the wrong record. | Joining IDs with `|` makes `['a|b','c']` equal to `['a','b|c']`. JSON encoding of sorted unique IDs keeps boundaries. A lazy per-invocation question Map also avoids repeated source-question lookup while retaining first-match/order semantics. |
| A phone canvas must retain usable board space. | 1. A desktop flex basis turns into height in a column. 2. Text wrapping alone expands the introduction. 3. The overall viewport is too small. | At 390 × 844 the introductory child retained a 280 px flex basis; the block measured 345 px. Resetting the narrow-layout basis reduces it to 86 px. The React Flow root also supplied inline position/height overriding the intended inset; explicit root positioning and automatic inset-based height repair the graph boundary. |
| Closing a modal must return keyboard focus to its opener. | 1. Unmount clears the ref before cleanup. 2. Escape is not wired. 3. The opener is removed. | Cleanup dereferenced a cleared ref and did not explicitly restore the opener. Capturing the dialog and active element in the effect permits closing and restoring a still-connected opener. Native Escape then returns focus to Case evidence instead of BODY. |

## Evidence and validation

| Area | Regression or observation |
| --- | --- |
| Chat preservation | [chatStorage.test.ts](../../tests/chatStorage.test.ts): 21 tests covering damaged/partial/oversized data, exact copy ordering, failed copy/read-back, failed primary write, retry/clear, invalid outgoing data and status privacy. |
| Publication | [publication.test.ts](../../tests/publication.test.ts): four tests for Unicode limits, decodable shortened snapshots, false/throwing persistence and review gates. |
| Interface recovery | [publicationWorkflow.test.tsx](../../tests/publicationWorkflow.test.tsx): three tests for blocked preview/shortening, quota failure/retry and dialog focus restoration. The focus regression was observed failing before the effect repair. |
| Reuse correctness | [decisionReuseIndex.test.ts](../../tests/decisionReuseIndex.test.ts): seven new tests; nine existing decision tests also pass. Preserves current evidence validation and AI provenance while keeping copied drafts unapproved. |
| Mobile layout | Actual browser before/after dimensions and captures in [AUDIT.md](AUDIT.md). The initial height-only graph correction collapsed the viewport; the revised position/height repair was visually verified before acceptance. |
| Keyboard | Actual Enter/Escape flow ends with active `BUTTON` named “Case evidence” and zero open dialogs. |
| Combined release | `npm test`: 167 Node + 121 DOM = **288 passed**, 17 Vitest files. `npm run build`: passed after the final runtime fix. |
| Independent review | Separate read-only review found no actionable issue in publication, recovery, reuse, mobile CSS or the final dialog cleanup change. |

At this earlier checkpoint, the saved screenshots were real browser captures and no video had been recorded. The current follow-up above adds real before/after interaction clips. Storage/provider failures were injected in isolated tests; the user's browser data was not deliberately corrupted or filled to quota. Separately, the user authorised one live OpenAI request after connecting a session. It was rejected with HTTP 429; the interface showed the rate-limit/quota message and did not insert or overwrite an answer. No second request was made. Successful generation and physical microphone/speaker operation remain unverified.

## Execution flows after repair

- Chat: load without mutation → inspect primary at save → validate outgoing messages → preserve and verify damaged original → write active history → expose recovery/save status.
- Publication: require current approval → construct public snapshot → encode/size check → prepare published workspace/history → persist → expose published state and success.
- Reuse: canonical exact product key → eligible topic/status candidates → current evidence validation → ranked result → independent unapproved copy with provenance.
- Dialog: capture mounted node/opener → open → close captured node during cleanup → restore connected opener.

## Areas to monitor

Browser storage remains origin-local and quota-limited. Recovery copies are not remote backups; multiple tabs do not have a transactional lock. Share snapshots remain unsigned and non-revocable. Rule-based claim checks are bounded, and source-backed context is not a guarantee that a generated answer is true. The remaining bundle advisory should be addressed with measured route splitting, not by weakening save or review guarantees.

Future changes to modal lifecycles, storage, sharing or reuse should retain these regressions. Test physical speech and real provider behaviour separately from mocked API/lifecycle checks. See [ERROR-HANDLING.md](ERROR-HANDLING.md), [PERFORMANCE.md](PERFORMANCE.md) and [RESEARCH.md](RESEARCH.md).
