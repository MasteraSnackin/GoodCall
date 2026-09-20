# GoodCall functionality and API delivery

Reviewed 20 September 2026. This applies the Builder template to the existing React/Vite/TypeScript app. The logic lane handled state transitions, storage, reuse and the optional local AI contract. The visual lane owned layout and CSS.

## Implemented engine changes

| Work | Result |
| --- | --- |
| Publication commit | New [publication.ts](../../src/lib/publication.ts) constructs and encodes the same public snapshot for preview/publication, verifies approval and saves the proposed workspace before returning success. Oversized snapshots and save failures retain the original draft. |
| Chat recovery | [chatStorage.ts](../../src/lib/chatStorage.ts) preserves exact damaged storage text before replacement, verifies the copy and refuses replacement if preservation fails. Explicit retry and clear use the same protection. |
| Reviewed-answer reuse | [decisionReuse.ts](../../src/lib/decisionReuse.ts) uses collision-safe product keys and a lazy source-question index. Evidence checks remain current; reused drafts carry independent provenance and need review. |
| Dialog lifecycle | Shared modal cleanup captures the dialog/opener and restores focus to a connected opener. Verified with actual keyboard interaction and a DOM regression. |
| Case-evidence context | Concurrent source work adds 18 referenced case records, a searchable library and canvas context. Known source IDs and caveats are retained in draft/chat context. |
| Optional AI drafting/chat | Concurrent AI work adds a local OpenAI proxy, explicit connection/mode controls, checked context and responses, suggestion comparison, cancellation/retry and stale-response rejection. Existing text is retained on errors. |

## Actual API contract

The proxy is mounted in Vite development **and preview**. It runs on the local machine at `127.0.0.1:4341`; it is not a public serverless deployment.

| Route | Behaviour | Verification |
| --- | --- | --- |
| `GET /api/ai/status` | Safe configured/model/source status without returning the key | Initially unconfigured; later user-connected session reported configured with the selected model |
| `POST /api/ai/connect` | Validate key/model input, check model access and retain the credential in the process session | HTTP tests with a simulated provider; blank-key validation inspected; later session connected by the user |
| `POST /api/ai/disconnect` | Clear the active credential and cancel pending work | HTTP and workflow tests |
| `POST /api/ai/answer` | Validate bounded context, request structured output and validate allowed source IDs before returning a suggestion | HTTP, context and workflow tests; one live request rejected with HTTP 429 and no answer mutation |

The endpoint enforces local Host/Origin, JSON and the application client header; bounds request and response sizes; permits a single active connect/answer operation; and handles timeout, cancellation, provider errors and disconnect races. A supplied key remains in the local server process. Environment configuration is supported through the server environment or `.env.local`; `.env.example` contains no credential. See [ARCHITECTURE.md](../../ARCHITECTURE.md) for the full contract.

The source default model is `gpt-5.4-mini`. Automated tests use controlled responses without provider spending. In a separate user-authorised live check, a connected session attempted one answer request and received HTTP 429. The app showed a rate-limit/quota error and preserved existing answers; no retry or second request was made. Successful generation and answer quality remain unverified. Suggestions remain unapproved; unresolved AI evidence blocks approval. The model cannot operate social accounts, approve or publish.

## Validation

- **288 tests passed:** 167 Node tests and 121 simulated-interface tests across 17 Vitest files.
- Production build passed after the last runtime change: JavaScript 655.93 kB / 206.41 kB gzip; CSS 111.92 kB / 22.62 kB gzip. The JavaScript size advisory is non-blocking and remains recorded.
- Real browser checks cover desktop/phone layout, review opening, evidence search/reset and keyboard focus return. Storage/provider failure paths use isolated fault-injection tests.
- Independent review found no actionable issue in the scoped reliability, reuse, layout or modal cleanup changes.

## Deployment and remaining work

The attached template's Modal/serverless example is not part of this application. The applicable local endpoints are implemented and tested; no cloud service or successful live AI generation is claimed. A static `dist/` upload would not include the Node proxy. Before internet deployment, define authentication, secret management, shared persistence, revocable publication, access controls and provider acceptance. Those are future infrastructure decisions rather than prerequisites for the verified local exercise.

Tano and social account connections still require integration access. Physical voice operation, clipboard/download behaviour and real touch/dragging remain device checks. [TASK-RESULTS.md](TASK-RESULTS.md) maps all nine supplied task files to their outputs.
