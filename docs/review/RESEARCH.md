# Algorithmic research

Review and recheck date: 20 September 2026. Scope: GoodCall's TypeScript logic, data structures, current Claude/OpenAI adapters and benchmark scripts, adapting the Researcher brief to the implemented stack. Findings distinguish inspected local behaviour, fresh offline measurements and untested provider behaviour. The source coverage appendix lists the logic and server files read for this refresh and the peer UI/configuration review. Follow-up runtime repairs require their own review and validation.

## Original written rationale recorded before implementation

The top Quick Win is exact product-set matching in `decisionReuse.ts`. The former key, `sort().join('|')`, was not injective for valid string IDs: `['a|b', 'c']` and `['a', 'b|c']` both become `a|b|c`. Workspace import validation permits these IDs. An unrelated reviewed answer can therefore appear as a reusable starting point. Changing the key to `JSON.stringify([...new Set(ids)].sort())` preserves order independence and duplicate removal while retaining string boundaries. This is an encoding correction, not a change to matching policy. A regression must reproduce the old false match and show that the corrected code rejects it.

The former routine found the originating question by scanning every question for every candidate draft. An invocation-local `Map` can remove that repeated lookup scan. It must retain the first occurrence of any duplicate ID, matching `Array.find`, although validated workspaces reject duplicates. Build it only when a candidate reaches question lookup, retain draft order, and discard it after the call. Do not cache approval decisions across calls: question text and current evidence must still be rechecked. Measure before adopting the index because tiny libraries may not benefit.

ECMAScript requires average sublinear access for Map; it does not guarantee a particular implementation or constant-time worst case. This justifies testing a keyed lookup here, not declaring all arrays inappropriate. [ECMAScript Map objects](https://tc39.es/ecma262/multipage/keyed-collections.html#sec-map-objects)

The original Quick Win was scoped to `src/lib/decisionReuse.ts`. Both changes were subsequently implemented and verified; results are recorded in [PERFORMANCE.md](PERFORMANCE.md). The separately authorised purchase-context repair below also updates `purchaseContext.ts` and the relevant engine checks.

### Concurrent AI provenance contract

Before implementing the integration guard, the coordinator confirmed that drafts now permit `mode: 'AI suggestion'` and optional provider/model/generated-at/missing-evidence metadata. Reuse copies reviewed wording, so it must also copy its origin mode and AI metadata rather than relabel it as an evidence template. Copy the nested missing-evidence list to avoid shared mutable state. Keep newly generated question references, product revisions and unapproved status. The ordinary current validator remains authoritative; flagged source drafts are ineligible.

## Core algorithms and data structures

The current logic review covers all `src/lib` and `server` files, plus all benchmark scripts. Component call sites were inspected where relevant; the complete UI review is owned by another lane. The following assessment does not claim that every conceivable input has been proved safe.

| Area | Current approach | Fit for the current problem | Evidence-led next step |
|---|---|---|---|
| Question grouping | Ordered regular expressions after case/apostrophe/currency normalisation | Transparent and cheap for five named exercise categories. Rule order defines precedence; it is not semantic understanding. | Preserve the narrow fallback. Create a labelled set of ambiguous and paraphrased questions before choosing a classifier. |
| Product resolution | Catalogue scan and normalised substring checks; explicit ID union; a few source-backed fallback routes | Ten catalogue records do not justify a search service. Source identity must remain exact. | If the catalogue grows, benchmark an alias/token index against current exact outputs; include overlapping names and punctuation. |
| Evidence validation | Deterministic rules, current product revisions, source references, budget parsing and quote/price comparisons | Necessary as a bounded review gate. It is not an arbitrary-document fact checker. Repeated work dominates large reuse sets. | Share immutable per-invocation lookup context only after proving equivalent errors and order. Do not cache approval across evidence changes. |
| Reusable advice | Exact product set, computed question topic, reviewed status and current validation | Appropriate as a suggestion gate. Same topic/products still cannot establish a new follower's suitability. | Product-key correction and local question index implemented. Keep a fresh unapproved draft and current evidence. |
| Chat and voice | Explicit voice-command grammar and local rules; optional provider-generated chat; narrow user constraints reconstructed for follow-ups | Local navigation remains bounded. Provider-generated prose still needs evidence and context checks. | Evaluate context retention and abstention separately from fluency. A changed product, corrected budget or unrelated turn must not inherit stale private context. |
| AI request and response processing | Bounded recent history, supplied catalogue and selected source context; exact evidence serialisation; provider schema plus local checks | Works as a constrained suggestion interface. Valid references and JSON do not establish that every claim follows from a cited record. | Evaluate supported and unsupported claims against a labelled set; retain deterministic checks and fresh human review. |
| Provider concurrency and cancellation | One answer/connect operation at a time; AbortControllers, byte limits, timeouts and a generation counter | Prevents stale operations from replacing the selected connection or returning an accepted answer after disconnect. The provider may already have started work. | Keep late-response, timeout and disconnect regressions. Do not infer avoided provider cost or successful live generation from local cancellation tests. |
| Source deduplication | Array filter plus earlier-element search | Quadratic in references, but present reference lists are bounded and small. | Consider a tuple-key Set only if a larger-source benchmark shows material cost; preserve first-reference identity and order. |
| Canvas relationships | Arrays of cards/edges; bounded neighbour expansion and text search | Simple, serialisable and sufficient for the small board. Repeated entity lookups can scale poorly. | An adjacency/entity index is a measured future option. No graph-layout algorithm was changed here; another task owns these files. |
| History and recovery | Bounded snapshots, content comparisons and whole-workspace JSON | Clear rollback semantics; larger histories increase serialisation cost. | Profile edit/save frequency first. Incremental journals require explicit migration and recovery design. |
| Feedback version and public advice | Snapshot fields, a small non-cryptographic version hash, validated encoded snapshots | A local deduplication hint and portable snapshot, not proof of origin or a digital signature. | Any cross-device identity/authenticity design needs a separate contract. No cryptographic claim is added. |

## Quick Wins

1. **Implemented: collision-free product-set keys.** The deterministic regression fails under the former key and passes now. A key must retain string boundaries; a stronger search model would not fix this error.
2. **Implemented: invocation-local question index.** On the final repaired code, the largest mixed-topic paired median was 130.7987 versus 124.1090 ms, 5.1% lower, while p90 worsened from 142.9098 to 153.4293 ms. Most other differences were negligible. The earlier 8.8% and 10.3% figures remain historical snapshots; a reliable broad speed improvement is not established. Absolute retrieval timings increased after the correctness repairs, and current-evidence validation still dominates. See [method and raw results](PERFORMANCE.md).
3. **Implemented as integration correctness: preserve origin metadata on reuse.** Copy mode/provider metadata with independent nested arrays; never transfer approval. This has behavioural regressions rather than a misleading speed benchmark.

The original Quick Wins introduced no package, UI feature or persistent index migration. The refresh retains them. The subsequent correctness repair changes bounded purchase interpretation and validation without changing the workspace schema.

## Medium Efforts

| Proposed work | Reasoning | Evaluation gate before adoption |
|---|---|---|
| Reusable-answer lookup/validation context | Build question/product maps once per current workspace evaluation; optionally index exact product set plus intent. An inverted index associates terms with matching records, a well-established retrieval structure. Here the keys would be exact structured attributes rather than free text. | Same ordered candidate IDs and identical validation messages across edits, deleted records, revisions and held questions. Benchmark build plus query cost, not query cost alone, at seed, 1,200 and 2,400 questions. |
| Memoise expensive derived work by explicit dependencies | The current question list calls retrieval separately for each visible question without a draft, and review paths can repeat validation during unrelated renders. The canvas already memoises its node/edge models, search and relationship calculations, so a blanket memoisation rewrite is not justified. React documents memoisation as a performance aid, not a correctness guarantee. | Production browser profile showing repeated costs, stable dependency coverage, and regression tests that invalidate results after every question/product/approval change. |
| Separate follower entry from creator canvas code | The measured entry chunk has no dynamic imports; it includes canvas libraries even for a follower card. React lazy supports deferred component loading, and Vite optimises dependencies of dynamic chunks. | Measure bytes, requests, first useful render and error fallback on both routes, including slow network/cache cases. Do not merely split vendor chunks and claim reduced transfer. |
| Reduce save-path repeated serialisation | At 4.76 MB, the fresh Node medians are 12.2494 ms for serialisation and 13.7842 ms for parsing/validation. This is a plausible main-thread target at scale. | Browser storage profiling plus crash/reload/restore tests that preserve the current recovery contract. Do not adopt debounce timing without proving what remains durable. |

Primary references: [Stanford/Cambridge introduction to inverted indexes](https://nlp.stanford.edu/IR-book/html/htmledition/an-example-information-retrieval-problem-1.html), [React useMemo](https://react.dev/reference/react/useMemo), [React lazy](https://react.dev/reference/react/lazy), [Vite async chunk loading](https://vite.dev/guide/features.html#async-chunk-loading-optimization). These document mechanisms; the proposed GoodCall benefit remains a hypothesis until its evaluation gate passes.

## Research Bets

**Lexical and semantic retrieval for larger evidence libraries.** Compare exact structured matching, a lexical baseline and sentence embeddings on a labelled GoodCall task set. Sentence-BERT demonstrated sentence embeddings that can be compared with cosine similarity; that makes it a relevant technique, not evidence of suitability for this product. BEIR evaluates retrieval across heterogeneous tasks and reports that simple lexical baselines remain competitive while stronger ranking methods may cost more. Neither paper establishes the best current model for this application. [Sentence-BERT paper](https://arxiv.org/abs/1908.10084), [BEIR paper](https://arxiv.org/abs/2104.08663)

The prototype experiment should rank suggestions only. Keep product identity, follower budget/preferences, safety-related evidence gaps and approval gates explicit. Measure recall@k for genuinely reusable judgements, precision of suggested matches, constraint-conflict rate, abstention, source accuracy, latency, memory and provider cost. Separate training examples from held-out cases. An improvement in wording similarity is insufficient if evidence or follower constraints are lost.

**Structured constraint extraction.** Define an intermediate representation for product identity and role (owned, compared or proposed purchase), budget, skin/finish preferences and unresolved facts before replacing language rules. Compare deterministic parsing with schema-constrained model extraction on the same labelled examples, particularly negation, corrections and multiple amounts. Adoption requires fewer incorrect facts and no loss of currently held cases; evaluate source-span provenance and abstention, not just a broad accuracy score. This is a proposed experiment, not an implemented architecture.

**Incremental evidence dependency graph.** Larger collections could track which draft depends on which product revision and source field, then invalidate only affected derived results. The benefit must exceed graph maintenance cost and must survive restore/import, edited sources and deleted entities. Keep full validation as a reference oracle during a prototype. This is a design hypothesis based on the observed repeated work; no evidence graph cache was added in this task.

## Material gaps from the current recheck

1. **Product roles required a correctness repair.** The original recheck reproduced false £38 and £62 budget holds for an owned Cloud Cream with a £0 budget and mutually exclusive Cloud Cream/Daily Gel options under £40. The implemented resolver now separates owned products, alternative options and explicit purchase baskets. Follow-up review found and corrected selection-verb/article bypasses, unsupported multiunit quantities and remainder claims borrowed from an unselected alternative. These bounded cases pass the focused tests and independent in-memory recheck; the parser is not general natural-language verification.
2. **The performance workload does not model a large unanswered queue.** The current stress fixture contains one target question and almost one draft per synthetic question. It measures retrieval for one target, not the question list doing that work repeatedly. The supplied ten-product catalogue, short histories and Node environment also limit extrapolation.
3. **There is no measured provider-quality or latency comparison.** The current source supports both providers, but the offline benchmark does not call either. Schema compliance, supplied source IDs and passing local regressions do not establish the correctness of unrestricted natural-language claims or identify a better model for Maya.

### Written rationale for the purchase-context repair

Model each referenced product's role explicitly, keeping linked evidence separate from proposed spending. Charge owned products zero new spend, evaluate alternatives individually and sum only a confirmed purchase basket. If the role is unclear, ask for clarification. Preserve explicit budget corrections, original wording/source references and all existing clinical/evidence holds. This rationale preceded the original repair. Ownership of the bounded follow-up was subsequently transferred to this lane; implementation is now in `purchaseContext.ts` and the relevant `engine.ts` checks. Final aggregate verification is recorded in [TEST-REPORT.md](../../TEST-REPORT.md).

Acceptance cases should include the two reproduced questions above, a confirmed two-product purchase that exceeds budget, mixed owned/new products, a corrected amount, an unknown product and an ambiguous alternative. Compare expected decisions and budget holds first; speed is secondary. The representation and deterministic parser need review before changing stored data or approval logic; the current repair should preserve the existing workspace schema where possible. Provider extraction could later fill the same representation, but only after measured field accuracy, source-span evidence and abstention tests.

The follow-up recognises affirmative choose/pick/recommend/go-for selections, recommend-buying/purchasing phrases and singular articles. Negated or conditional purchase roles remain conservative. Clear product-bound integer counts of two or more, common count words, x/× counts and twice/thrice request quantity clarification; the implementation does not calculate a multiunit basket. Unrelated budget values, routine-step counts and wait periods are not quantities. Explicit answer choices determine spending and remainder checks, while linked product prices remain available as neutral evidence. A shared positive-comparison check excludes “Do not compare” from comparison intent, so the standalone Daily Gel catalogue-facts request no longer gets a false missing-product hold.

Focused command: `./node_modules/.bin/tsx --test tests/purchaseContext.test.ts tests/engine.test.ts` — 44 passed, zero failed. Existing ownership, alternatives, repurchase, clinical, revision, price, source and approval checks remain covered. The independent review reproduced the formerly failing affirmative selections, quantities and remainder claims and confirmed affordable choices and neutral price evidence still pass. These are local in-memory results; no provider response was requested or verified by this lane.

### Current provider algorithm and evidence boundary

`buildAiRequest` sends the catalogue, Maya's notes, relevant issue/case evidence and selected context. Chat includes at most six recent turns, each cut to 2,000 characters. It does not serialise the entire workspace. Handles are masked, but that is not comprehensive removal of personal information. Context reconstruction uses the local rules on user turns rather than treating earlier model assertions as facts. The exact fingerprint covers decision evidence rather than card positions.

The server bounds request bodies at 128 KiB and successful provider response bodies at 256 KiB. It validates a supplied-ID allowlist, schema fields, source/product references and selected prose patterns; the browser then checks current evidence and ordinary draft holds. The provider catalogue is limited to seed IDs, so a structurally valid imported workspace is not automatically compatible with live AI. Claude uses Messages with a transformed JSON schema; OpenAI uses Responses with strict JSON schema. Both still face local validation and return suggestions that require review.

Provider documentation supports the schema mechanism and its limits. Claude documents transforming unsupported constraints into descriptions and validating against the original constraints locally. OpenAI documents structured output schemas and handling responses that do not follow the ordinary success path. These mechanisms justify format checks; their relevance to claim accuracy is limited. [Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

Connection/model checks and answer generation are serialised. The server cancels pending controllers on disconnect/disposal, aborts on a closed response or timeout, and rejects results from an older connection generation. Default local deadlines are 10 seconds for body receipt, 15 seconds for connection checking and 60 seconds for an answer. No retry or cross-provider fallback loop is implemented. This source review does not verify remote cancellation, refund behaviour, account access or successful generation.

## Research limitations and completion

ECMAScript, React, Vite, the Stanford/Cambridge retrieval text, both historical papers and the provider structured-output documentation were rechecked on 20 September 2026. Historical research is cited as a technique reference, not described as a current performance leader. There is no representative follower-question dataset beyond the fictional case file, so no semantic model can be honestly selected as best. The local provider code is covered by this refresh; live provider quality, account acceptance and browser/device performance are not measured here.

The original review completed its written rationale, prioritised tiers, first Quick Win and sixteen targeted tests. This refresh rechecked the maintained logic/server source, refreshed the comparative/core/bundle measurements, and documented then repaired the bounded purchase-context defects. A final paired retrieval benchmark uses the repaired validation path; the earlier core/bundle timings remain dated pre-repair snapshots. The 327 passing checks (190 Node and 137 DOM) and production build are the historical provider-switch baseline. This lane ran the 44 focused checks above, not the full suite. Consult [TEST-REPORT.md](../../TEST-REPORT.md) for the final coordinated aggregate. Deferred ideas remain proposals.


## Source coverage appendix

Read in full for this refresh, in bounded batches:

| Directory | Files |
|---|---|
| `src/lib` | `aiClient.ts`, `aiContext.ts`, `aiTypes.ts`, `canvasNavigation.ts`, `caseEvidence.ts`, `caseEvidenceCanvas.ts`, `chat.ts`, `chatStorage.ts`, `decisionProfile.ts`, `decisionReuse.ts`, `decisionTypes.ts`, `draftHistory.ts`, `engine.ts`, `feedback.ts`, `persona.ts`, `personaReplies.ts`, `publication.ts`, `publicationPreview.ts`, `purchaseContext.ts`, `seed.ts`, `share.ts`, `storage.ts`, `types.ts`, `voiceCommands.ts`, `workspaceValidation.ts` |
| `server` | `aiConfiguration.ts`, `aiServer.ts` |
| `scripts/benchmarks` | `bundle-profile.mjs`, `core-profile.ts`, `decision-reuse.ts` |

Also read: the current `PLAN.md`, both review templates, this report and `PERFORMANCE.md`, `tests/decisionReuseIndex.test.ts`, and `vite.config.ts`; inspected relevant `App.tsx` call sites. The coordinating UI explorer reports the following 34 maintained files read in full, plus README and ARCHITECTURE. This is aggregate review coverage, not a claim that this researcher individually reread each UI file.

Fresh execution includes the three benchmark commands in [PERFORMANCE.md](PERFORMANCE.md), the final paired retrieval rerun, the focused engine/purchase-context command and synthetic decision-context calls described above. `tests/engine.test.ts` and `tests/purchaseContext.test.ts` were also read in full and extended for the bounded follow-up. All work used generated in-memory fixtures and made no provider requests, browser storage changes, server restarts or Git operations.


| Peer UI coverage | Files |
|---|---|
| Entry and shared style | `src/App.tsx`, `src/main.tsx`, `src/styles.css` |
| `src/components` | `AdvicePage.css`, `AdvicePage.tsx`, `AiDraftPreview.tsx`, `AiSettings.css`, `AiSettings.tsx`, `AnswerCanvas.tsx`, `Canvas.css`, `CanvasShell.css`, `CaseEvidenceLibrary.css`, `CaseEvidenceLibrary.tsx`, `ChatPanel.css`, `ChatPanel.tsx`, `DecisionProfile.css`, `DecisionProfile.tsx`, `DraftHistory.css`, `DraftHistory.tsx`, `FollowerFeedback.css`, `FollowerFeedback.tsx`, `PersonaProfile.css`, `PersonaProfile.tsx`, `PublicationPreview.css`, `ReusableAnswers.css`, `ReusableAnswers.tsx`, `VoicePanel.css`, `VoicePanel.tsx`, `WorkspaceRecovery.css`, `WorkspaceRecovery.tsx` |
| Configuration | `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` |

The researcher also read `index.html`, the HTML entry shell. The initial research pass excluded tests beyond the named focused review; the subsequent independent release review closes that aggregate coverage gap below. `purchaseContext.ts`, the final engine changes and their focused tests were read in full by the implementing lane and independently rechecked. Follow-up AI context/chat edits are covered by their implementation owner and the coordinated final review, not retroactively by the original research read-through.

### Aggregate release-review closure

The independent release reviewer read all 39 maintained test files end to end: 20 Node files, 18 DOM files and `setup.ts`, totalling 310,160 bytes at the frozen source snapshot. The manifest below was checked against the directory after the repair. This records peer reading, distinct from this lane's own 44-test execution and the coordinator's final aggregate run.

| Test coverage | Files under `tests/` |
|---|---|
| Node | `aiConfiguration.test.ts`, `aiContext.test.ts`, `aiServer.test.ts`, `audienceAcceptance.test.ts`, `canvasNavigation.test.ts`, `caseEvidence.test.ts`, `chat.test.ts`, `chatStorage.test.ts`, `decision.test.ts`, `decisionReuseIndex.test.ts`, `draftHistory.test.ts`, `engine.test.ts`, `feedback.test.ts`, `personaDrafts.test.ts`, `personaReplies.test.ts`, `publication.test.ts`, `purchaseContext.test.ts`, `share.test.ts`, `storageRecovery.test.ts`, `voiceCommands.test.ts` |
| DOM | `aiSettings.test.tsx`, `aiWorkflow.test.tsx`, `canvasControls.test.tsx`, `canvasShell.test.tsx`, `caseEvidenceWorkflow.test.tsx`, `chatPanel.test.tsx`, `chatWorkflow.test.tsx`, `decisionProfile.test.tsx`, `decisionWorkflow.test.tsx`, `draftHistory.test.tsx`, `feedback.test.tsx`, `improvementWorkflow.test.tsx`, `personaWorkflow.test.tsx`, `publicationWorkflow.test.tsx`, `review.test.tsx`, `storageRecovery.test.tsx`, `voice.test.tsx`, `workflow.test.tsx` |
| Setup | `setup.ts` |

The release reviewer also read `.gitignore`, `.nvmrc`, `package.json`, `tsconfig.json`, `vite.config.ts` and `vitest.config.ts`. `package-lock.json` coverage was limited to metadata, root declarations and the 16 direct dependency versions; generated transitive lock entries were not audited. The reviewer reported no further concrete release blocker in that bounded pass.

Reference PDFs/decks and their extracts, generated builds, `node_modules` dependency code, generated transitive lock entries, private environment files and runtime user data remain outside this code-review inventory. The source coverage does not imply a security audit of dependencies or successful provider, browser or physical audio acceptance. Final test/build results belong to [TEST-REPORT.md](../../TEST-REPORT.md).
