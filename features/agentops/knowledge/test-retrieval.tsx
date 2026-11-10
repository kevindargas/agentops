"use client"

import * as React from "react"
import { cn } from "cn"
import { InfoIcon, SearchIcon, SparklesIcon } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getKbSource,
  getKnowledgeBase,
  knowledgeBases,
  searchKnowledgeBase,
  type RetrievalResult,
} from "@/lib/data/knowledge"
import { ScoreBar } from "../shared"
import { sourceTypeLabel, StoreBadge } from "./shared"

const sampleQueries: Record<string, string[]> = {
  "kb-support-kb": ["duplicate invoice charge refund", "SSO login loop"],
  "kb-it-runbooks": ["rollback stuck canary", "connection pool exhaustion"],
  "kb-policy-handbook": ["parental leave Netherlands", "expense a desk"],
  "kb-change-history": ["orders table migration business hours"],
  "kb-product-docs": ["export parquet via API", "delete webhooks CLI"],
  "kb-finance-glossary": ["Sydney office rent cost center", "accrual cut-off"],
  "kb-incident-postmortems": ["Kafka certificate rotation lag"],
  "kb-sales-playbook": ["Enterprise SCIM Okta"],
  "kb-itsm-knowledge": ["GlobalProtect certificate invalid", "reset password"],
  "kb-vendor-contracts": ["CDN renewal notice period"],
}

const kbItems = knowledgeBases.map((k) => ({ value: k.id, label: k.name }))

/**
 * Client-side retrieval sandbox. Scoring is a deterministic toy
 * (`searchKnowledgeBase`) so the same query always ranks the same way.
 */
export function TestRetrievalPanel({
  kbId: initialKb,
  lockKb = false,
  className,
}: {
  kbId?: string
  lockKb?: boolean
  className?: string
}) {
  const [kbId, setKbId] = React.useState(initialKb ?? knowledgeBases[0].id)
  const [draft, setDraft] = React.useState("")
  const [submitted, setSubmitted] = React.useState<{
    kbId: string
    query: string
  } | null>(null)

  const kb = getKnowledgeBase(kbId)
  const results = submitted
    ? searchKnowledgeBase(submitted.kbId, submitted.query)
    : null

  const run = (q: string) => {
    const query = q.trim()
    if (!query) return
    setDraft(query)
    setSubmitted({ kbId, query })
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          run(draft)
        }}
      >
        {!lockKb && (
          <div className="flex flex-col gap-1.5 sm:w-56">
            <Label htmlFor="test-kb">Knowledge base</Label>
            <Select
              value={kbId}
              onValueChange={(v) => {
                if (!v) return
                setKbId(v)
                setSubmitted(null)
              }}
              items={kbItems}
            >
              <SelectTrigger id="test-kb" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kbItems.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="test-query">Query</Label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="test-query"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask what an agent would ask"
              className="pl-8"
              autoComplete="off"
            />
          </div>
        </div>
        <Button type="submit" disabled={!draft.trim()}>
          <SparklesIcon /> Retrieve
        </Button>
      </form>

      {kb && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <StoreBadge store={kb.store} />
          <span className="tabular-nums">
            Top k {kb.retrieval.topK} · Score threshold{" "}
            {kb.retrieval.scoreThreshold} · BM25 weight{" "}
            {kb.retrieval.hybridWeight}
            {kb.retrieval.reranker ? " · Reranker on" : ""}
            {kb.retrieval.mmr ? " · MMR on" : ""}
          </span>
          <span className="mx-1 hidden sm:inline">·</span>
          <span>Try:</span>
          {(sampleQueries[kb.id] ?? []).map((q) => (
            <button
              key={q}
              type="button"
              className="rounded-md border bg-background px-1.5 py-0.5 text-xs hover:bg-muted"
              onClick={() => run(q)}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {results === null ? (
        <EmptyState
          size="sm"
          icon={<SearchIcon />}
          title="No query yet"
          description="Results are ranked by the knowledge base's retrieval config, then explained chunk by chunk."
        />
      ) : results.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<SearchIcon />}
          title="Nothing retrieved"
          description="The query had no usable terms for this index. Try a longer, more specific question."
        />
      ) : (
        <ol className="flex flex-col gap-2" aria-label="Retrieved chunks">
          {results.map((r, i) => (
            <ResultRow key={r.chunk.id} rank={i + 1} result={r} />
          ))}
        </ol>
      )}
    </div>
  )
}

function ResultRow({
  rank,
  result: r,
}: {
  rank: number
  result: RetrievalResult
}) {
  const source = getKbSource(r.chunk.sourceId)
  return (
    <li
      className={cn(
        "rounded-lg border px-4 py-3",
        r.belowThreshold && "border-dashed opacity-80"
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs tabular-nums">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{r.chunk.docTitle}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {source?.name ?? "Unknown source"}
            {source && (
              <span className="text-muted-foreground/70">
                {" "}
                · {sourceTypeLabel[source.type]}
              </span>
            )}
            <span className="ml-1.5 font-mono text-2xs text-muted-foreground/70">
              {r.chunk.id}
            </span>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">
            {highlight(r.chunk.text, r.matchedTerms)}
          </p>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <span className="font-medium text-foreground/80">
                Why this chunk:
              </span>{" "}
              {r.why}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-4">
          <div className="flex flex-col items-end gap-0.5">
            <Eyebrow as="span">Score</Eyebrow>
            <ScoreBar
              value={r.score}
              max={1}
              thresholds={{ good: 65, ok: 50 }}
              label={`Similarity ${r.score}`}
            />
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <Eyebrow as="span">Rerank</Eyebrow>
            <ScoreBar
              value={r.rerankScore}
              max={1}
              thresholds={{ good: 65, ok: 50 }}
              label={`Rerank score ${r.rerankScore}`}
            />
          </div>
        </div>
      </div>
      {r.belowThreshold && (
        <Badge variant="outline" className="mt-2 text-muted-foreground">
          Below threshold: not sent to the model
        </Badge>
      )}
    </li>
  )
}

/** Wrap matched (stemmed) terms in <mark>. */
function highlight(text: string, terms: string[]) {
  if (terms.length === 0) return text
  const re = new RegExp(`\\b(${terms.map(escape).join("|")})\\w*`, "gi")
  const parts: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0
    if (i > last) parts.push(text.slice(last, i))
    parts.push(
      <mark key={i} className="rounded-sm bg-brand/15 px-0.5 text-foreground">
        {m[0]}
      </mark>
    )
    last = i + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
