# Algorithmic research

Review date: 20 September 2026. Scope: GoodCall's existing TypeScript logic and data structures, adapting the Researcher brief to the implemented stack. Findings describe the inspected source, not the capabilities of external services. Other work is adding optional AI support; that work is outside this report's implementation scope.

## Written rationale recorded before implementation

The top Quick Win is exact product-set matching in `decisionReuse.ts`. The current key, `sort().join('|')`, is not injective for valid string IDs: `['a|b', 'c']` and `['a', 'b|c']` both become `a|b|c`. Workspace import validation permits these IDs. An unrelated reviewed answer can therefore appear as a reusable starting point. Changing the key to `JSON.stringify([...new Set(ids)].sort())` preserves order independence and duplicate removal while retaining string boundaries. This is an encoding correction, not a change to matching policy. A regression must reproduce the old false match and show that the corrected code rejects it.

The same routine finds the originating question by scanning every question for every candidate draft. An invocation-local `Map` can remove that repeated lookup scan. It must retain the first occurrence of any duplicate ID, matching `Array.find`, although validated workspaces reject duplicates. Build it only when a candidate reaches question lookup, retain draft order, and discard it after the call. Do not cache approval decisions across calls: question text and current evidence must still be rechecked. Measure before adopting the index because tiny libraries may not benefit.

ECMAScript requires average sublinear access for Map; it does not guarantee a particular implementation or constant-time worst case. This justifies testing a keyed lookup here, not declaring all arrays inappropriate. [ECMAScript Map objects](https://tc39.es/ecma262/multipage/keyed-collections.html#sec-map-objects)

The only approved runtime file for this change is `src/lib/decisionReuse.ts`. Both changes were subsequently implemented and verified; results are recorded in [PERFORMANCE.md](PERFORMANCE.md).

### Concurrent AI provenance contract

Before implementing the integration guard, the coordinator confirmed that drafts now permit `mode: 'AI suggestion'` and optional provider/model/generated-at/missing-evidence metadata. Reuse copies reviewed wording, so it must also copy its origin mode and AI metadata rather than relabel it as an evidence template. Copy the nested missing-evidence list to avoid shared mutable state. Keep newly generated question references, product revisions and unapproved status. The ordinary current validator remains authoritative; flagged source drafts are ineligible.

## Core algorithms and data structures

The logic review covers the `src/lib` modules and their component call sites. UI, styling, import validation repairs and network-provider implementation remain separate review lanes. The following is a source-based assessment rather than a claim that every conceivable input has been proved safe.

| Area | Current approach | Fit for the current problem | Evidence-led next step |
|---|---|---|---|
| Question grouping | Ordered regular expressions after case/apostrophe/currency normalisation | Transparent and cheap for five named exercise categories. Rule order defines precedence; it is not semantic understanding. | Preserve the narrow fallback. Create a labelled set of ambiguous and paraphrased questions before choosing a classifier. |
| Product resolution | Catalogue scan and normalised substring checks; explicit ID union; a few source-backed fallback routes | Ten catalogue records do not justify a search service. Source identity must remain exact. | If the catalogue grows, benchmark an alias/token index against current exact outputs; include overlapping names and punctuation. |
| Evidence validation | Deterministic rules, current product revisions, source references, budget parsing and quote/price comparisons | Necessary as a bounded review gate. It is not an arbitrary-document fact checker. Repeated work dominates large reuse sets. | Share immutable per-invocation lookup context only after proving equivalent errors and order. Do not cache approval across evidence changes. |
| Reusable advice | Exact product set, computed question topic, reviewed status and current validation | Appropriate as a suggestion gate. Same topic/products still cannot establish a new follower's suitability. | Product-key correction and local question index implemented. Keep a fresh unapproved draft and current evidence. |
| Chat and voice | Explicit command grammar and local context rules; narrow constraints carried into follow-ups | Predictable for the supported commands. General language generation is a separate optional integration. | Maintain exact action boundaries and evaluate context retention/abstention separately from conversational fluency. |
| Source deduplication | Array filter plus earlier-element search | Quadratic in references, but present reference lists are bounded and small. | Consider a tuple-key Set only if a larger-source benchmark shows material cost; preserve first-reference identity and order. |
| Canvas relationships | Arrays of cards/edges; bounded neighbour expansion and text search | Simple, serialisable and sufficient for the small board. Repeated entity lookups can scale poorly. | An adjacency/entity index is a measured future option. No graph-layout algorithm was changed here; another task owns these files. |
| History and recovery | Bounded snapshots, content comparisons and whole-workspace JSON | Clear rollback semantics; larger histories increase serialisation cost. | Profile edit/save frequency first. Incremental journals require explicit migration and recovery design. |
| Feedback version and public advice | Snapshot fields, a small non-cryptographic version hash, validated encoded snapshots | A local deduplication hint and portable snapshot, not proof of origin or a digital signature. | Any cross-device identity/authenticity design needs a separate contract. No cryptographic claim is added. |

## Quick Wins

1. **Implemented: collision-free product-set keys.** The deterministic regression fails under the former key and passes now. A key must retain string boundaries; a stronger search model would not fix this error.
2. **Implemented: invocation-local question index.** On the paired benchmark's largest mixed-topic fixture the median fell from 41.8151 to 38.1364 ms. This is an 8.8% local CPU-time reduction, with no material difference at small sizes. The full pipeline is still dominated by current-evidence validation. See [method and raw results](PERFORMANCE.md).
3. **Implemented as integration correctness: preserve origin metadata on reuse.** Copy mode/provider metadata with independent nested arrays; never transfer approval. This has behavioural regressions rather than a misleading speed benchmark.

No additional package was installed, no new UI feature was added, and no persistent index migration was introduced.

## Medium Efforts

| Proposed work | Reasoning | Evaluation gate before adoption |
|---|---|---|
| Reusable-answer lookup/validation context | Build question/product maps once per current workspace evaluation; optionally index exact product set plus intent. An inverted index associates terms with matching records, a well-established retrieval structure. Here the keys would be exact structured attributes rather than free text. | Same ordered candidate IDs and identical validation messages across edits, deleted records, revisions and held questions. Benchmark build plus query cost, not query cost alone, at seed, 1,200 and 2,400 questions. |
| Memoise expensive derived work by explicit dependencies | Current question-list and advice-library paths can repeat retrieval/validation during unrelated renders. React documents memoisation as a performance aid, not a correctness guarantee. | Production browser profile showing repeated costs, stable dependency coverage, and regression tests that invalidate results after every question/product/approval change. |
| Separate follower entry from creator canvas code | The measured entry chunk has no dynamic imports; it includes canvas libraries even for a follower card. React lazy supports deferred component loading, and Vite optimises dependencies of dynamic chunks. | Measure bytes, requests, first useful render and error fallback on both routes, including slow network/cache cases. Do not merely split vendor chunks and claim reduced transfer. |
| Reduce save-path repeated serialisation | At 4.76 MB, serialisation and parse/validation each take more than 12 ms in Node. This is a plausible main-thread target at scale. | Browser storage profiling plus crash/reload/restore tests that preserve the current recovery contract. Do not adopt debounce timing without proving what remains durable. |

Primary references: [Stanford/Cambridge introduction to inverted indexes](https://nlp.stanford.edu/IR-book/html/htmledition/an-example-information-retrieval-problem-1.html), [React useMemo](https://react.dev/reference/react/useMemo), [React lazy](https://react.dev/reference/react/lazy), [Vite async chunk loading](https://vite.dev/guide/features.html#async-chunk-loading-optimization). These document mechanisms; the proposed GoodCall benefit remains a hypothesis until its evaluation gate passes.

## Research Bets

**Lexical and semantic retrieval for larger evidence libraries.** Compare exact structured matching, a lexical baseline and sentence embeddings on a labelled GoodCall task set. Sentence-BERT demonstrated sentence embeddings that can be compared with cosine similarity; that makes it a relevant technique, not evidence of suitability for this product. BEIR evaluates retrieval across heterogeneous tasks and reports that simple lexical baselines remain competitive while stronger ranking methods may cost more. Neither paper establishes the best current model for this application. [Sentence-BERT paper](https://arxiv.org/abs/1908.10084), [BEIR paper](https://arxiv.org/abs/2104.08663)

The prototype experiment should rank suggestions only. Keep product identity, follower budget/preferences, safety-related evidence gaps and approval gates explicit. Measure recall@k for genuinely reusable judgements, precision of suggested matches, constraint-conflict rate, abstention, source accuracy, latency, memory and provider cost. Separate training examples from held-out cases. An improvement in wording similarity is insufficient if evidence or follower constraints are lost.

**Structured constraint extraction.** Replace scattered language rules only after defining an intermediate representation for product identity, budget, skin/finish preferences, existing products and unresolved facts. Compare deterministic parsing with schema-constrained model extraction on the same labelled examples, particularly negation, corrections and multiple amounts. Adoption requires fewer incorrect facts and no loss of currently held cases; evaluate source-span provenance and abstention, not just a broad accuracy score. This is a proposed experiment, not an implemented architecture.

**Incremental evidence dependency graph.** Larger collections could track which draft depends on which product revision and source field, then invalidate only affected derived results. The benefit must exceed graph maintenance cost and must survive restore/import, edited sources and deleted entities. Keep full validation as a reference oracle during a prototype. This is a design hypothesis based on the observed repeated work; no evidence graph cache was added in this task.

## Research limitations and completion

Official documentation and the primary papers above were checked on 20 September 2026. Historical research is cited as a technique reference, not described as a current performance leader. There is no representative follower-question dataset beyond the fictional case file, so no semantic model can be honestly selected as best. The live provider work and browser/device acceptance are outside this algorithm change.

Completed: source review, written rationale before implementation, prioritised tiers, top Quick Win, comparative benchmark with output assertions, and sixteen targeted passing tests. Deferred ideas are explicitly research/evaluation work, not claims of completed features.
