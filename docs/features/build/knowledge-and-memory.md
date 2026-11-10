# Knowledge & Memory

Knowledge & Memory shows what agents can retrieve and what they remember: the vector indexes (knowledge bases) they query, with chunking, retrieval and access settings; the sources and ingestion jobs feeding those indexes; the memory stores each agent keeps between turns, with retention and PII policy; and retrieval quality over time, down to individual low-recall queries and a test-retrieval sandbox. Stale sources and low-recall queries are where grounded answers quietly turn into guesses.

Owners of knowledge bases, the people who run ingestion connectors, and the engineers responsible for RAG quality and data retention use this page.

## Where to find it

- Sidebar: Build, Knowledge & Memory. No keyboard chord.
- Route: `/agentops/knowledge`. Tabs sync to `?tab=sources`, `?tab=memory`, `?tab=quality` (Knowledge bases is the default and has no parameter).
- Deep links: `?kb=<kb-id>` opens the knowledge base sheet on the bases tab (`/agentops/knowledge?tab=bases&kb=kb-support-kb`) and pre-filters the Sources tab to that knowledge base; `?mem=<mem-id>` opens a memory store sheet on the Memory tab; `?agent=<agt-id>` pre-selects the Agent facet on the Knowledge bases, Memory and Retrieval quality tabs.
- Code: route `app/(app)/agentops/knowledge/page.tsx` and `loading.tsx`; UI in `features/agentops/knowledge/` (`knowledge-tabs.tsx`, `knowledge-bases.tsx`, `sources.tsx`, `memory.tsx`, `retrieval-quality.tsx`, `test-retrieval.tsx`, `shared.tsx`); client stores in `features/agentops/knowledge/store.ts` (`kbStore`, `sourceStore`, `memoryStore`, `knowledgeTotals`); data in `lib/data/knowledge.ts`.

The stat row, tab counts, tables and sheets read the three stores, so creating a base, pausing a source or forgetting a record moves every number on the page. Nothing is persisted; a reload returns to the seed.

## What is on the page

Header: eyebrow "Build", title "Knowledge & Memory" (from `config/nav.ts`).

Six stat cards (`StatGrid` with six columns, `KnowledgeStats` reading the stores):

| Card                   | Value                                                                | Hint                                                     |
| ---------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| Knowledge bases        | Count                                                                | "N healthy"                                              |
| Documents indexed      | Sum of documents                                                     | "N sources"                                              |
| Chunks                 | Sum of chunks                                                        | "Across all stores"                                      |
| Stale sources          | Sources that are Failed, Paused, or last synced more than 7 days ago | "N failed · paused or not synced in 7 days"              |
| Retrieval hit rate 24h | Today's hit rate in percent, delta in points versus yesterday        |                                                          |
| Memory records         | Sum of records across memory stores                                  | "N long-term stores" (every store that is not `session`) |

Tabs with count pills: Knowledge bases, Sources & ingestion (a brand dot with screen-reader text appears when any ingestion job is Running), Memory, Retrieval quality (count of low-recall queries).

### Knowledge bases tab

Table (click opens the sheet; sr-only caption):

| Column         | Content                                                                                                    | Default                        |
| -------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Knowledge base | Name in mono, warning triangle (with an accessible label) when last sync is older than 7 days, description | shown                          |
| Store          | pgvector, Pinecone, Weaviate, Elasticsearch, Vertex AI Search, Bedrock KB                                  | shown                          |
| Embedding      | Embedding model chip (provider logo for OpenAI, Google, Mistral, Amazon; generic icon otherwise)           | shown                          |
| Documents      | Documents                                                                                                  | shown, default sort descending |
| Chunks         | Chunks                                                                                                     | shown                          |
| Chunking       | `size / overlap · strategy`                                                                                | hidden                         |
| Retrieval      | `top k N · threshold t · BM25 w · rerank · MMR`; header hint explains the terms                            | shown                          |
| Freshness      | Last sync, amber when stale                                                                                | shown                          |
| Agents         | First two attached agents, "+N more"                                                                       | shown                          |
| Size           | GB                                                                                                         | hidden                         |
| Status         | Healthy, Syncing (pulsing), Stale, Error                                                                   | shown                          |
| Owner          | User chip                                                                                                  | hidden                         |

Facets: Store, Status, Agent (attached agents; pre-selected by `?agent=`). Toolbar: "New knowledge base" opens a sheet with Name (id `kb-<slug>`, must be unique), Description, Store and Embedding model; "Create" adds a Healthy, empty index with default chunking (512 / 64, recursive) and retrieval (top k 8, threshold 0.40, BM25 0.30) to the top of the table and opens its sheet.

Knowledge base sheet:

- Header: status badge, store badge, "Stale sync" badge when applicable, id with copy, name, description.
- Metric tiles: Documents, Chunks, Hit rate, p95 latency; a 14-day query sparkline with the total.
- Retrieval settings (Edit button): Top k, Score threshold, BM25 weight, Reranker (model chip or Off), MMR (`On · lambda 0.70` or Off), Embedding (model and dimensions), Chunking.
- Sources: name, `type · connector · schedule label` (source types display through `sourceTypeLabel`, so "ITSM Knowledge" reads "Service knowledge"), document count, status badge.
- Ingestion history: up to 10 jobs (sr-only caption) with Job id, Source, Docs processed/total, Chunks written, Started, Status; an empty state when none.
- Access policy with a "Manage agents" menu: a checkbox per deployed agent adds or removes it from `access.agentIds` with a toast; attached agents (or "No agent can query this index"), direct roles, PII filter on/off, ACL inheritance on/off.
- Owner, Last sync, Size.
- Footer (shared sheet frame): Export config on the left, then Close, Test retrieval, Re-index.

Edit retrieval settings sheet: Top k slider 1 to 20; Score threshold 0 to 1 step 0.01; BM25 weight 0 to 1 step 0.05 (0 dense only, 1 lexical only); Reranker switch (turning it on restores the previous reranker or `cohere/rerank-v3.5`; copy says it adds about 80 ms); Maximal marginal relevance switch with a lambda slider 0 to 1 when on. Reset and Save settings are enabled only when something changed.

### Sources & ingestion tab

Table (sr-only caption):

| Column         | Content                                                                                              | Default                        |
| -------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------ |
| Source         | Type icon, name (linked when the source has an `href`, external links open in a new tab), type label | shown                          |
| Connector      | `confluence-cloud@2.4` style implementation                                                          | hidden                         |
| Knowledge base | Link to `?tab=bases&kb=…`                                                                            | shown                          |
| Documents      | Documents                                                                                            | shown                          |
| Last sync      | Time, red when Failed                                                                                | shown, default sort descending |
| Schedule       | Human label over the crontab expression                                                              | shown                          |
| Status         | Synced, Running (pulsing), Failed, Paused                                                            | shown                          |
| Errors         | Count in red with a tooltip listing the messages                                                     | shown                          |
| Actions        | Sync now (disabled while Running, tooltip says why), Pause or Resume                                 | shown                          |

Facets: Type (Confluence, SharePoint, GitHub, Zendesk, Notion, S3, Website, Service knowledge), Status, Knowledge base. Toolbar: "Add source" opens a sheet with Name, Type, Knowledge base, Schedule (Hourly, Every 6 hours, Daily at 02:00 UTC, Weekly on Monday; the crontab is shown) and an optional link; "Add source" adds a Running source with zero documents to the top of the table. Right side: Ingestion jobs card with a running-count pill and the first 9 jobs: source, `knowledge base · trigger · time ago`, status, progress bar with docs processed/total and chunks written, error line for failed jobs; an empty state when there are none.

### Memory tab

"Right to be forgotten" card: a user id input and "Forget user". Copy states it removes every memory keyed to the user across the user and session stores and records an erasure receipt on the card; a real backend also writes the receipt to the Audit Log. Confirming removes sampled records whose key or summary contains the id, decrements the record counts, and appends a receipt (`erasure-N`, user id, records removed, stores) to an "Erasure receipts · this session" list on the card.

Table (click opens the sheet; sr-only caption; the PII and Hit rate headers carry hint tooltips):

| Column    | Content                                                          | Default                        |
| --------- | ---------------------------------------------------------------- | ------------------------------ |
| Agent     | Agent chip                                                       | shown                          |
| Store     | Name over the `mem-…` id                                         | shown                          |
| Type      | session, user long-term, organisational, episodic, procedural    | shown                          |
| Backend   | Redis, Postgres, Mem0, Letta, Zep                                | shown                          |
| Records   | Count                                                            | shown, default sort descending |
| Avg size  | KB                                                               | hidden                         |
| Retention | TTL as `24h`, `30d`, `1y` or "No expiry"                         | shown                          |
| PII       | redact (amber), encrypt (green), deny (grey)                     | shown                          |
| Writes    | Agent-writable, Curated, Read-only                               | hidden                         |
| Compacted | Last compaction                                                  | shown                          |
| Hit rate  | Score bar; green at or above 60, amber at or above 30, red below | shown                          |

Facets: Type, Backend, PII policy, Agent (pre-selected by `?agent=`).

Memory sheet (shared sheet frame): type, PII, backend and write-policy badges, id with copy, name, agent chip, records and retention. Metric tiles: Records, Avg size, Hit rate, plus a Compacted fact. Sample records (labelled synthetic): key, Pinned badge, who wrote it (agent, curator, import), summary, created date, confidence (green at or above 0.8, amber at or above 0.6, red below), Pin/Unpin, Edit (a dialog that rewrites the summary and marks the record written by curator), Forget (with an 8 second Undo on the toast). Edit and Forget are disabled with a tooltip on read-only stores. Retention policy: Time to live select (1, 7, 14, 30, 90, 180 days, 1 year, No expiry) and "Redact PII on write" switch. Footer: Compact now on the left, then Close and Save policy.

### Retrieval quality tab

Three charts:

- Hit rate & context precision: 14-day lines. Footer gives today's hit rate and the 14-day change in points.
- Chunks retrieved vs used: stacked daily bars, used versus discarded. Footer gives today's used share and the advice to lower top_k or raise the threshold when the discarded share is high.
- Retrieval latency per knowledge base: horizontal bars, p50 / p95 toggle, slowest base emphasised.

Low-recall queries table (queries whose best chunk fell below the knowledge base threshold in the last 48 hours):

| Column         | Content                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Query          | The query text and how many chunks were retrieved                                                                               |
| Agent          | Agent chip                                                                                                                      |
| Knowledge base | Link to the base sheet                                                                                                          |
| Top score      | Best similarity 0 to 1 as a score bar (green at or above 0.60, amber at or above 0.45, red below)                               |
| Outcome        | Fallback answer (amber), Escalated to human (blue), Hallucination flagged (red), No answer (grey), Answered from memory (green) |
| Trace          | Link to `/agentops/traces/tr_…`                                                                                                 |
| When           | Time                                                                                                                            |

Default sort: top score ascending (worst first), page size 10. Facets: Outcome, Knowledge base, Agent. Clicking a row opens the trace.

Test retrieval panel (also reachable from a knowledge base sheet, locked to that base): knowledge base select, query input, "Retrieve". Shows the base's store and a "Top k · Score threshold · BM25 weight · Reranker on · MMR on" summary plus sample queries. Results are ranked by rerank score and capped at top_k. Each result: rank, document title, `source · type`, chunk id, text with matched terms highlighted, "Why this chunk" explanation, Score and Rerank score bars (green at or above 0.65, amber at or above 0.50), and a "Below threshold, not sent to the model" badge when the score is under the base's threshold.

## What to check

### Every day

- Stale sources stat card and the Status facet on Sources. Failed sources: read the Errors tooltip (expired tokens, rate limits, permission changes) and fix the connector before the index drifts further. Paused sources: confirm someone meant it.
- Ingestion jobs card. A Running job stuck at the same progress across visits, or a Failed job with an error line, means the source will be stale tomorrow.
- Retrieval hit rate 24h. A drop of more than 2 points versus yesterday usually follows a failed sync or a retrieval settings change; check the Sources tab and the ingestion history of the affected base.
- Low-recall queries with outcome "Hallucination flagged". Open the trace, then the knowledge base. Either the content is missing from the source or the threshold is too low to stop the model from using weak chunks.
- Knowledge bases with status Error or Syncing for longer than a job should take.

### Every week

- Freshness column: any base older than 7 days (warning triangle) that is not intentionally static. Re-index or fix its sources.
- Chunks retrieved vs used. If the used share is well under half, top_k is too high or the threshold too low for that traffic; every discarded chunk still costs prompt tokens and latency.
- Retrieval latency chart at p95. The slowest base is called out; reranking and large chunks add the most. Compare with the agent's SLO on the Agents page.
- Low-recall queries grouped by knowledge base (facet). Several queries on the same topic are a content gap, not a tuning problem.
- Memory tab: stores with "No expiry" that hold user data (type user long-term or session). In the mock data the no-expiry stores are organisational and procedural, which is the intended shape. A no-expiry user store is a retention finding.
- Memory hit rate below 30 (red) on an agent-writable store. The agent writes memories nobody reads; tighten the write policy or raise the TTL pressure with compaction.
- Sample record confidence below 0.6 and not pinned. Candidates to forget.
- Access policy on bases attached to customer-facing agents: PII filter should be on where the content can contain personal data; ACL inheritance should be on for sources with per-user permissions (SharePoint, Confluence with restricted spaces).

### Before a release or model change

- Embedding model per base. Changing the embedding model requires a full re-index; the Re-index dialog states the model and an order-of-magnitude cost estimate (`chunks / 9000` dollars).
- Retrieval settings versus the new model's context window. A model with a smaller context cannot take the same top_k times chunk size; check the Model Catalog for the context length.
- Test retrieval with the sample queries and the questions from the release's eval set. Results marked "Below threshold" are what the model will not see; if the right chunk is below threshold the setting is too strict.
- Agents attached to each base the release touches. "No agent can query this index" on a base the agent is supposed to use means the access policy was never granted.
- Memory stores of the agent being released: PII policy, write policy and TTL should match what the release notes say the agent stores.

## Actions

All actions update local component state and show a toast unless noted. A reload restores the mock data.

| Action              | Where                        | What happens in this template                                                                                                                                                                          |
| ------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| New knowledge base  | Bases toolbar                | Sheet; adds an empty Healthy index to the store and opens its sheet                                                                                                                                    |
| Manage agents       | KB sheet, Access policy      | Checkbox menu over deployed agents; toggling writes `access.agentIds` and toasts                                                                                                                       |
| Edit, Save settings | KB sheet, retrieval settings | Writes the new `retrieval` config onto the base; toast with the summary. Reset discards the draft                                                                                                      |
| Export config       | KB sheet footer              | Downloads a real JSON file `<name>.kb.json` with id, name, store, embedding, chunking, retrieval, access and the sources (id, type, connector, schedule)                                               |
| Test retrieval      | KB sheet footer              | Opens a nested sheet with the panel locked to the base                                                                                                                                                 |
| Re-index            | KB sheet footer              | Confirmation dialog (documents re-chunked and re-embedded, agents keep serving the current index, cost estimate). Sets status Syncing; the toast says the re-index itself runs in the backend you wire |
| Add source          | Sources toolbar              | Sheet; adds a Running source to the store                                                                                                                                                              |
| Sync now            | Sources row                  | Sets status Running; the toast says the sync itself runs in the connector service you wire                                                                                                             |
| Pause / Resume      | Sources row                  | Sets status Paused / Synced; toast                                                                                                                                                                     |
| Forget user         | Memory tab card              | Confirmation dialog naming the affected stores and agents; removes matching sampled records, decrements counts and appends an erasure receipt to the card; toast reports the counts                    |
| Pin / Unpin record  | Memory sheet                 | Toggles `pinned` on the sample record                                                                                                                                                                  |
| Edit record         | Memory sheet                 | Dialog; saves the new summary and sets `writtenBy` to curator; disabled on read-only stores                                                                                                            |
| Forget record       | Memory sheet                 | Removes the sample record and decrements the record count; the toast offers Undo for 8 seconds; disabled on read-only stores                                                                           |
| Save policy         | Memory sheet                 | Writes `ttlDays` and the PII policy. Turning redaction on sets `redact`; turning it off on a `redact` store sets `encrypt`; other policies are unchanged. Enabled only when something changed          |
| Compact now         | Memory sheet                 | Sets `lastCompaction` to the fixed clock; the toast says the compaction itself runs in the backend you wire                                                                                            |
| Retrieve            | Test retrieval panel         | Runs `searchKnowledgeBase` client-side; no network                                                                                                                                                     |
| p50 / p95           | Retrieval quality            | Switches the latency chart                                                                                                                                                                             |

## Reading the data

Knowledge base fields:

| Field                                | Meaning                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| status                               | Healthy, Syncing, Stale, Error. Independent of the stale warning, which is computed from `lastSync` older than 7 days (`STALE_AFTER_DAYS`) |
| store, embeddingModel, embeddingDims | Vector store, embedding model id, vector dimensions                                                                                        |
| chunking.size, overlap, strategy     | Target chunk size and overlap in tokens; `recursive`, `semantic` or `by-heading`                                                           |
| retrieval.topK                       | Chunks returned to the model after reranking                                                                                               |
| retrieval.hybridWeight               | Weight of the BM25 leg: 0 dense only, 1 lexical only. Exact identifiers favour lexical                                                     |
| retrieval.reranker                   | Cross-encoder model id or null                                                                                                             |
| retrieval.scoreThreshold             | Minimum similarity for a chunk to reach the model, 0 to 1                                                                                  |
| retrieval.mmr, mmrLambda             | Maximal marginal relevance on/off and its relevance versus diversity trade-off                                                             |
| access.agentIds, roles               | Agents allowed to query; roles allowed to query directly                                                                                   |
| access.piiFilter                     | Chunks are scrubbed before reaching the model                                                                                              |
| access.aclInheritance                | Source document permissions enforced per end user at query time                                                                            |
| hitRate                              | Share of queries that returned at least one chunk above threshold                                                                          |
| latency.p50Ms, p95Ms                 | Retrieve plus rerank time                                                                                                                  |
| queries14d                           | Daily query volume                                                                                                                         |

Source and job fields: `KbSourceStatus` is Synced, Running, Failed or Paused; `IngestionJobStatus` is Queued, Running, Completed or Failed; `trigger` is schedule, manual or webhook; `progress` is 0 to 100 with `docsProcessed` derived from it.

Memory store fields: `type` session, user long-term, organisational, episodic, procedural; `backend` Redis, Postgres, Mem0, Letta, Zep; `ttlDays` null means no expiry; `piiPolicy` redact (replace names, emails and ids before storage), encrypt, deny (refuse to store PII); `writePolicy` agent-writable, curated, read-only; `hitRate` share of turns where a memory read contributed to the answer; record `confidence` is 0 to 1 that the memory is still true.

Retrieval quality: `hitRate` and `contextPrecision` are percentages; context precision is the share of retrieved chunks the model actually used. Low-recall `topScore` is the best similarity among retrieved chunks and is compared with the base's `scoreThreshold`.

Test retrieval scoring (a deterministic toy in `searchKnowledgeBase`): query and chunk text are tokenised and stemmed; `overlap` is the share of query terms present in the chunk; a dense score is `0.28 + 0.58 × overlap` with jitter, a lexical score is `0.9 × overlap` with jitter, blended by `hybridWeight`; with a reranker the rerank score adds weight for match density; results sort by rerank score and are cut at top_k; `belowThreshold` is score under the base threshold. The "Why this chunk" text explains which of these applied.

## How the data gets here

Module: `lib/data/knowledge.ts`, seeds 7802 (jobs), 7803 (memory), 7804 (quality).

Types: `KnowledgeBase`, `ChunkingConfig`, `RetrievalConfig`, `KbAccessPolicy`, `KbStore`, `KbStatus`, `ChunkStrategy`, `KbSource`, `KbSourceType`, `KbSourceStatus`, `IngestionJob`, `IngestionJobStatus`, `IngestionTrigger`, `MemoryStore`, `MemoryRecord`, `MemoryType`, `MemoryBackend`, `PiiPolicy`, `MemoryWritePolicy`, `RetrievalDaily`, `LowRecallQuery`, `LowRecallOutcome`, `KbChunk`, `RetrievalResult`.

Exports: `knowledgeBases` (10), `getKnowledgeBase`, `kbSources` (24, ids `src-001`…), `getKbSource`, `ingestionJobs` (built from the source list, ids `job-7001`…), `memoryStores` (12, `mem-…`), `getMemoryStore`, `retrievalDaily` (14 days), `lowRecallQueries` (`lrq-…`, only seeds whose agent has a trace in `lib/data/agentops.ts` are kept, so the trace links resolve), `kbChunks`, `searchKnowledgeBase`, `STALE_AFTER_DAYS`, `isKbStale`, `daysSince`, `kbTotals`.

To wire a backend: return the same types from your vector store, connector service and memory backend; replace the store mutations (`kbStore`, `sourceStore`, `memoryStore` in `store.ts`, called from `knowledge-bases.tsx`, `sources.tsx` and `memory.tsx`) with mutations; replace `searchKnowledgeBase` with a call to the real retriever that returns `RetrievalResult[]` including the explanation; implement the erasure request behind "Forget user" and emit the audit event. The `?kb=`, `?mem=`, `?agent=` and `?tab=` handling in `shared.tsx` (`useQueryParam`) and `knowledge-tabs.tsx` can stay.

## Related pages

- Traces (`/agentops/traces/tr_…`): what the agent did on each low-recall query.
- Agents (`/agentops/agents/agt-…`): which agents are attached to a base or own a memory store.
- Guardrails (`/agentops/guardrails`): PII and data policies that complement the PII filter and memory PII policy.
- Tools & MCP (`/agentops/tools`): retrieval tools such as `search_knowledge` and the filesystem sandbox server.
- Evals & Datasets (`/agentops/evals`): groundedness evaluators that measure the effect of retrieval changes.
- Costs & Budgets (`/agentops/costs`): embedding and re-index spend.
- Audit Log (`/agentops/audit`): memory and retention events.
