# Error handling and chat recovery

Reviewed against the local GoodCall source on 20 September 2026. This report describes implemented TypeScript and browser boundaries. It is not evidence that a live AI provider, microphone or deployment has been verified.

## Corrected failure: loading damaged chat erased the original

Previously, `loadChat()` returned an empty list for malformed JSON and filtered invalid or duplicate entries from arrays. The App's chat-saving effect then passed that result to `saveChat()`, which replaced `maya-chat-v1`. For example, `{incomplete-but-recoverable` became `[]`, losing the original data. A partly valid array lost the excluded entries in the same way.

[`src/lib/chatStorage.ts`](../../src/lib/chatStorage.ts) now applies the protection at the write boundary, so automatic saves, explicit retries and clears all use it:

1. Validate all outgoing messages, reject duplicate IDs, retain the latest 60 and validate their serialised form. Invalid or oversized output causes no storage writes.
2. Read and inspect the current primary value, even when the caller has not loaded it. A missing key is distinct from an empty, unreadable value.
3. Before replacing unreadable JSON, a non-array value, an oversized value or an array with invalid/duplicate records, preserve the **exact original localStorage string** under a new `maya-chat-recovery-v1:` key. Whitespace and excluded records remain intact. Read the copy back and compare it with the original.
4. If preservation fails or cannot be verified, return `false` without writing the primary. If the subsequent primary write fails, retain both the original and its verified copy.
5. Keep recovery copies. Neither normal saves nor the explicit clear action delete them. A retry following a failed primary write can reuse its already verified recovery copy.

`loadChat()` does not write anything. It exposes only valid, uniquely identified records, bounded to the latest 60; unreadable or oversized history yields an empty visible list with a recovery status. The existing raw limit is **2,000,000 JavaScript string code units**, not a guaranteed byte size. An oversized original may exceed that limit in its recovery copy: preservation intentionally keeps the original intact. If the browser cannot store that copy, saving is blocked.

Legacy records remain valid without new fields. Optional `origin` accepts only `local` or `ai`; optional `aiModel` is a string of at most 120 characters. Existing message, source-reference and question limits remain in place.

## Chat storage API and caller responsibilities

| API | Result and meaning |
| --- | --- |
| `loadChat(): ChatMessage[]` | Load bounded valid records; report damage or unavailable storage separately. Never rewrite the primary. |
| `saveChat(messages): boolean` | Validate and safely persist the current in-memory conversation. `false` means the caller must retain that conversation and show the status. |
| `getChatRecoveryStatus(): ChatRecoveryStatus` | Return a snapshot with `state`, safe display `message`, optional damage `reason` and optional `recoveryKey`. It contains no message text or raw exception details. |
| `retryChatStorage(messages): boolean` | Explicitly repeat the same protected save using the current in-memory conversation. There is no timer or unbounded retry loop. |
| `clearChat(): boolean` | Save an empty active history using the same preservation rules. Clear React state only if this succeeds. Recovery copies remain. |

The UI reads the status after load/save/retry/clear; this module does not subscribe React automatically.

| `state` | Meaning |
| --- | --- |
| `ready` | Normal load or save. |
| `recovery-needed` | Stored chat cannot be used completely; the primary is still untouched. |
| `recovered` | The damaged original has a verified recovery copy and the active save succeeded. It does not mean all damaged messages were reconstructed. |
| `blocked` | The original could not be preserved, so replacing the primary was refused. |
| `unavailable` | Accessing localStorage or reading the primary failed. |
| `save-failed` | Outgoing validation/serialisation failed, or writing the primary failed. |

Damage reasons are `unreadable`, `invalid-records` and `oversized`. The returned message is suitable for the chat notice; callers must not replace a recovery notice with a generic success message merely because `saveChat()` returned `true`.

## Existing failure boundaries

| Boundary | Actual error/result pattern and behaviour |
| --- | --- |
| Workspace import validation | [`workspaceValidation.ts`](../../src/lib/workspaceValidation.ts) returns the discriminated union `WorkspaceValidation = {ok:true, workspace} | {ok:false, error}`. It checks structure, supported format/version, duplicate IDs, references, bounded histories and the 5,000,000-byte backup limit before imported data is consumed. Parsing failures become a safe validation error. |
| Workspace persistence and restore | [`storage.ts`](../../src/lib/storage.ts) returns booleans and reports `StorageStatus` through a getter/subscription. Saving preserves a prior valid recovery snapshot or an exact damaged copy before replacing the primary. Restore saves the live pre-restore workspace first. Storage failure leaves the current in-memory workspace available for backup. |
| Backup preparation and file reading | `workspaceBackupText()` throws an `Error` for invalid or oversized exports. [`WorkspaceRecovery.tsx`](../../src/components/WorkspaceRecovery.tsx) catches it and reports a message; file read/parse failures do not apply a workspace. A sequence counter ignores stale file-reading completions. |
| Follower feedback | [`feedback.ts`](../../src/lib/feedback.ts) uses `FeedbackRead` and the discriminated `FeedbackResult` union. Invalid, oversized or unavailable stored feedback blocks writes rather than replacing it. Save errors keep the submitted wording available. Feedback/workspace handoff uses explicit intermediate states; it is not a multi-store transaction. |
| Share links | [`share.ts`](../../src/lib/share.ts) throws bounded user-facing errors while encoding invalid/oversized advice. Decode returns `PublishedAdvice | null` for malformed, oversized or invalid input. App catches share/preview failures; clipboard failure offers manual copying. |
| Voice | [`VoicePanel.tsx`](../../src/components/VoicePanel.tsx) handles unsupported recognition, permission denial, missing microphones, network/no-speech errors and synchronous start failures. It provides typed-input fallback. Session identity/mount checks suppress stale callbacks, stopping has a three-second cleanup fallback, and read-aloud errors leave the text available. |
| Optional local AI endpoint | [`server/aiServer.ts`](../../server/aiServer.ts) uses an internal `AiError` carrying HTTP status, code and safe message, returned as `{error:{code,message}}`. Request/provider data is bounded and validated. Provider auth, model, rate-limit, connection and timeout failures receive safe messages without forwarding raw provider bodies. Pending operations are cancelled on disconnect or client closure and timers/listeners are cleaned in `finally`. |
| AI client and UI | [`aiClient.ts`](../../src/lib/aiClient.ts) throws for non-success responses or unreadable response objects and forwards an abort signal. App catches rejected AI requests, exposes a retry/cancel path and checks that the relevant evidence and request are still current before applying suggestions. These paths do not automatically approve or publish an answer. |
| Cosmetic preferences | Theme read failures use the default theme. Theme write failures are ignored because they do not affect conversation or workspace data. |

This code uses typed results for expected validation outcomes, exceptions at browser/JSON/network boundaries, and explicit UI messages. A single global custom error hierarchy would not improve every one of those boundaries. There is no repository-wide React error boundary in `main.tsx`; unexpected render errors are outside this storage correction.

## Verification and remaining limits

Focused regressions in [`tests/chatStorage.test.ts`](../../tests/chatStorage.test.ts) cover exact preservation and write order for malformed and partly valid data, empty/non-array data, oversized stored data, failed backup writes and read-back mismatch, failed primary writes, explicit retries, clear success/failure, latest-primary inspection, invalid/oversized output, legacy/AI metadata, inaccessible localStorage and status privacy. The focused suite passed **21 tests**. A strict standalone TypeScript check of `src/lib/chatStorage.ts` and its imported types passed.

Commands used:

```sh
npx tsx --test tests/chatStorage.test.ts
npx tsc --noEmit --target ES2022 --lib ES2022,DOM --module ESNext --moduleResolution Bundler --skipLibCheck --strict src/lib/chatStorage.ts
```

Recovery strings remain local to the browser origin and are not logged or sent to a provider by chat storage. They can contain private conversation text, just like the primary. Clearing browser data removes both. The status is session-local; this module does not provide a backup-management/download interface or cross-tab locking. The 60-message retention policy still applies to valid active history. This correction preserves unreadable input before replacement; it cannot reconstruct arbitrary malformed content or make localStorage a durable remote backup.
