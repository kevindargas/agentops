"use client"

import * as React from "react"
import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import { ArrowUpRightIcon, FlaskConicalIcon } from "lucide-react"

import { ChartCard } from "@/components/charts/chart-card"
import { HorizontalBarChart } from "@/components/charts/horizontal-bar-chart"
import { IncidentTrendChart } from "@/components/charts/incident-trend-chart"
import { StackedBarChart } from "@/components/charts/stacked-bar-chart"
import { shortDate } from "@/components/charts/chart-primitives"
import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { StateBadge, type Tone } from "@/components/shared/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { deployedAgents, getDeployedAgent } from "@/lib/data"
import {
  getKnowledgeBase,
  knowledgeBases,
  lowRecallQueries,
  retrievalDaily,
  type LowRecallOutcome,
  type LowRecallQuery,
} from "@/lib/data/knowledge"
import { formatNumber } from "@/lib/format"
import { AgentChip, ScoreBar, fmtMs } from "../shared"
import { KNOWLEDGE_PATH, pct } from "./shared"
import { TestRetrievalPanel } from "./test-retrieval"

const outcomeTone: Record<LowRecallOutcome, Tone> = {
  "Fallback answer": "warning",
  "Escalated to human": "info",
  "Hallucination flagged": "danger",
  "No answer": "muted",
  "Answered from memory": "success",
}

const col = createColumnHelper<DataTableFeatures, LowRecallQuery>()

const columns = col.columns([
  col.accessor("query", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Query" />
    ),
    cell: ({ row }) => (
      <TwoLineCell
        primary={<span className="font-normal">“{row.original.query}”</span>}
        secondary={`${row.original.retrieved} chunk${row.original.retrieved === 1 ? "" : "s"} retrieved`}
      />
    ),
    enableHiding: false,
    meta: { width: "min-w-72 max-w-xl", label: "Query", skeleton: "w-64" },
  }),
  col.accessor("agentId", {
    header: "Agent",
    cell: ({ getValue }) => <AgentChip agentId={getValue()} size="sm" />,
    enableSorting: false,
    meta: { width: "w-40", label: "Agent", skeleton: "w-24" },
  }),
  col.accessor("kbId", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Knowledge base" />
    ),
    cell: ({ getValue }) => (
      <Link
        href={`${KNOWLEDGE_PATH}?tab=bases&kb=${getValue()}`}
        onClick={(e) => e.stopPropagation()}
        className="font-mono text-xs hover:underline"
      >
        {getKnowledgeBase(getValue())?.name ?? getValue()}
      </Link>
    ),
    meta: { width: "w-40", label: "Knowledge base", skeleton: "w-24" },
  }),
  col.accessor("topScore", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Top score" />
    ),
    cell: ({ getValue, row }) => (
      <ScoreBar
        value={getValue()}
        max={1}
        thresholds={{ good: 60, ok: 45 }}
        label={`Top score ${getValue()} of threshold ${getKnowledgeBase(row.original.kbId)?.retrieval.scoreThreshold ?? ""}`}
      />
    ),
    meta: {
      width: "w-24",
      label: "Top score",
      numeric: true,
      skeleton: "w-12",
    },
  }),
  col.accessor("outcome", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Outcome" />
    ),
    cell: ({ getValue }) => (
      <StateBadge state={getValue()} tone={outcomeTone[getValue()]} />
    ),
    meta: { width: "w-44", label: "Outcome", skeleton: "w-24 rounded-full" },
  }),
  col.accessor("traceId", {
    header: "Trace",
    cell: ({ getValue }) => (
      <Link
        href={`/agentops/traces/${getValue()}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 font-mono text-xs hover:underline"
      >
        {getValue()}
        <ArrowUpRightIcon className="size-3 text-muted-foreground" />
      </Link>
    ),
    enableSorting: false,
    meta: { width: "w-32", label: "Trace", skeleton: "w-20" },
  }),
  col.accessor("at", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="When" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-28", label: "When", skeleton: "w-16" },
  }),
])

const facets: FacetDef<LowRecallQuery>[] = [
  {
    id: "outcome",
    title: "Outcome",
    options: (Object.keys(outcomeTone) as LowRecallOutcome[]).map((v) => ({
      value: v,
      label: v,
    })),
    getValue: (r) => r.outcome,
  },
  {
    id: "kb",
    title: "Knowledge base",
    options: knowledgeBases.map((k) => ({ value: k.id, label: k.name })),
    getValue: (r) => r.kbId,
  },
  {
    id: "agent",
    title: "Agent",
    options: deployedAgents.map((a) => ({ value: a.id, label: a.name })),
    getValue: (r) => r.agentId,
  },
]

export function RetrievalQualityTab() {
  const [latencyMetric, setLatencyMetric] = React.useState<"p50" | "p95">("p95")

  const trend = retrievalDaily.map((d) => ({
    date: d.date,
    hitRate: d.hitRate,
    contextPrecision: d.contextPrecision,
  }))
  const chunks = retrievalDaily.map((d) => ({
    name: d.date,
    used: d.chunksUsed,
    discarded: d.chunksRetrieved - d.chunksUsed,
  }))
  const latency = [...knowledgeBases]
    .map((k) => ({
      name: k.name,
      value: latencyMetric === "p95" ? k.latency.p95Ms : k.latency.p50Ms,
    }))
    .sort((a, b) => b.value - a.value)
  const slowest = latency[0]?.name

  const last = retrievalDaily[retrievalDaily.length - 1]
  const first = retrievalDaily[0]
  const usedShare = Math.round((last.chunksUsed / last.chunksRetrieved) * 100)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          title="Hit rate & context precision"
          description="Share of queries with a chunk above threshold, and share of retrieved chunks the model actually used."
          footer={`Hit rate ${pct(last.hitRate)} today, ${last.hitRate - first.hitRate >= 0 ? "+" : ""}${(last.hitRate - first.hitRate).toFixed(1)} pt over 14 days.`}
        >
          <IncidentTrendChart
            data={trend}
            series={[
              { key: "hitRate", label: "Hit rate", color: "var(--chart-1)" },
              {
                key: "contextPrecision",
                label: "Context precision",
                color: "var(--chart-3)",
              },
            ]}
            height={220}
            valueFormatter={(v) => pct(v)}
          />
        </ChartCard>
        <ChartCard
          title="Chunks retrieved vs used"
          description="Chunks sent to the model each day, split by whether they were cited in the answer."
          footer={`${usedShare}% of retrieved chunks were used today. Lower top_k or a higher threshold cuts the discarded share.`}
        >
          <StackedBarChart
            data={chunks}
            series={[
              { key: "used", label: "Used", color: "var(--chart-1)" },
              { key: "discarded", label: "Discarded", color: "var(--chart-5)" },
            ]}
            height={220}
            xTickFormatter={(v) => shortDate(v)}
            valueFormatter={(v) => formatNumber(v, true)}
          />
        </ChartCard>
        <ChartCard
          title="Retrieval latency per knowledge base"
          description="End-to-end retrieve + rerank time."
          action={
            <ToggleGroup
              value={[latencyMetric]}
              onValueChange={(v) => {
                const next = v[0]
                if (next === "p50" || next === "p95") setLatencyMetric(next)
              }}
              variant="outline"
              size="sm"
              aria-label="Latency percentile"
            >
              <ToggleGroupItem value="p50">p50</ToggleGroupItem>
              <ToggleGroupItem value="p95">p95</ToggleGroupItem>
            </ToggleGroup>
          }
          footer={
            slowest
              ? `${slowest} is slowest at ${latencyMetric}; reranking and large chunk sizes add the most.`
              : undefined
          }
        >
          <HorizontalBarChart
            data={latency}
            label={`${latencyMetric} latency`}
            color="var(--chart-2)"
            rowHeight={22}
            labelWidth={150}
            emphasize={slowest}
            valueFormatter={(v) => fmtMs(v)}
          />
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Low-recall queries</CardTitle>
          <p className="text-xs text-muted-foreground">
            Queries whose best chunk fell below the knowledge base threshold in
            the last 48 hours. Each links to the trace so you can see what the
            agent did instead.
          </p>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={lowRecallQueries}
            getRowId={(r) => r.id}
            getSearchText={(r) =>
              `${r.query} ${r.outcome} ${getDeployedAgent(r.agentId)?.name ?? ""} ${getKnowledgeBase(r.kbId)?.name ?? ""}`
            }
            searchPlaceholder="Search queries…"
            facets={facets}
            initialSorting={[{ id: "topScore", desc: false }]}
            pageSize={10}
            totalLabel="queries"
            selectionLabel={(n) => (n === 1 ? "query" : "queries")}
            emptyTitle="No low-recall queries"
            emptyMessage="Every query in the window found a chunk above threshold."
            rowHref={(r) => `/agentops/traces/${r.traceId}`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <FlaskConicalIcon className="size-4 text-muted-foreground" /> Test
            retrieval
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Run a query against any knowledge base with its live settings and
            see why each chunk ranked where it did.
          </p>
        </CardHeader>
        <CardContent>
          <TestRetrievalPanel />
        </CardContent>
      </Card>
    </div>
  )
}
