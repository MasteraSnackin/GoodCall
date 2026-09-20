# GoodCall functionality and API delivery

Reviewed 20 September 2026. This applies the Builder template to the existing React/Vite/TypeScript app. The implementation covers local workspace workflows and optional Claude/OpenAI suggestions. The visual review and subsequent purchase-context, persona and modal repairs have separate owners. Final combined verification is recorded in [TEST-REPORT.md](../../TEST-REPORT.md).

## Implemented workflows

| Work | Result |
| --- | --- |
| Publication commit | [publication.ts](../../src/lib/publication.ts) constructs and encodes the same public snapshot for preview/publication, verifies approval and saves the proposed workspace before returning success. Oversized snapshots and save failures retain the original draft. |
| Chat recovery | [chatStorage.ts](../../src/lib/chatStorage.ts) preserves exact damaged storage text before replacement, verifies the copy and refuses replacement if preservation fails. Explicit retry and clear use the same protection. |
| Reviewed-answer reuse | [decisionReuse.ts](../../src/lib/decisionReuse.ts) uses collision-safe product keys and a lazy source-question index. Evidence checks remain current; reused drafts carry independent provenance and need review. |
| Dialog lifecycle | Shared modal cleanup captures the dialog/opener and restores focus to a connected opener. Earlier keyboard inspection and a DOM regression cover that focus behaviour; current modal changes use the final verification record. |
| Case-evidence context | The app includes 18 referenced case records, a searchable library and canvas context. Known source IDs and caveats remain attached to relevant draft/chat context. |
| Optional AI drafting/chat | A local proxy supports Claude and OpenAI, explicit provider/model controls, checked context and responses, suggestion comparison, cancellation/retry and stale-response rejection. Existing wording is retained when a request fails. |

## Actual API contract

The proxy is mounted in Vite development and preview. The project scripts bind to `127.0.0.1:4341`; this is a local Node service, not a public serverless deployment.

| Route | Request and behaviour | Evidence boundary |
| --- | --- | --- |
| `GET /api/ai/status` | Returns `configured`, `provider`, `model` and credential `source`, never the key. It does not contact a provider. | Controlled HTTP tests cover both providers and the unconfigured state. |
| `POST /api/ai/connect` | Accepts key, model and provider; checks the model endpoint; replaces the active connection only after success. A legacy request without provider selects OpenAI. | Simulated provider and form tests cover provider routing, failed replacements and late results. A model-access check does not prove credit, generation support or answer quality. |
| `POST /api/ai/model` | Accepts a model ID, reuses the existing provider/key, checks access and commits only after success. Failure retains the previous model and credential. | HTTP and settings tests cover atomic changes, busy operations, cancellation and reopening settings. |
| `POST /api/ai/disconnect` | Accepts an empty object, clears the active credential and aborts pending work. It does not restore an environment key in the same process. | HTTP and workflow tests cover both providers and disconnect races. |
| `POST /api/ai/answer` | Validates bounded context, requests structured output from the selected provider and validates the response before returning a suggestion. | HTTP, context and workflow tests use controlled responses. The earlier OpenAI attempt returned HTTP 429. A later live Claude draft and factual chat succeeded; see the scoped acceptance below. |

All routes enforce the local socket/Host/Origin boundary. POST requests also require JSON and the application client header. The server limits request bodies to 128 KiB, normal provider response bodies to 256 KiB and inspected provider error bodies to 16 KiB. Connect/model checking and answer generation share an exclusion rule: another such operation receives a busy response. There is no automatic retry or cross-provider fallback.

Provider requests use fixed HTTPS endpoints and reject redirects. Claude uses Anthropic Messages with `output_config.format`; OpenAI uses Responses with strict JSON schema and `store:false`. Neither request gives the model action tools. Claude's provider schema describes bounds that its schema subset omits, while the shared local validator still enforces those bounds. Source IDs and product references must belong to the supplied evidence. Passing these checks is not a general proof that each natural-language claim is supported.

The client also checks current evidence, question state and existing answer text before applying a result. Replacing an existing draft requires an explicit comparison choice. Suggestions start unapproved, and unresolved AI evidence blocks approval. AI cannot approve, publish or operate social accounts.

## Provider selection and configuration

The unconfigured source default is Claude with `claude-haiku-4-5-20251001` (the UI labels it Claude Haiku 4.5). The OpenAI default is `gpt-4.1-mini`; the form also offers `gpt-5.4-mini` and a custom model ID. These are application defaults, not claims of account access or a recommendation based on measured model quality. [aiTypes.ts](../../src/lib/aiTypes.ts), [AiSettings.tsx](../../src/components/AiSettings.tsx)

A key entered in settings is cleared from the form and held in the local server process for that session. The app does not write it to browser storage, workspace backups or the repository. Switching the form's provider clears the entered key; the active connection remains until its replacement passes the access check. Changing a model keeps the current provider and credential source. Reopening settings refreshes authoritative server status, including when a previous operation completed around cancellation.

For separately configured server environments, `AI_PROVIDER` selects `anthropic` or `openai`, and only the matching `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` or `OPENAI_API_KEY` / `OPENAI_MODEL` pair is used. Without a selector, an Anthropic key takes precedence, then an OpenAI key, then the unconfigured Claude default. Invalid selectors fail explicitly. `.env.example` contains empty keys and server-only names; no `VITE_` credential is supported. This documentation refresh did not read private environment files or persist a credential. [aiConfiguration.ts](../../server/aiConfiguration.ts)

## Verification record

The first combined nine-template review recorded 288 passing tests (167 Node and 121 DOM), a successful production build and an entry script of 655.93 kB / 206.41 kB gzip. Those figures describe that earlier snapshot.

The subsequent provider-switch baseline recorded 327 passing tests (190 Node and 137 DOM) and a successful production build. It precedes the new purchase-context, persona and modal repairs and must not be presented as their final acceptance. Use [TEST-REPORT.md](../../TEST-REPORT.md) for the final aggregate, build result and remaining checks; this documentation task did not rerun the suite.

Earlier real browser checks covered desktop/phone layout, review opening, evidence search/reset and keyboard focus return. Provider and storage failure paths use controlled fault-injection tests. The earlier independent review found no actionable issue in its scoped reliability, reuse, layout and modal-cleanup changes. That does not certify later edits.

The historical OpenAI check returned HTTP 429 and preserved existing answers. A later user-connected Claude Haiku 4.5 session made four authorised generation requests. A sourced Barrier Cream clarification draft remained unapproved with approval blocked. Two chat checks exposed context/wording problems; after the client repairs, a final Daily Gel facts request returned the correct £24 price, Oily / Combo label and Light finish with the catalogue citation. It omitted the requested quotation after an empty note heading, so exact prompt fulfilment and general answer quality are not claimed. No answer was approved or published by these checks; the session key was not written to a file. Provider latency was not benchmarked.

## Deployment and remaining work

The attached template's Modal/serverless example is not part of this application. The applicable local endpoints are implemented and tested. A static `dist/` upload would not include the Node proxy. Before internet deployment, define authentication, secret management, shared persistence, revocable publication, access controls and provider acceptance. Those are future infrastructure decisions rather than prerequisites for the tested local exercise.

Tano and social account connections still require integration access. Physical voice operation, clipboard/download behaviour and real touch/dragging remain device checks. [TASK-RESULTS.md](TASK-RESULTS.md) maps all nine supplied task files to their outputs.
