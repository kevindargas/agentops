/**
 * Knowledge & Memory — the retrieval and memory infrastructure agents use:
 * vector indexes, ingestion sources and jobs, per-agent memory stores and
 * retrieval-quality telemetry. Distinct from the human-facing ITSM knowledge
 * base in `catalog.ts` (`knowledgeArticles`), which is one of the sources here.
 *
 * Everything is deterministic (seed 7801) and anchored to NOW.
 */

import { agentTraces } from "./agentops"
import { knowledgeArticles } from "./catalog"
import { NOW, createRng, daysAgo, hoursAgo, int } from "./seed"

/* ------------------------------------------------------------------------ */
/* Types                                                                     */
/* ------------------------------------------------------------------------ */

export type KbStore =
  | "pgvector"
  | "Pinecone"
  | "Weaviate"
  | "Elasticsearch"
  | "Vertex AI Search"
  | "Bedrock KB"

export type KbStatus = "Healthy" | "Syncing" | "Stale" | "Error"
export type ChunkStrategy = "recursive" | "semantic" | "by-heading"

export interface ChunkingConfig {
  /** Target chunk size in tokens. */
  size: number
  /** Overlap between neighbouring chunks in tokens. */
  overlap: number
  strategy: ChunkStrategy
}

export interface RetrievalConfig {
  topK: number
  /** Weight of the BM25 leg in hybrid search, 0 = dense only, 1 = lexical only. */
  hybridWeight: number
  /** Cross-encoder used to rerank the candidate set, or null for none. */
  reranker: string | null
  /** Minimum similarity for a chunk to reach the model, 0–1. */
  scoreThreshold: number
  /** Maximal marginal relevance to diversify the result set. */
  mmr: boolean
  mmrLambda: number
}

export interface KbAccessPolicy {
  agentIds: string[]
  /** Strip PII from chunks before they reach the model. */
  piiFilter: boolean
  /** Enforce source document ACLs per end user at query time. */
  aclInheritance: boolean
  /** Roles allowed to query directly (outside agents). */
  roles: string[]
}

export interface KnowledgeBase {
  id: string
  name: string
  description: string
  store: KbStore
  /** OpenRouter-style embedding model id, e.g. `openai/text-embedding-3-large`. */
  embeddingModel: string
  embeddingDims: number
  documents: number
  chunks: number
  chunking: ChunkingConfig
  retrieval: RetrievalConfig
  access: KbAccessPolicy
  lastSync: string
  sizeGb: number
  status: KbStatus
  ownerId: string
  /** Query volume per day for the last 14 days. */
  queries14d: number[]
  /** Share of queries that returned at least one chunk above threshold. */
  hitRate: number
  latency: { p50Ms: number; p95Ms: number }
  createdAt: string
}

export type KbSourceType =
  | "Confluence"
  | "SharePoint"
  | "GitHub"
  | "Zendesk"
  | "Notion"
  | "S3"
  | "Website"
  | "ITSM Knowledge"

export type KbSourceStatus = "Synced" | "Running" | "Failed" | "Paused"

export interface KbSource {
  id: string
  name: string
  type: KbSourceType
  /** Connector implementation, e.g. `confluence-cloud@2.4`. */
  connector: string
  kbId: string
  documents: number
  lastSync: string
  /** Crontab expression. */
  schedule: string
  scheduleLabel: string
  status: KbSourceStatus
  errors: string[]
  /** Internal route or external URL for the source. */
  href?: string
}

export type IngestionJobStatus = "Queued" | "Running" | "Completed" | "Failed"
export type IngestionTrigger = "schedule" | "manual" | "webhook"

export interface IngestionJob {
  id: string
  kbId: string
  sourceId: string
  status: IngestionJobStatus
  trigger: IngestionTrigger
  startedAt: string
  finishedAt?: string
  docsTotal: number
  docsProcessed: number
  chunksWritten: number
  /** 0–100. */
  progress: number
  error?: string
}

export type MemoryType =
  "session" | "user long-term" | "organisational" | "episodic" | "procedural"
export type MemoryBackend = "Redis" | "Postgres" | "Mem0" | "Letta" | "Zep"
export type PiiPolicy = "redact" | "encrypt" | "deny"
export type MemoryWritePolicy = "agent-writable" | "curated" | "read-only"

export interface MemoryRecord {
  id: string
  key: string
  summary: string
  created: string
  /** 0–1 confidence the memory is still true. */
  confidence: number
  pinned: boolean
  /** Source that wrote the memory. */
  writtenBy: "agent" | "curator" | "import"
}

export interface MemoryStore {
  id: string
  agentId: string
  name: string
  type: MemoryType
  backend: MemoryBackend
  records: number
  avgSizeKb: number
  /** Null means no expiry. */
  ttlDays: number | null
  piiPolicy: PiiPolicy
  writePolicy: MemoryWritePolicy
  lastCompaction: string
  /** Share of turns where a memory read contributed to the answer. */
  hitRate: number
  /** Deterministic sample used by the detail sheet. Synthetic data only. */
  sample: MemoryRecord[]
}

export interface RetrievalDaily {
  date: string
  queries: number
  /** Percent, 0–100. */
  hitRate: number
  /** Percent, 0–100. */
  contextPrecision: number
  chunksRetrieved: number
  chunksUsed: number
}

export type LowRecallOutcome =
  | "Fallback answer"
  | "Escalated to human"
  | "Hallucination flagged"
  | "No answer"
  | "Answered from memory"

export interface LowRecallQuery {
  id: string
  query: string
  agentId: string
  kbId: string
  traceId: string
  /** Best similarity among retrieved chunks, 0–1. */
  topScore: number
  retrieved: number
  outcome: LowRecallOutcome
  at: string
}

export interface KbChunk {
  id: string
  kbId: string
  sourceId: string
  docTitle: string
  text: string
}

export interface RetrievalResult {
  chunk: KbChunk
  /** Dense/hybrid similarity, 0–1. */
  score: number
  /** Score after the cross-encoder reranker, 0–1. */
  rerankScore: number
  matchedTerms: string[]
  belowThreshold: boolean
  why: string
}

/* ------------------------------------------------------------------------ */
/* Seed                                                                      */
/* ------------------------------------------------------------------------ */

const rng = createRng(7801)

function series(len: number, base: number, spread: number) {
  return Array.from({ length: len }, () =>
    Math.max(0, Math.round(base + (rng() - 0.5) * 2 * spread))
  )
}

/* ------------------------------------------------------------------------ */
/* Knowledge bases                                                           */
/* ------------------------------------------------------------------------ */

const openaiLarge = "openai/text-embedding-3-large"
const openaiSmall = "openai/text-embedding-3-small"
const geminiEmbed = "google/gemini-embedding-001"
const voyage = "voyage/voyage-3"
const cohere = "cohere/embed-v4"
const titan = "amazon/titan-embed-text-v2"

const rerankCohere = "cohere/rerank-v3.5"
const rerankBge = "baai/bge-reranker-v2-m3"

export const knowledgeBases: KnowledgeBase[] = [
  {
    id: "kb-support-kb",
    name: "support-kb",
    description:
      "Customer support help-center articles and Zendesk macros used to draft first replies.",
    store: "Pinecone",
    embeddingModel: openaiLarge,
    embeddingDims: 3072,
    documents: 4812,
    chunks: 61_390,
    chunking: { size: 512, overlap: 64, strategy: "recursive" },
    retrieval: {
      topK: 8,
      hybridWeight: 0.3,
      reranker: rerankCohere,
      scoreThreshold: 0.62,
      mmr: true,
      mmrLambda: 0.7,
    },
    access: {
      agentIds: ["agt-support-triage", "agt-kb-curator"],
      piiFilter: true,
      aclInheritance: false,
      roles: ["support-agent", "support-lead"],
    },
    lastSync: hoursAgo(1.4),
    sizeGb: 2.8,
    status: "Healthy",
    ownerId: "u-003",
    queries14d: series(14, 3200, 500),
    hitRate: 93.4,
    latency: { p50Ms: 142, p95Ms: 410 },
    createdAt: daysAgo(412),
  },
  {
    id: "kb-it-runbooks",
    name: "it-runbooks",
    description:
      "Operational runbooks, on-call playbooks and remediation steps from Confluence and the ops GitHub repos.",
    store: "pgvector",
    embeddingModel: openaiLarge,
    embeddingDims: 3072,
    documents: 1_936,
    chunks: 28_740,
    chunking: { size: 800, overlap: 120, strategy: "by-heading" },
    retrieval: {
      topK: 6,
      hybridWeight: 0.45,
      reranker: rerankBge,
      scoreThreshold: 0.58,
      mmr: false,
      mmrLambda: 0.5,
    },
    access: {
      agentIds: ["agt-it-helpdesk", "agt-ops-analyst", "agt-alert-correlator"],
      piiFilter: false,
      aclInheritance: true,
      roles: ["sre", "it-ops"],
    },
    lastSync: hoursAgo(5.2),
    sizeGb: 1.4,
    status: "Healthy",
    ownerId: "u-005",
    queries14d: series(14, 1850, 350),
    hitRate: 90.1,
    latency: { p50Ms: 96, p95Ms: 290 },
    createdAt: daysAgo(380),
  },
  {
    id: "kb-policy-handbook",
    name: "policy-handbook",
    description:
      "HR policies, benefits guides and the employee handbook, versioned per country.",
    store: "Vertex AI Search",
    embeddingModel: geminiEmbed,
    embeddingDims: 3072,
    documents: 642,
    chunks: 9_812,
    chunking: { size: 1024, overlap: 128, strategy: "semantic" },
    retrieval: {
      topK: 5,
      hybridWeight: 0.2,
      reranker: null,
      scoreThreshold: 0.7,
      mmr: false,
      mmrLambda: 0.5,
    },
    access: {
      agentIds: ["agt-hr-answers"],
      piiFilter: true,
      aclInheritance: true,
      roles: ["hr-partner"],
    },
    lastSync: hoursAgo(26),
    sizeGb: 0.6,
    status: "Healthy",
    ownerId: "u-012",
    queries14d: series(14, 940, 220),
    hitRate: 95.2,
    latency: { p50Ms: 188, p95Ms: 520 },
    createdAt: daysAgo(300),
  },
  {
    id: "kb-change-history",
    name: "change-history",
    description:
      "Closed changes, CAB minutes and implementation notes, indexed for risk precedent lookups.",
    store: "Elasticsearch",
    embeddingModel: openaiSmall,
    embeddingDims: 1536,
    documents: 7_420,
    chunks: 44_210,
    chunking: { size: 400, overlap: 40, strategy: "recursive" },
    retrieval: {
      topK: 10,
      hybridWeight: 0.6,
      reranker: rerankCohere,
      scoreThreshold: 0.55,
      mmr: true,
      mmrLambda: 0.6,
    },
    access: {
      agentIds: ["agt-change-risk", "agt-ops-analyst"],
      piiFilter: false,
      aclInheritance: false,
      roles: ["change-manager", "cab"],
    },
    lastSync: hoursAgo(0.6),
    sizeGb: 3.1,
    status: "Healthy",
    ownerId: "u-007",
    queries14d: series(14, 720, 160),
    hitRate: 88.7,
    latency: { p50Ms: 120, p95Ms: 380 },
    createdAt: daysAgo(260),
  },
  {
    id: "kb-product-docs",
    name: "product-docs",
    description:
      "Public product documentation and API reference, pulled from the docs site and the docs repo.",
    store: "Weaviate",
    embeddingModel: voyage,
    embeddingDims: 1024,
    documents: 2_310,
    chunks: 35_880,
    chunking: { size: 600, overlap: 80, strategy: "by-heading" },
    retrieval: {
      topK: 8,
      hybridWeight: 0.35,
      reranker: rerankBge,
      scoreThreshold: 0.6,
      mmr: true,
      mmrLambda: 0.75,
    },
    access: {
      agentIds: ["agt-support-triage", "agt-it-helpdesk"],
      piiFilter: false,
      aclInheritance: false,
      roles: ["everyone"],
    },
    lastSync: hoursAgo(3.1),
    sizeGb: 1.9,
    status: "Healthy",
    ownerId: "u-009",
    queries14d: series(14, 2600, 420),
    hitRate: 91.8,
    latency: { p50Ms: 110, p95Ms: 330 },
    createdAt: daysAgo(340),
  },
  {
    id: "kb-finance-glossary",
    name: "finance-glossary",
    description:
      "Finance definitions, close calendar and cost-center mappings maintained by FP&A in Notion.",
    store: "pgvector",
    embeddingModel: cohere,
    embeddingDims: 1536,
    documents: 318,
    chunks: 2_940,
    chunking: { size: 300, overlap: 30, strategy: "semantic" },
    retrieval: {
      topK: 4,
      hybridWeight: 0.5,
      reranker: null,
      scoreThreshold: 0.65,
      mmr: false,
      mmrLambda: 0.5,
    },
    access: {
      agentIds: ["agt-finance-copilot"],
      piiFilter: false,
      aclInheritance: true,
      roles: ["finance"],
    },
    lastSync: hoursAgo(14),
    sizeGb: 0.2,
    status: "Healthy",
    ownerId: "u-016",
    queries14d: series(14, 410, 90),
    hitRate: 94.6,
    latency: { p50Ms: 84, p95Ms: 240 },
    createdAt: daysAgo(190),
  },
  {
    id: "kb-incident-postmortems",
    name: "incident-postmortems",
    description:
      "Major-incident postmortems and RCA documents, used for alert correlation and change-risk precedent.",
    store: "Bedrock KB",
    embeddingModel: titan,
    embeddingDims: 1024,
    documents: 486,
    chunks: 12_630,
    chunking: { size: 1024, overlap: 160, strategy: "by-heading" },
    retrieval: {
      topK: 6,
      hybridWeight: 0.4,
      reranker: rerankCohere,
      scoreThreshold: 0.6,
      mmr: true,
      mmrLambda: 0.65,
    },
    access: {
      agentIds: ["agt-ops-analyst", "agt-alert-correlator", "agt-change-risk"],
      piiFilter: true,
      aclInheritance: false,
      roles: ["sre", "incident-commander"],
    },
    lastSync: daysAgo(11),
    sizeGb: 0.9,
    status: "Stale",
    ownerId: "u-005",
    queries14d: series(14, 530, 140),
    hitRate: 81.3,
    latency: { p50Ms: 210, p95Ms: 690 },
    createdAt: daysAgo(420),
  },
  {
    id: "kb-sales-playbook",
    name: "sales-playbook",
    description:
      "Sales enablement decks, battlecards and pricing guidance. Shared with support for upgrade questions.",
    store: "Pinecone",
    embeddingModel: openaiSmall,
    embeddingDims: 1536,
    documents: 1_140,
    chunks: 15_320,
    chunking: { size: 512, overlap: 64, strategy: "recursive" },
    retrieval: {
      topK: 6,
      hybridWeight: 0.25,
      reranker: null,
      scoreThreshold: 0.6,
      mmr: false,
      mmrLambda: 0.5,
    },
    access: {
      agentIds: ["agt-support-triage"],
      piiFilter: true,
      aclInheritance: true,
      roles: ["sales", "support-lead"],
    },
    lastSync: daysAgo(3),
    sizeGb: 1.1,
    status: "Error",
    ownerId: "u-019",
    queries14d: series(14, 260, 80),
    hitRate: 76.9,
    latency: { p50Ms: 160, p95Ms: 540 },
    createdAt: daysAgo(150),
  },
  {
    id: "kb-itsm-knowledge",
    name: "itsm-knowledge",
    description:
      "The internal ITSM knowledge base (/itsm/knowledge): published IT, HR, Facilities and Security articles.",
    store: "pgvector",
    embeddingModel: openaiLarge,
    embeddingDims: 3072,
    documents: knowledgeArticles.length,
    chunks: knowledgeArticles.length * 9,
    chunking: { size: 512, overlap: 64, strategy: "by-heading" },
    retrieval: {
      topK: 5,
      hybridWeight: 0.4,
      reranker: rerankBge,
      scoreThreshold: 0.6,
      mmr: false,
      mmrLambda: 0.5,
    },
    access: {
      agentIds: ["agt-it-helpdesk", "agt-hr-answers", "agt-kb-curator"],
      piiFilter: false,
      aclInheritance: true,
      roles: ["everyone"],
    },
    lastSync: hoursAgo(0.2),
    sizeGb: 0.1,
    status: "Syncing",
    ownerId: "u-005",
    queries14d: series(14, 1420, 300),
    hitRate: 92.3,
    latency: { p50Ms: 78, p95Ms: 230 },
    createdAt: daysAgo(210),
  },
  {
    id: "kb-vendor-contracts",
    name: "vendor-contracts",
    description:
      "Executed vendor contracts, renewal terms and SLAs. Restricted; PII and commercial terms are filtered.",
    store: "Bedrock KB",
    embeddingModel: titan,
    embeddingDims: 1024,
    documents: 274,
    chunks: 8_120,
    chunking: { size: 1024, overlap: 200, strategy: "semantic" },
    retrieval: {
      topK: 4,
      hybridWeight: 0.5,
      reranker: rerankCohere,
      scoreThreshold: 0.72,
      mmr: false,
      mmrLambda: 0.5,
    },
    access: {
      agentIds: ["agt-finance-copilot"],
      piiFilter: true,
      aclInheritance: true,
      roles: ["procurement", "legal"],
    },
    lastSync: hoursAgo(31),
    sizeGb: 0.7,
    status: "Healthy",
    ownerId: "u-016",
    queries14d: series(14, 140, 40),
    hitRate: 89.9,
    latency: { p50Ms: 230, p95Ms: 720 },
    createdAt: daysAgo(120),
  },
]

export function getKnowledgeBase(id: string) {
  return knowledgeBases.find((k) => k.id === id)
}

/* ------------------------------------------------------------------------ */
/* Sources                                                                   */
/* ------------------------------------------------------------------------ */

type SourceSeed = Omit<KbSource, "id" | "lastSync" | "documents"> & {
  syncHoursAgo: number
  documents: number
}

const sourceSeeds: SourceSeed[] = [
  {
    name: "Help Center (public)",
    type: "Zendesk",
    connector: "zendesk-guide@1.8",
    kbId: "kb-support-kb",
    documents: 3_120,
    syncHoursAgo: 1.4,
    schedule: "0 */2 * * *",
    scheduleLabel: "Every 2 hours",
    status: "Synced",
    errors: [],
    href: "https://support.example.com/hc",
  },
  {
    name: "Zendesk macros",
    type: "Zendesk",
    connector: "zendesk-support@1.8",
    kbId: "kb-support-kb",
    documents: 1_692,
    syncHoursAgo: 1.5,
    schedule: "0 */2 * * *",
    scheduleLabel: "Every 2 hours",
    status: "Synced",
    errors: [],
  },
  {
    name: "IT Operations (OPS)",
    type: "Confluence",
    connector: "confluence-cloud@2.4",
    kbId: "kb-it-runbooks",
    documents: 1_240,
    syncHoursAgo: 5.2,
    schedule: "0 */6 * * *",
    scheduleLabel: "Every 6 hours",
    status: "Synced",
    errors: [],
    href: "https://wiki.example.com/spaces/OPS",
  },
  {
    name: "platform/runbooks",
    type: "GitHub",
    connector: "github-app@3.1",
    kbId: "kb-it-runbooks",
    documents: 412,
    syncHoursAgo: 0.9,
    schedule: "webhook",
    scheduleLabel: "On push (webhook)",
    status: "Synced",
    errors: [],
    href: "https://github.com/example/runbooks",
  },
  {
    name: "sre/oncall-playbooks",
    type: "GitHub",
    connector: "github-app@3.1",
    kbId: "kb-it-runbooks",
    documents: 284,
    syncHoursAgo: 19,
    schedule: "webhook",
    scheduleLabel: "On push (webhook)",
    status: "Failed",
    errors: [
      "403 Forbidden: installation token lacks `contents:read` on sre/oncall-playbooks",
      "Skipped 12 files > 2 MB (binary attachments)",
    ],
    href: "https://github.com/example/oncall-playbooks",
  },
  {
    name: "People Ops – Policies",
    type: "SharePoint",
    connector: "sharepoint-graph@2.0",
    kbId: "kb-policy-handbook",
    documents: 418,
    syncHoursAgo: 26,
    schedule: "0 2 * * *",
    scheduleLabel: "Daily at 02:00",
    status: "Synced",
    errors: [],
  },
  {
    name: "Benefits guides (per country)",
    type: "SharePoint",
    connector: "sharepoint-graph@2.0",
    kbId: "kb-policy-handbook",
    documents: 224,
    syncHoursAgo: 26,
    schedule: "0 2 * * *",
    scheduleLabel: "Daily at 02:00",
    status: "Synced",
    errors: ["3 documents skipped: password-protected PDF"],
  },
  {
    name: "Closed changes (CHG)",
    type: "ITSM Knowledge",
    connector: "itsm-export@1.2",
    kbId: "kb-change-history",
    documents: 6_980,
    syncHoursAgo: 0.6,
    schedule: "*/30 * * * *",
    scheduleLabel: "Every 30 minutes",
    status: "Synced",
    errors: [],
    href: "/itsm/changes",
  },
  {
    name: "CAB minutes",
    type: "Confluence",
    connector: "confluence-cloud@2.4",
    kbId: "kb-change-history",
    documents: 440,
    syncHoursAgo: 7,
    schedule: "0 */12 * * *",
    scheduleLabel: "Every 12 hours",
    status: "Synced",
    errors: [],
  },
  {
    name: "docs.example.com",
    type: "Website",
    connector: "web-crawler@0.9",
    kbId: "kb-product-docs",
    documents: 1_860,
    syncHoursAgo: 3.1,
    schedule: "0 */4 * * *",
    scheduleLabel: "Every 4 hours",
    status: "Synced",
    errors: ["Rate limited on 14 pages (429), retried next run"],
    href: "https://docs.example.com",
  },
  {
    name: "example/docs",
    type: "GitHub",
    connector: "github-app@3.1",
    kbId: "kb-product-docs",
    documents: 450,
    syncHoursAgo: 0.4,
    schedule: "webhook",
    scheduleLabel: "On push (webhook)",
    status: "Running",
    errors: [],
    href: "https://github.com/example/docs",
  },
  {
    name: "FP&A Glossary",
    type: "Notion",
    connector: "notion-api@1.5",
    kbId: "kb-finance-glossary",
    documents: 212,
    syncHoursAgo: 14,
    schedule: "0 */12 * * *",
    scheduleLabel: "Every 12 hours",
    status: "Synced",
    errors: [],
  },
  {
    name: "Close calendar & cost centers",
    type: "Notion",
    connector: "notion-api@1.5",
    kbId: "kb-finance-glossary",
    documents: 106,
    syncHoursAgo: 14,
    schedule: "0 */12 * * *",
    scheduleLabel: "Every 12 hours",
    status: "Synced",
    errors: [],
  },
  {
    name: "Postmortems (PM)",
    type: "Confluence",
    connector: "confluence-cloud@2.4",
    kbId: "kb-incident-postmortems",
    documents: 392,
    syncHoursAgo: 11 * 24,
    schedule: "0 3 * * *",
    scheduleLabel: "Daily at 03:00",
    status: "Paused",
    errors: ["Paused by u-005 pending Confluence API token rotation"],
  },
  {
    name: "s3://rca-archive",
    type: "S3",
    connector: "s3-bucket@1.1",
    kbId: "kb-incident-postmortems",
    documents: 94,
    syncHoursAgo: 11 * 24,
    schedule: "0 3 * * 0",
    scheduleLabel: "Weekly on Sunday 03:00",
    status: "Paused",
    errors: [],
  },
  {
    name: "Sales Enablement",
    type: "Notion",
    connector: "notion-api@1.5",
    kbId: "kb-sales-playbook",
    documents: 680,
    syncHoursAgo: 3 * 24,
    schedule: "0 1 * * *",
    scheduleLabel: "Daily at 01:00",
    status: "Failed",
    errors: [
      "Notion integration token revoked (401 unauthorized)",
      "Embedding batch 41/58 failed: 429 rate limit from openai",
    ],
  },
  {
    name: "Pricing & battlecards",
    type: "SharePoint",
    connector: "sharepoint-graph@2.0",
    kbId: "kb-sales-playbook",
    documents: 460,
    syncHoursAgo: 3 * 24,
    schedule: "0 1 * * *",
    scheduleLabel: "Daily at 01:00",
    status: "Failed",
    errors: ["Site collection moved; 460 documents returned 404"],
  },
  {
    name: "ITSM knowledge articles",
    type: "ITSM Knowledge",
    connector: "itsm-knowledge@1.2",
    kbId: "kb-itsm-knowledge",
    documents: knowledgeArticles.length,
    syncHoursAgo: 0.2,
    schedule: "*/15 * * * *",
    scheduleLabel: "Every 15 minutes",
    status: "Running",
    errors: [],
    href: "/itsm/knowledge",
  },
  {
    name: "Procurement – Contracts",
    type: "SharePoint",
    connector: "sharepoint-graph@2.0",
    kbId: "kb-vendor-contracts",
    documents: 274,
    syncHoursAgo: 31,
    schedule: "0 4 * * *",
    scheduleLabel: "Daily at 04:00",
    status: "Synced",
    errors: [],
  },
  {
    name: "status.example.com",
    type: "Website",
    connector: "web-crawler@0.9",
    kbId: "kb-incident-postmortems",
    documents: 128,
    syncHoursAgo: 2.2,
    schedule: "0 * * * *",
    scheduleLabel: "Hourly",
    status: "Synced",
    errors: [],
    href: "https://status.example.com/history",
  },
  {
    name: "Architecture decision records",
    type: "GitHub",
    connector: "github-app@3.1",
    kbId: "kb-it-runbooks",
    documents: 96,
    syncHoursAgo: 40,
    schedule: "0 */12 * * *",
    scheduleLabel: "Every 12 hours",
    status: "Synced",
    errors: [],
    href: "https://github.com/example/adr",
  },
  {
    name: "Security – Standards",
    type: "Confluence",
    connector: "confluence-cloud@2.4",
    kbId: "kb-policy-handbook",
    documents: 72,
    syncHoursAgo: 26,
    schedule: "0 2 * * *",
    scheduleLabel: "Daily at 02:00",
    status: "Synced",
    errors: [],
  },
  {
    name: "API changelog",
    type: "Website",
    connector: "web-crawler@0.9",
    kbId: "kb-product-docs",
    documents: 210,
    syncHoursAgo: 9,
    schedule: "0 */8 * * *",
    scheduleLabel: "Every 8 hours",
    status: "Synced",
    errors: [],
    href: "https://docs.example.com/changelog",
  },
  {
    name: "s3://contracts-archive",
    type: "S3",
    connector: "s3-bucket@1.1",
    kbId: "kb-vendor-contracts",
    documents: 58,
    syncHoursAgo: 31,
    schedule: "0 4 * * 1",
    scheduleLabel: "Weekly on Monday 04:00",
    status: "Synced",
    errors: [],
  },
]

export const kbSources: KbSource[] = sourceSeeds.map((s, i) => {
  const { syncHoursAgo, ...rest } = s
  return {
    ...rest,
    id: `src-${String(i + 1).padStart(3, "0")}`,
    lastSync: hoursAgo(syncHoursAgo),
  }
})

export function getKbSource(id: string) {
  return kbSources.find((s) => s.id === id)
}

/* ------------------------------------------------------------------------ */
/* Ingestion jobs                                                            */
/* ------------------------------------------------------------------------ */

const jobRng = createRng(7802)

function buildJobs(): IngestionJob[] {
  const out: IngestionJob[] = []
  let n = 0
  const push = (
    source: KbSource,
    status: IngestionJobStatus,
    trigger: IngestionTrigger,
    startedHoursAgo: number,
    opts: { progress?: number; error?: string; durationMin?: number } = {}
  ) => {
    n += 1
    const total = source.documents
    const progress =
      status === "Completed"
        ? 100
        : status === "Queued"
          ? 0
          : (opts.progress ?? int(jobRng, 10, 90))
    const processed = Math.round((total * progress) / 100)
    const duration = opts.durationMin ?? int(jobRng, 3, 40)
    out.push({
      id: `job-${String(7000 + n)}`,
      kbId: source.kbId,
      sourceId: source.id,
      status,
      trigger,
      startedAt: hoursAgo(startedHoursAgo),
      finishedAt:
        status === "Completed" || status === "Failed"
          ? hoursAgo(Math.max(0, startedHoursAgo - duration / 60))
          : undefined,
      docsTotal: total,
      docsProcessed: processed,
      chunksWritten: Math.round(processed * (8 + jobRng() * 6)),
      progress,
      error: opts.error,
    })
  }

  const byName = (name: string) => kbSources.find((s) => s.name === name)!

  push(byName("ITSM knowledge articles"), "Running", "schedule", 0.2, {
    progress: 64,
  })
  push(byName("example/docs"), "Running", "webhook", 0.4, { progress: 31 })
  push(byName("Closed changes (CHG)"), "Queued", "schedule", 0.05)
  push(byName("Closed changes (CHG)"), "Completed", "schedule", 0.6, {
    durationMin: 6,
  })
  push(byName("platform/runbooks"), "Completed", "webhook", 0.9, {
    durationMin: 4,
  })
  push(byName("Help Center (public)"), "Completed", "schedule", 1.4, {
    durationMin: 18,
  })
  push(byName("Zendesk macros"), "Completed", "schedule", 1.5, {
    durationMin: 9,
  })
  push(byName("status.example.com"), "Completed", "schedule", 2.2, {
    durationMin: 3,
  })
  push(byName("docs.example.com"), "Completed", "schedule", 3.1, {
    durationMin: 26,
  })
  push(byName("IT Operations (OPS)"), "Completed", "schedule", 5.2, {
    durationMin: 21,
  })
  push(byName("API changelog"), "Completed", "schedule", 9, {
    durationMin: 5,
  })
  push(byName("FP&A Glossary"), "Completed", "manual", 14, { durationMin: 4 })
  push(byName("sre/oncall-playbooks"), "Failed", "webhook", 19, {
    progress: 12,
    durationMin: 2,
    error: "403 Forbidden: installation token lacks contents:read",
  })
  push(byName("People Ops – Policies"), "Completed", "schedule", 26, {
    durationMin: 12,
  })
  push(byName("Procurement – Contracts"), "Completed", "schedule", 31, {
    durationMin: 15,
  })
  push(byName("Sales Enablement"), "Failed", "schedule", 72, {
    progress: 70,
    durationMin: 32,
    error: "Embedding batch 41/58 failed: 429 rate limit",
  })
  push(byName("Pricing & battlecards"), "Failed", "schedule", 72.1, {
    progress: 0,
    durationMin: 1,
    error: "Site collection moved (404)",
  })
  push(byName("Postmortems (PM)"), "Completed", "schedule", 11 * 24, {
    durationMin: 17,
  })
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export const ingestionJobs: IngestionJob[] = buildJobs()

/* ------------------------------------------------------------------------ */
/* Memory stores                                                             */
/* ------------------------------------------------------------------------ */

const memRng = createRng(7803)

function sample(
  id: string,
  rows: [key: string, summary: string, daysOld: number, pinned?: boolean][]
): MemoryRecord[] {
  return rows.map(([key, summary, daysOld, pinned], i) => ({
    id: `${id}-r${i + 1}`,
    key,
    summary,
    created: daysAgo(daysOld + memRng() * 0.8),
    confidence: Math.round((0.55 + memRng() * 0.44) * 100) / 100,
    pinned: pinned ?? false,
    writtenBy: pinned ? "curator" : memRng() < 0.15 ? "import" : "agent",
  }))
}

export const memoryStores: MemoryStore[] = [
  {
    id: "mem-triage-session",
    agentId: "agt-support-triage",
    name: "Conversation state",
    type: "session",
    backend: "Redis",
    records: 18_420,
    avgSizeKb: 6.2,
    ttlDays: 1,
    piiPolicy: "encrypt",
    writePolicy: "agent-writable",
    lastCompaction: hoursAgo(2),
    hitRate: 97.8,
    sample: sample("mem-triage-session", [
      [
        "ses_48213/intent",
        "Customer asking about a duplicate invoice charge on plan Pro; already checked billing portal.",
        0.01,
      ],
      [
        "ses_48213/entities",
        "Account acct_7f2a (synthetic), invoice INV-20261104-0031, amount $240.",
        0.01,
      ],
      [
        "ses_48190/tone",
        "Frustrated after two prior replies; prefers short answers, no links.",
        0.03,
      ],
    ]),
  },
  {
    id: "mem-triage-user",
    agentId: "agt-support-triage",
    name: "Customer preferences",
    type: "user long-term",
    backend: "Mem0",
    records: 41_380,
    avgSizeKb: 1.1,
    ttlDays: 365,
    piiPolicy: "redact",
    writePolicy: "agent-writable",
    lastCompaction: daysAgo(1),
    hitRate: 42.6,
    sample: sample("mem-triage-user", [
      [
        "user_demo_1041/language",
        "Prefers responses in German; account region EU-West.",
        48,
        true,
      ],
      [
        "user_demo_1041/plan",
        "On the Team plan since March 2026; two seats unused.",
        120,
      ],
      [
        "user_demo_2210/channel",
        "Asked not to be contacted by phone; email only.",
        9,
      ],
      [
        "user_demo_2210/known-issue",
        "Reported SSO login loop on 2026-10-30, resolved by cache clear.",
        6,
      ],
    ]),
  },
  {
    id: "mem-helpdesk-user",
    agentId: "agt-it-helpdesk",
    name: "Employee context",
    type: "user long-term",
    backend: "Postgres",
    records: 6_240,
    avgSizeKb: 2.4,
    ttlDays: 180,
    piiPolicy: "encrypt",
    writePolicy: "curated",
    lastCompaction: daysAgo(3),
    hitRate: 61.2,
    sample: sample("mem-helpdesk-user", [
      [
        "emp_demo_0817/devices",
        "Primary laptop MacBook Pro 14 (2025), dock in Berlin office desk 4C.",
        22,
        true,
      ],
      [
        "emp_demo_0817/vpn",
        "Had GlobalProtect certificate expiry on 2026-10-12; renewed.",
        24,
      ],
      [
        "emp_demo_0533/software",
        "Licensed for Adobe CC and Figma; requested Tableau on 2026-11-01.",
        4,
      ],
    ]),
  },
  {
    id: "mem-helpdesk-procedural",
    agentId: "agt-it-helpdesk",
    name: "Learned fixes",
    type: "procedural",
    backend: "Zep",
    records: 318,
    avgSizeKb: 3.8,
    ttlDays: null,
    piiPolicy: "deny",
    writePolicy: "curated",
    lastCompaction: daysAgo(7),
    hitRate: 28.4,
    sample: sample("mem-helpdesk-procedural", [
      [
        "fix/outlook-search-index",
        "When Outlook search returns nothing on macOS, rebuild Spotlight index for ~/Library/Group Containers before reinstalling.",
        35,
        true,
      ],
      [
        "fix/printer-queue-stuck",
        "Stuck print jobs on floor 3 clear after restarting the CUPS service on print-srv-03.",
        61,
        true,
      ],
      [
        "fix/mfa-reenroll",
        "MFA re-enrollment requires the identity team to clear the old device first; link the KB0010245 steps.",
        12,
      ],
    ]),
  },
  {
    id: "mem-ops-episodic",
    agentId: "agt-ops-analyst",
    name: "Investigation episodes",
    type: "episodic",
    backend: "Letta",
    records: 2_870,
    avgSizeKb: 14.6,
    ttlDays: 90,
    piiPolicy: "redact",
    writePolicy: "agent-writable",
    lastCompaction: hoursAgo(18),
    hitRate: 54.9,
    sample: sample("mem-ops-episodic", [
      [
        "ep/2026-11-04/payments-latency",
        "Correlated p95 spike on payments-api with a connection-pool exhaustion after CHG deploy; recommended rollback, confirmed fixed.",
        1,
      ],
      [
        "ep/2026-11-02/disk-pressure",
        "Disk pressure on db-replica-2 traced to unrotated slow-query logs; logrotate config applied.",
        3,
      ],
      [
        "ep/2026-10-28/dns-flap",
        "Intermittent DNS failures in eu-central resolved by raising CoreDNS replicas from 2 to 4.",
        8,
        true,
      ],
    ]),
  },
  {
    id: "mem-ops-org",
    agentId: "agt-ops-analyst",
    name: "Service topology facts",
    type: "organisational",
    backend: "Postgres",
    records: 1_460,
    avgSizeKb: 0.9,
    ttlDays: null,
    piiPolicy: "deny",
    writePolicy: "read-only",
    lastCompaction: daysAgo(14),
    hitRate: 71.3,
    sample: sample("mem-ops-org", [
      [
        "svc/payments-api/owner",
        "Owned by the Payments squad; on-call rotation `payments-primary`.",
        90,
        true,
      ],
      [
        "svc/payments-api/deps",
        "Depends on postgres-main, redis-cache-1 and the Stripe webhook relay.",
        90,
        true,
      ],
      [
        "env/eu-central/maintenance-window",
        "Standard maintenance window Tuesdays 02:00–04:00 CET.",
        45,
      ],
    ]),
  },
  {
    id: "mem-change-episodic",
    agentId: "agt-change-risk",
    name: "Assessment history",
    type: "episodic",
    backend: "Postgres",
    records: 5_120,
    avgSizeKb: 4.1,
    ttlDays: 365,
    piiPolicy: "redact",
    writePolicy: "agent-writable",
    lastCompaction: daysAgo(2),
    hitRate: 63.7,
    sample: sample("mem-change-episodic", [
      [
        "assess/CHG0040127",
        "Rated High: touches the auth service during business hours with no rollback plan. CAB agreed, change rescheduled.",
        2,
      ],
      [
        "assess/CHG0040098",
        "Rated Low: config-only change to logging level; auto-approved.",
        5,
      ],
      [
        "pattern/friday-deploys",
        "Changes implemented on Fridays after 15:00 had 2.3x the incident rate over the last quarter.",
        20,
        true,
      ],
    ]),
  },
  {
    id: "mem-hr-session",
    agentId: "agt-hr-answers",
    name: "Conversation state",
    type: "session",
    backend: "Redis",
    records: 3_960,
    avgSizeKb: 4.4,
    ttlDays: 1,
    piiPolicy: "encrypt",
    writePolicy: "agent-writable",
    lastCompaction: hoursAgo(1),
    hitRate: 98.1,
    sample: sample("mem-hr-session", [
      [
        "ses_51022/topic",
        "Parental leave eligibility; employee location Netherlands; start date pending.",
        0.02,
      ],
      [
        "ses_51022/clarified",
        "Confirmed the question is about partner leave, not maternity leave.",
        0.02,
      ],
    ]),
  },
  {
    id: "mem-hr-user",
    agentId: "agt-hr-answers",
    name: "Employee preferences",
    type: "user long-term",
    backend: "Mem0",
    records: 2_210,
    avgSizeKb: 0.8,
    ttlDays: 30,
    piiPolicy: "deny",
    writePolicy: "curated",
    lastCompaction: daysAgo(1),
    hitRate: 23.5,
    sample: sample("mem-hr-user", [
      [
        "emp_demo_1190/country",
        "Works from the Dublin entity; Irish leave rules apply.",
        12,
      ],
      [
        "emp_demo_1190/manager-approval",
        "Prefers to be reminded that leave requests need manager approval in the HR portal.",
        12,
      ],
    ]),
  },
  {
    id: "mem-alert-episodic",
    agentId: "agt-alert-correlator",
    name: "Correlation episodes",
    type: "episodic",
    backend: "Redis",
    records: 92_300,
    avgSizeKb: 1.6,
    ttlDays: 14,
    piiPolicy: "deny",
    writePolicy: "agent-writable",
    lastCompaction: hoursAgo(6),
    hitRate: 83.2,
    sample: sample("mem-alert-episodic", [
      [
        "corr/2026-11-05/cluster-7f",
        "Grouped 34 alerts from eu-central nodes into one incident: shared root cause node-pool autoscale.",
        0.3,
      ],
      [
        "corr/2026-11-04/cluster-6a",
        "Suppressed 12 duplicate disk alerts from db-replica-2 after RCA matched known issue.",
        1,
      ],
      [
        "corr/noise/synthetic-checks",
        "Synthetic-check alerts from the Sydney probe flap every Sunday 03:00 during maintenance; treat as noise.",
        19,
        true,
      ],
    ]),
  },
  {
    id: "mem-curator-procedural",
    agentId: "agt-kb-curator",
    name: "Editorial rules",
    type: "procedural",
    backend: "Postgres",
    records: 142,
    avgSizeKb: 2.2,
    ttlDays: null,
    piiPolicy: "deny",
    writePolicy: "read-only",
    lastCompaction: daysAgo(30),
    hitRate: 88.6,
    sample: sample("mem-curator-procedural", [
      [
        "rule/stale-after-180d",
        "Flag any published article not reviewed in 180 days; never auto-retire Security articles.",
        60,
        true,
      ],
      [
        "rule/duplicate-threshold",
        "Treat two articles with cosine similarity > 0.92 as duplicates and propose a merge.",
        60,
        true,
      ],
      [
        "rule/tone",
        "Articles for /itsm/knowledge use second person, numbered steps and a one-line summary.",
        60,
      ],
    ]),
  },
  {
    id: "mem-finance-org",
    agentId: "agt-finance-copilot",
    name: "Finance facts",
    type: "organisational",
    backend: "Zep",
    records: 864,
    avgSizeKb: 1.3,
    ttlDays: null,
    piiPolicy: "encrypt",
    writePolicy: "curated",
    lastCompaction: daysAgo(5),
    hitRate: 69.4,
    sample: sample("mem-finance-org", [
      [
        "close/calendar/FY26-Q4",
        "Q4 soft close on 2026-12-03, hard close 2026-12-08; accruals cut-off 2026-11-28.",
        10,
        true,
      ],
      [
        "costcenter/CC-4410",
        "CC-4410 is Platform Engineering; rolls up to Technology.",
        40,
      ],
      [
        "vendor/cloud-commit",
        "Annual cloud commit renews in March; 71% consumed as of October.",
        16,
      ],
    ]),
  },
]

export function getMemoryStore(id: string) {
  return memoryStores.find((m) => m.id === id)
}

/* ------------------------------------------------------------------------ */
/* Retrieval quality                                                         */
/* ------------------------------------------------------------------------ */

const qRng = createRng(7804)

export const retrievalDaily: RetrievalDaily[] = Array.from(
  { length: 14 },
  (_, i) => {
    const d = 13 - i
    const queries = int(qRng, 11_500, 14_800)
    const chunksRetrieved = Math.round(queries * (6.1 + qRng() * 0.8))
    const used = 0.38 + qRng() * 0.1 + (d < 4 ? 0.03 : 0)
    return {
      date: daysAgo(d).slice(0, 10),
      queries,
      hitRate:
        Math.round((89.2 + qRng() * 3.4 - (d === 9 ? 4.1 : 0)) * 10) / 10,
      contextPrecision:
        Math.round((71.5 + qRng() * 5 + (d < 4 ? 2.5 : 0)) * 10) / 10,
      chunksRetrieved,
      chunksUsed: Math.round(chunksRetrieved * used),
    }
  }
)

const lowRecallSeeds: {
  query: string
  agentId: string
  kbId: string
  topScore: number
  retrieved: number
  outcome: LowRecallOutcome
}[] = [
  {
    query: "Can I expense a standing desk for home office in Poland?",
    agentId: "agt-hr-answers",
    kbId: "kb-policy-handbook",
    topScore: 0.41,
    retrieved: 2,
    outcome: "Escalated to human",
  },
  {
    query: "rollback steps for the payments-api canary when Argo is stuck",
    agentId: "agt-it-helpdesk",
    kbId: "kb-it-runbooks",
    topScore: 0.47,
    retrieved: 3,
    outcome: "Fallback answer",
  },
  {
    query: "what happened last time we rotated the Kafka certificates",
    agentId: "agt-ops-analyst",
    kbId: "kb-incident-postmortems",
    topScore: 0.39,
    retrieved: 1,
    outcome: "Hallucination flagged",
  },
  {
    query: "does the Enterprise plan include SCIM provisioning for Okta",
    agentId: "agt-support-triage",
    kbId: "kb-sales-playbook",
    topScore: 0.33,
    retrieved: 0,
    outcome: "No answer",
  },
  {
    query:
      "precedent for schema migration on the orders table during business hours",
    agentId: "agt-change-risk",
    kbId: "kb-change-history",
    topScore: 0.52,
    retrieved: 4,
    outcome: "Fallback answer",
  },
  {
    query: "how do I export my data as parquet via the API",
    agentId: "agt-support-triage",
    kbId: "kb-product-docs",
    topScore: 0.49,
    retrieved: 3,
    outcome: "Fallback answer",
  },
  {
    query: "which cost center does the Sydney office rent book to",
    agentId: "agt-finance-copilot",
    kbId: "kb-finance-glossary",
    topScore: 0.44,
    retrieved: 2,
    outcome: "Answered from memory",
  },
  {
    query: "alerts from the Sydney synthetic probe every Sunday night",
    agentId: "agt-alert-correlator",
    kbId: "kb-incident-postmortems",
    topScore: 0.36,
    retrieved: 1,
    outcome: "Answered from memory",
  },
  {
    query: "GlobalProtect says certificate invalid after macOS update",
    agentId: "agt-it-helpdesk",
    kbId: "kb-itsm-knowledge",
    topScore: 0.51,
    retrieved: 2,
    outcome: "Fallback answer",
  },
  {
    query: "renewal notice period for the CDN vendor contract",
    agentId: "agt-finance-copilot",
    kbId: "kb-vendor-contracts",
    topScore: 0.46,
    retrieved: 1,
    outcome: "Escalated to human",
  },
  {
    query: "parental leave for contractors in the Netherlands",
    agentId: "agt-hr-answers",
    kbId: "kb-policy-handbook",
    topScore: 0.43,
    retrieved: 2,
    outcome: "No answer",
  },
  {
    query: "bulk-delete webhooks with the CLI",
    agentId: "agt-support-triage",
    kbId: "kb-product-docs",
    topScore: 0.5,
    retrieved: 3,
    outcome: "Hallucination flagged",
  },
]

const traceCursor: Record<string, number> = {}
function traceFor(agentId: string) {
  const list = agentTraces.filter((t) => t.agentId === agentId)
  if (list.length === 0) return undefined
  const i = traceCursor[agentId] ?? 0
  traceCursor[agentId] = i + 1
  return list[i % list.length]
}

/** Agents without live traffic have no traces, so their seeds are skipped. */
export const lowRecallQueries: LowRecallQuery[] = lowRecallSeeds.flatMap(
  (s, i) => {
    const trace = traceFor(s.agentId)
    if (!trace) return []
    return [
      {
        id: `lrq-${String(i + 1).padStart(3, "0")}`,
        ...s,
        traceId: trace.id,
        at: trace.startedAt,
      },
    ]
  }
)

/* ------------------------------------------------------------------------ */
/* Chunks and deterministic retrieval                                        */
/* ------------------------------------------------------------------------ */

type ChunkSeed = [sourceName: string, docTitle: string, text: string]

const chunkSeeds: Record<string, ChunkSeed[]> = {
  "kb-support-kb": [
    [
      "Help Center (public)",
      "Understanding your invoice",
      "Invoices are issued on the first day of each billing cycle. A duplicate charge usually means a failed payment was retried; refunds for duplicate invoices are processed within 5 business days.",
    ],
    [
      "Zendesk macros",
      "Macro: Refund duplicate charge",
      "Apologise for the duplicate charge, confirm the invoice number and amount, and open a refund request in the billing portal. Do not promise a date earlier than 5 business days.",
    ],
    [
      "Help Center (public)",
      "Managing seats on the Team plan",
      "Admins can add or remove seats from Settings → Billing. Unused seats are prorated at the next invoice; downgrading below the current member count is blocked.",
    ],
    [
      "Help Center (public)",
      "Single sign-on troubleshooting",
      "If SSO loops back to the login page, clear cookies for the app domain and confirm the IdP clock is within 5 minutes of UTC. Enterprise customers can enable SCIM provisioning for Okta and Entra ID.",
    ],
    [
      "Zendesk macros",
      "Macro: Request logs",
      "Ask the customer for the HAR file and the approximate time of the error in UTC before escalating to engineering.",
    ],
  ],
  "kb-it-runbooks": [
    [
      "platform/runbooks",
      "payments-api: canary rollback",
      "To roll back a stuck canary, pause the Argo Rollout, then run `kubectl argo rollouts abort payments-api` and promote the stable ReplicaSet. Verify p95 latency in Grafana before resuming.",
    ],
    [
      "IT Operations (OPS)",
      "Connection pool exhaustion",
      "Pool exhaustion presents as rising p95 with flat CPU. Check `pg_stat_activity` for idle-in-transaction sessions and raise `max_connections` only after fixing the leak.",
    ],
    [
      "sre/oncall-playbooks",
      "On-call: paging policy",
      "Sev-1 pages the primary and secondary; Sev-2 pages primary only. Escalate to the engineering manager after 30 minutes without acknowledgement.",
    ],
    [
      "Architecture decision records",
      "ADR-014: CoreDNS replica count",
      "Run at least 4 CoreDNS replicas per region after the eu-central DNS flap; 2 replicas could not absorb node-pool scale events.",
    ],
    [
      "IT Operations (OPS)",
      "Kafka certificate rotation",
      "Rotate broker certificates one broker at a time; clients reconnect automatically. Last rotation caused a 12-minute consumer lag because two brokers were rotated together.",
    ],
  ],
  "kb-policy-handbook": [
    [
      "People Ops – Policies",
      "Parental leave (Netherlands)",
      "Employees in the Netherlands are entitled to 6 weeks of partner leave at 70% pay, in addition to one week of fully paid birth leave. Contractors are not covered by this policy.",
    ],
    [
      "People Ops – Policies",
      "Home office equipment",
      "Employees may expense up to €500 per year for home office equipment including desks and chairs; country-specific tax treatment applies. Submit receipts through the expense tool.",
    ],
    [
      "Benefits guides (per country)",
      "Leave balances and carry-over",
      "Up to 5 days of annual leave can be carried into the next year and must be used by 31 March. Balances are shown in the HR portal.",
    ],
    [
      "Security – Standards",
      "Acceptable use of AI tools",
      "Do not paste customer personal data into external AI tools. Approved assistants are listed in the internal AI catalog.",
    ],
  ],
  "kb-change-history": [
    [
      "Closed changes (CHG)",
      "CHG0039810 – orders table schema migration",
      "Added a nullable column to the orders table using an online migration during business hours. Completed without incident; lock wait stayed under 200 ms.",
    ],
    [
      "Closed changes (CHG)",
      "CHG0039422 – auth service rollout",
      "Rolled out auth service 4.2 at 14:00; login failures spiked for 9 minutes. Postmortem recommends off-hours windows for auth changes.",
    ],
    [
      "CAB minutes",
      "CAB 2026-10-21",
      "CAB agreed that Friday deployments after 15:00 require director approval given the elevated incident rate.",
    ],
    [
      "Closed changes (CHG)",
      "CHG0039960 – logging level change",
      "Config-only change lowering log level on the API gateway. Standard change, auto-approved.",
    ],
  ],
  "kb-product-docs": [
    [
      "docs.example.com",
      "Exporting data",
      "Call the REST API with `POST /v2/exports` and `format: parquet` or `csv`. Exports are asynchronous; poll `GET /v2/exports/{id}` until status is `ready` and download from the signed URL.",
    ],
    [
      "example/docs",
      "CLI reference: webhooks",
      "`cli webhooks list` prints all endpoints; `cli webhooks delete <id>` removes one. There is no bulk delete flag; use a shell loop over `webhooks list --json`.",
    ],
    [
      "docs.example.com",
      "Authentication",
      "Authenticate with a bearer token. Tokens can be scoped to read or write and expire after 90 days unless rotated.",
    ],
    [
      "API changelog",
      "2026-10 changelog",
      "Added parquet export format and the `include_deleted` flag on list endpoints. Deprecated v1 webhooks.",
    ],
  ],
  "kb-finance-glossary": [
    [
      "Close calendar & cost centers",
      "Cost center mapping",
      "Office rent is booked to CC-2100 Facilities per site; the Sydney office rolls up to CC-2100-SYD. Platform Engineering is CC-4410.",
    ],
    [
      "FP&A Glossary",
      "Accrual",
      "An accrual records an expense in the period it was incurred, even if the invoice arrives later. Cut-off for Q4 accruals is 28 November.",
    ],
    [
      "FP&A Glossary",
      "Soft close vs hard close",
      "Soft close produces preliminary numbers for review; hard close locks the ledger. Adjustments after hard close require controller approval.",
    ],
  ],
  "kb-incident-postmortems": [
    [
      "Postmortems (PM)",
      "PM-2026-09-14: Kafka certificate rotation",
      "Rotating two brokers simultaneously caused consumer group rebalances and 12 minutes of lag. Action item: rotate one broker at a time and add a lag alert.",
    ],
    [
      "Postmortems (PM)",
      "PM-2026-10-28: eu-central DNS flap",
      "CoreDNS with 2 replicas could not handle node-pool scale events. Raised to 4 replicas; added synthetic DNS checks.",
    ],
    [
      "status.example.com",
      "Sydney synthetic probe maintenance",
      "The Sydney probe runs maintenance every Sunday 03:00 local; alerts from it during that window are expected and suppressed.",
    ],
    [
      "s3://rca-archive",
      "RCA: payments latency 2026-11-04",
      "Connection-pool exhaustion after a deploy that doubled worker concurrency. Rolled back within 20 minutes.",
    ],
  ],
  "kb-sales-playbook": [
    [
      "Pricing & battlecards",
      "Enterprise plan feature matrix",
      "Enterprise includes SSO, SCIM provisioning for Okta and Entra ID, audit log export and a 99.9% uptime SLA.",
    ],
    [
      "Sales Enablement",
      "Upgrade conversation guide",
      "When a Team customer asks about compliance features, position Enterprise and offer a 30-day trial of SSO.",
    ],
  ],
  "kb-itsm-knowledge": [
    [
      "ITSM knowledge articles",
      "KB0010231 – How to connect to the VPN (GlobalProtect)",
      "Install GlobalProtect, sign in with your corporate account and complete MFA. If the client reports an invalid certificate after a macOS update, remove the stale certificate from Keychain and reconnect.",
    ],
    [
      "ITSM knowledge articles",
      "KB0010245 – Resetting your password with self-service",
      "Use the self-service portal to reset or unlock your account. MFA re-enrollment must be requested from the identity team.",
    ],
    [
      "ITSM knowledge articles",
      "KB0010260 – Requesting software",
      "Software requests go through the service catalog; licensed software requires manager approval and takes up to two business days.",
    ],
  ],
  "kb-vendor-contracts": [
    [
      "Procurement – Contracts",
      "CDN services agreement",
      "Term renews annually on 1 March. Either party may terminate with 90 days written notice before the renewal date. Commercial terms redacted.",
    ],
    [
      "Procurement – Contracts",
      "Cloud enterprise agreement",
      "Three-year committed spend with annual true-up each March; overage billed at list price.",
    ],
    [
      "s3://contracts-archive",
      "Vendor SLA summary",
      "Vendors with a 99.9% or higher availability SLA: CDN, cloud, identity provider. Service credits must be claimed within 30 days.",
    ],
  ],
}

export const kbChunks: KbChunk[] = Object.entries(chunkSeeds).flatMap(
  ([kbId, seeds]) =>
    seeds.map(([sourceName, docTitle, text], i) => ({
      id: `${kbId.replace(/^kb-/, "")}-c${i + 1}`,
      kbId,
      sourceId: kbSources.find((s) => s.name === sourceName)?.id ?? "src-000",
      docTitle,
      text,
    }))
)

const stopwords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "do",
  "does",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "the",
  "to",
  "we",
  "what",
  "when",
  "which",
  "with",
  "via",
])

function tokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 2 && !stopwords.has(t))
}

function stem(t: string) {
  return t.replace(/(ing|ed|es|s)$/, "")
}

function hashSeed(input: string) {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Deterministic toy retriever: stemmed keyword overlap between the query and
 * each chunk, blended with a hash-seeded jitter so results look like real
 * similarity scores. Rerank favours chunks where matches are dense.
 */
export function searchKnowledgeBase(
  kbId: string,
  query: string
): RetrievalResult[] {
  const kb = getKnowledgeBase(kbId)
  const q = [...new Set(tokens(query).map(stem))]
  if (!kb || q.length === 0) return []
  const chunks = kbChunks.filter((c) => c.kbId === kbId)
  const results = chunks.map((chunk) => {
    const words = tokens(`${chunk.docTitle} ${chunk.text}`).map(stem)
    const wordSet = new Set(words)
    const matched = q.filter((t) => wordSet.has(t))
    const overlap = matched.length / q.length
    const density = matched.length / Math.max(12, words.length)
    const jitter = createRng(hashSeed(`${chunk.id}|${q.join(" ")}`))
    const dense = 0.28 + overlap * 0.58 + (jitter() - 0.5) * 0.08
    const lexical = overlap * 0.9 + (jitter() - 0.5) * 0.06
    const score = clamp(
      dense * (1 - kb.retrieval.hybridWeight) +
        lexical * kb.retrieval.hybridWeight
    )
    const rerankScore = kb.retrieval.reranker
      ? clamp(
          score * 0.7 + overlap * 0.2 + density * 1.5 + (jitter() - 0.5) * 0.05
        )
      : score
    const why =
      matched.length === 0
        ? "No query terms appear in this chunk; the score comes from embedding similarity alone."
        : `${matched.length} of ${q.length} query terms match (${matched
            .slice(0, 4)
            .join(", ")})${
            kb.retrieval.hybridWeight >= 0.4
              ? "; hybrid search gives lexical matches extra weight"
              : ""
          }${
            kb.retrieval.reranker
              ? density > 0.08
                ? "; the reranker boosted it because the matches are dense"
                : "; the reranker kept it roughly in place"
              : ""
          }.`
    return {
      chunk,
      score: Math.round(score * 100) / 100,
      rerankScore: Math.round(rerankScore * 100) / 100,
      matchedTerms: matched,
      belowThreshold: score < kb.retrieval.scoreThreshold,
      why,
    }
  })
  return results
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, kb.retrieval.topK)
}

function clamp(n: number) {
  return Math.max(0.02, Math.min(0.99, n))
}

/* ------------------------------------------------------------------------ */
/* Aggregates                                                                */
/* ------------------------------------------------------------------------ */

export const STALE_AFTER_DAYS = 7

export function isKbStale(kb: KnowledgeBase) {
  return daysSince(kb.lastSync) > STALE_AFTER_DAYS
}

export function daysSince(iso: string) {
  return (NOW.getTime() - new Date(iso).getTime()) / 86_400_000
}

export const kbTotals = {
  knowledgeBases: knowledgeBases.length,
  documents: knowledgeBases.reduce((n, k) => n + k.documents, 0),
  chunks: knowledgeBases.reduce((n, k) => n + k.chunks, 0),
  staleSources: kbSources.filter(
    (s) => s.status === "Failed" || s.status === "Paused" || isSourceStale(s)
  ).length,
  memoryRecords: memoryStores.reduce((n, m) => n + m.records, 0),
  hitRate24h: retrievalDaily[retrievalDaily.length - 1].hitRate,
}

function isSourceStale(s: KbSource) {
  return daysSince(s.lastSync) > STALE_AFTER_DAYS
}
