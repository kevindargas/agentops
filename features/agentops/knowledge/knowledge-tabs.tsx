"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ingestionJobs,
  kbSources,
  knowledgeBases,
  lowRecallQueries,
  memoryStores,
} from "@/lib/data/knowledge"
import { KnowledgeBasesTable } from "./knowledge-bases"
import { MemoryTab } from "./memory"
import { RetrievalQualityTab } from "./retrieval-quality"
import { useQueryParam } from "./shared"
import { SourcesTab } from "./sources"

const tabs = ["bases", "sources", "memory", "quality"] as const
type Tab = (typeof tabs)[number]

function isTab(v: string | null): v is Tab {
  return tabs.includes(v as Tab)
}

/** Tab shell for /agentops/knowledge, synced to `?tab=`. */
export function KnowledgeTabs() {
  const [tabParam, setTab] = useQueryParam("tab")
  const tab: Tab = isTab(tabParam) ? tabParam : "bases"
  const running = ingestionJobs.filter((j) => j.status === "Running").length

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v === "bases" ? null : String(v))}
      className="gap-4"
    >
      <TabsList>
        <TabsTrigger value="bases">
          Knowledge bases <Count n={knowledgeBases.length} />
        </TabsTrigger>
        <TabsTrigger value="sources">
          Sources &amp; ingestion <Count n={kbSources.length} />
          {running > 0 && (
            <span
              aria-label={`${running} jobs running`}
              className="inline-flex size-1.5 rounded-full bg-brand"
            />
          )}
        </TabsTrigger>
        <TabsTrigger value="memory">
          Memory <Count n={memoryStores.length} />
        </TabsTrigger>
        <TabsTrigger value="quality">
          Retrieval quality <Count n={lowRecallQueries.length} />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="bases">
        <KnowledgeBasesTable />
      </TabsContent>
      <TabsContent value="sources">
        <SourcesTab />
      </TabsContent>
      <TabsContent value="memory">
        <MemoryTab />
      </TabsContent>
      <TabsContent value="quality">
        <RetrievalQualityTab />
      </TabsContent>
    </Tabs>
  )
}

function Count({ n }: { n: number }) {
  return (
    <span className="ml-0.5 text-xs text-muted-foreground tabular-nums">
      {n}
    </span>
  )
}
