"use client"

import { useQueryParam } from "@/hooks/use-query-param"
import { CountPill } from "@/components/shared/count-pill"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDeployedAgent } from "@/lib/data/agentops"
import {
  ingestionJobs,
  lowRecallQueries,
  retrievalDaily,
} from "@/lib/data/knowledge"
import { formatNumber } from "@/lib/format"
import { KnowledgeBasesTable } from "./knowledge-bases"
import { MemoryTab } from "./memory"
import { RetrievalQualityTab } from "./retrieval-quality"
import { SourcesTab } from "./sources"
import { kbStore, knowledgeTotals, memoryStore, sourceStore } from "./store"

const tabs = ["bases", "sources", "memory", "quality"] as const
type Tab = (typeof tabs)[number]

function isTab(v: string | null): v is Tab {
  return tabs.includes(v as Tab)
}

/** Stat row computed from the client stores so it follows every mutation. */
export function KnowledgeStats() {
  const totals = knowledgeTotals(
    kbStore.use(),
    sourceStore.use(),
    memoryStore.use()
  )
  const today = retrievalDaily[retrievalDaily.length - 1]
  const yesterday = retrievalDaily[retrievalDaily.length - 2]
  return (
    <StatGrid columns={6}>
      <StatCard
        label="Knowledge bases"
        value={totals.knowledgeBases}
        hint={`${totals.healthy} healthy`}
      />
      <StatCard
        label="Documents indexed"
        value={formatNumber(totals.documents, true)}
        hint={`${totals.sources} sources`}
      />
      <StatCard
        label="Chunks"
        value={formatNumber(totals.chunks, true)}
        hint="Across all stores"
      />
      <StatCard
        label="Stale sources"
        value={totals.staleSources}
        upIsGood={false}
        hint={`${totals.failedSources} failed · paused or not synced in 7 days`}
      />
      <StatCard
        label="Retrieval hit rate · 24h"
        value={today.hitRate.toFixed(1)}
        unit="%"
        delta={Math.round((today.hitRate - yesterday.hitRate) * 10) / 10}
        deltaUnit="pt"
        deltaLabel="vs yesterday"
      />
      <StatCard
        label="Memory records"
        value={formatNumber(totals.memoryRecords, true)}
        hint={`${totals.longTermStores} long-term stores`}
      />
    </StatGrid>
  )
}

/**
 * Tab shell for /agentops/knowledge, synced to `?tab=`. `?agent=<agt-id>`
 * pre-filters the Bases, Memory and Retrieval quality tabs to that agent.
 */
export function KnowledgeTabs() {
  const [tabParam, setTab] = useQueryParam("tab")
  const [agentParam] = useQueryParam("agent")
  const agentId = agentParam && getDeployedAgent(agentParam) ? agentParam : null
  const tab: Tab = isTab(tabParam) ? tabParam : "bases"
  const running = ingestionJobs.filter((j) => j.status === "Running").length
  const baseCount = kbStore.use().length
  const sourceCount = sourceStore.use().length
  const memoryCount = memoryStore.use().length

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v === "bases" ? null : String(v))}
      className="gap-4"
    >
      <TabsList>
        <TabsTrigger value="bases">
          Knowledge bases <CountPill count={baseCount} />
        </TabsTrigger>
        <TabsTrigger value="sources">
          Sources &amp; ingestion <CountPill count={sourceCount} />
          {running > 0 && (
            <span className="inline-flex size-1.5 rounded-full bg-brand">
              <span className="sr-only">
                {running} ingestion {running === 1 ? "job" : "jobs"} running
              </span>
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="memory">
          Memory <CountPill count={memoryCount} />
        </TabsTrigger>
        <TabsTrigger value="quality">
          Retrieval quality <CountPill count={lowRecallQueries.length} />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="bases">
        <KnowledgeBasesTable agentId={agentId} />
      </TabsContent>
      <TabsContent value="sources">
        <SourcesTab />
      </TabsContent>
      <TabsContent value="memory">
        <MemoryTab agentId={agentId} />
      </TabsContent>
      <TabsContent value="quality">
        <RetrievalQualityTab agentId={agentId} />
      </TabsContent>
    </Tabs>
  )
}
