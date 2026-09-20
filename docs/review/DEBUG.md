# GoodCall debugging report

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

The saved screenshots are real browser captures. No video was recorded. Storage/provider failures were injected in isolated tests; the user's browser data was not deliberately corrupted or filled to quota. Separately, the user authorised one live OpenAI request after connecting a session. It was rejected with HTTP 429; the interface showed the rate-limit/quota message and did not insert or overwrite an answer. No second request was made. Successful generation and physical microphone/speaker operation remain unverified.

## Execution flows after repair

- Chat: load without mutation → inspect primary at save → validate outgoing messages → preserve and verify damaged original → write active history → expose recovery/save status.
- Publication: require current approval → construct public snapshot → encode/size check → prepare published workspace/history → persist → expose published state and success.
- Reuse: canonical exact product key → eligible topic/status candidates → current evidence validation → ranked result → independent unapproved copy with provenance.
- Dialog: capture mounted node/opener → open → close captured node during cleanup → restore connected opener.

## Areas to monitor

Browser storage remains origin-local and quota-limited. Recovery copies are not remote backups; multiple tabs do not have a transactional lock. Share snapshots remain unsigned and non-revocable. Rule-based claim checks are bounded, and source-backed context is not a guarantee that a generated answer is true. The remaining bundle advisory should be addressed with measured route splitting, not by weakening save or review guarantees.

Future changes to modal lifecycles, storage, sharing or reuse should retain these regressions. Test physical speech and real provider behaviour separately from mocked API/lifecycle checks. See [ERROR-HANDLING.md](ERROR-HANDLING.md), [PERFORMANCE.md](PERFORMANCE.md) and [RESEARCH.md](RESEARCH.md).
