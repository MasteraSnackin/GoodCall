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
| Optional local AI endpoint | [`server/aiServer.ts`](../../server/aiServer.ts) uses an internal `AiError` carrying HTTP status, code and safe message, returned as `{error:{code,message}}`. Claude/OpenAI request and response data is bounded and validated. Auth, model, billing/rate-limit, connection, overload and timeout failures receive safe local messages without forwarding raw provider prose. Pending operations are cancelled on disconnect or client closure and timers/listeners are cleaned in `finally`. The provider-specific contract is detailed below. |
| AI client and UI | [`aiClient.ts`](../../src/lib/aiClient.ts) throws for non-success responses or unreadable response objects and forwards an abort signal. App catches rejected AI requests, exposes an explicit retry/cancel path and checks that evidence, question, selected card and existing wording are still current before applying suggestions. A failed AI request does not silently substitute a local answer. Settings refreshes authoritative status on reopen and suppresses a closed dialog’s late result. These paths do not automatically approve or publish an answer. |
| Cosmetic preferences | Theme read failures use the default theme. Theme write failures are ignored because they do not affect conversation or workspace data. |

This code uses typed results for expected validation outcomes, exceptions at browser/JSON/network boundaries, and explicit UI messages. A single global custom error hierarchy would not improve every one of those boundaries. There is no repository-wide React error boundary in `main.tsx`; unexpected render errors are outside this storage correction.

## Current AI connection and failure contract

[`aiConfiguration.ts`](../../server/aiConfiguration.ts) selects one provider and only its matching credential. The default is Claude with `claude-haiku-4-5-20251001`; OpenAI uses `gpt-4.1-mini` by default. Explicit `AI_PROVIDER` must be `anthropic` or `openai`. Without it, an Anthropic environment key takes precedence over OpenAI; no key leaves the server unconfigured. A settings-entered key stays in server memory, and changing the form provider clears the entered field. This review does not read or persist credentials.

| Operation or failure | Current behaviour |
| --- | --- |
| Status | `GET /api/ai/status` returns provider/model/source and configured state without a provider request or secret. An unavailable status refresh produces a local settings error. |
| Connect | `POST /api/ai/connect` checks the selected provider's model endpoint. Invalid providers and mismatched credential prefixes fail locally. A rejected or cancelled replacement retains the active connection. Legacy bodies without provider select OpenAI. |
| Model change | `POST /api/ai/model` needs an active key and reuses its provider/source. A failed check keeps the prior model; no model change restores account credit or quota. |
| Disconnect | `POST /api/ai/disconnect` clears the runtime credential, increments a generation counter and aborts pending controllers. It does not silently reload an environment credential. A server restart may load separately configured environment values. |
| Concurrent work | Connect, model change and answer requests are mutually exclusive. A busy response avoids a second provider request. Status and disconnect remain separate control paths. |
| Input and response bounds | Bodies are read with size and timeout limits: 128 KiB local request, 256 KiB normal provider response and 16 KiB inspected provider error. Malformed JSON, invalid UTF-8, unknown fields/IDs and unsupported answer shapes fail safely. |
| Provider output | OpenAI requires a completed Responses result with one output text; Claude requires one text block ending normally. Truncated, refused, tool-use or malformed results are rejected. Claude normalises only recognised enum casing before the shared strict checks. Local length/item limits remain enforced after provider schema transformation. |
| OpenAI errors | Selected 429 billing/quota/rate-limit codes map to fixed messages. An unrecognised 429 remains an unspecified rate-limit/quota error. Auth and model failures have separate messages; upstream prose is never displayed. |
| Claude errors | Auth, model, billing, request rejection, rate/spending limits and overload receive fixed messages. A generic HTTP 400 does not establish a specific billing cause. Other failures use a safe unavailable message. |
| Timeout or closed client | Defaults are 10 seconds for body receipt, 15 seconds for connection/model checks and 60 seconds for answers. A closed response or disconnect aborts pending work. The operation races completion with cancellation, releases its slot and cleans up timers/listeners. |
| Late response | Server generation checks reject results after a connection change/disconnect. Client request identity and evidence fingerprints reject stale drafts/chat. Existing wording remains available; failed model replacement keeps the previous active model. |
| Retry | The user can explicitly retry. There is no automatic generation retry, cross-provider fallback or silent local-answer substitution after a provider error. Cancellation cannot establish whether the remote provider already processed or charged for a request. |

Model access checks do not prove that an answer can be generated with the current account, model features, credit or capacity. Provider schema/reference validation also does not prove every natural-language claim. Existing local evidence holds and human approval remain required. Full route and configuration details are in [BUILDER.md](BUILDER.md).

## Verification and remaining limits

Focused regressions in [`tests/chatStorage.test.ts`](../../tests/chatStorage.test.ts) cover exact preservation and write order for malformed and partly valid data, empty/non-array data, oversized stored data, failed backup writes and read-back mismatch, failed primary writes, explicit retries, clear success/failure, latest-primary inspection, invalid/oversized output, legacy/AI metadata, inaccessible localStorage and status privacy. The original focused suite passed **21 tests**. A strict standalone TypeScript check of `src/lib/chatStorage.ts` and its imported types passed at that snapshot. These historical results are retained below; this documentation refresh did not rerun them.

Original focused commands:

```sh
npx tsx --test tests/chatStorage.test.ts
npx tsc --noEmit --target ES2022 --lib ES2022,DOM --module ESNext --moduleResolution Bundler --skipLibCheck --strict src/lib/chatStorage.ts
```

Recovery strings remain local to the browser origin and are not logged or sent to a provider by chat storage. They can contain private conversation text, just like the primary. Clearing browser data removes both. The status is session-local; this module does not provide a backup-management/download interface or cross-tab locking. The 60-message retention policy still applies to valid active history. This correction preserves unreadable input before replacement; it cannot reconstruct arbitrary malformed content or make localStorage a durable remote backup.


Current provider regression coverage is recorded in [`aiServer.test.ts`](../../tests/aiServer.test.ts), [`aiConfiguration.test.ts`](../../tests/aiConfiguration.test.ts), [`aiContext.test.ts`](../../tests/aiContext.test.ts), [`aiSettings.test.tsx`](../../tests/aiSettings.test.tsx) and [`aiWorkflow.test.tsx`](../../tests/aiWorkflow.test.tsx). It includes provider routing, model-change atomicity, safe errors, cancellation/timeout races, context and source checks, unchanged wording after failure, and unapproved draft provenance. Controlled provider responses are not live account acceptance.

The provider-switch baseline recorded **327 passing tests: 190 Node and 137 DOM**, plus a production build. That baseline predates the subsequent purchase-context, persona and modal repairs. [TEST-REPORT.md](../../TEST-REPORT.md) is the source for their final combined results, rather than a placeholder count in this document.

The historical live OpenAI check returned HTTP 429 and preserved existing answers. A later user-connected Claude Haiku 4.5 session made four authorised generation requests. A sourced Barrier Cream clarification draft remained unapproved with approval blocked. Two chat checks exposed context/wording problems; after the client repairs, a final Daily Gel facts request returned the correct £24 price, Oily / Combo label and Light finish with the catalogue citation. It omitted the requested quotation after an empty note heading, so exact prompt fulfilment and general answer quality are not claimed. No answer was approved or published by these checks; the session key was not written to a file. The error-handling documentation lane itself made no provider request or server change.
