"use client"

import * as React from "react"
import { toast } from "sonner"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDeployedAgent } from "@/lib/data"
import type { Prompt, PromptVersion } from "@/lib/data/prompts"
import { DiffTab } from "./diff-tab"
import { EditorTab } from "./editor-tab"
import { UsageTab } from "./usage-tab"
import { VersionsTab } from "./versions-tab"

type TabKey = "versions" | "editor" | "diff" | "usage"

/** Sensible default pair: production → newest non-production, else last two. */
function defaultDiffPair(versions: PromptVersion[]): [string, string] {
  const prod = versions.find((v) => v.label === "production")
  const latest = versions[versions.length - 1]
  if (prod && latest && prod.id !== latest.id) return [prod.id, latest.id]
  const prev = versions[versions.length - 2] ?? latest
  return [prev.id, latest.id]
}

/**
 * Lower half of the prompt record. Owns the version list so promote / rollback
 * are reflected across every tab, and switches to the Diff tab on "Compare".
 */
export function PromptWorkspace({ prompt }: { prompt: Prompt }) {
  const [versions, setVersions] = React.useState(prompt.versions)
  const [tab, setTab] = React.useState<TabKey>("versions")
  const [editorId, setEditorId] = React.useState(
    () =>
      prompt.versions.find((v) => v.label === "production")?.id ??
      prompt.versions[prompt.versions.length - 1]?.id ??
      ""
  )
  const [diff, setDiff] = React.useState<[string, string]>(() =>
    defaultDiffPair(prompt.versions)
  )
  const agent = getDeployedAgent(prompt.agentId)

  const makeProduction = (target: PromptVersion) =>
    setVersions((prev) =>
      prev.map((v) =>
        v.id === target.id
          ? { ...v, label: "production", review: "Approved" }
          : v.label === "production"
            ? { ...v, label: "archived" }
            : v
      )
    )

  const promote = (v: PromptVersion) => {
    makeProduction(v)
    toast.success(`v${v.number} promoted to production`, {
      description: `${agent?.name ?? "The agent"} serves ${v.id} on the next request. Previous production version archived.`,
    })
  }

  const rollback = (v: PromptVersion) => {
    makeProduction(v)
    toast(`Rolled back to v${v.number}`, {
      description: `${v.id} is production again. The replaced version was archived, not deleted.`,
    })
  }

  const compare = (v: PromptVersion) => {
    const prod = versions.find((x) => x.label === "production")
    const base =
      prod && prod.id !== v.id
        ? prod
        : versions[versions.findIndex((x) => x.id === v.id) - 1]
    setDiff(base ? [base.id, v.id] : [v.id, v.id])
    setTab("diff")
  }

  const tabs: { value: TabKey; label: string; count?: number }[] = [
    { value: "versions", label: "Versions", count: versions.length },
    { value: "editor", label: "Editor" },
    { value: "diff", label: "Diff" },
    { value: "usage", label: "Usage" },
  ]

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as TabKey)}
      className="gap-4"
    >
      <div className="-mx-4 overflow-x-auto px-4 lg:-mx-6 lg:px-6">
        <TabsList
          variant="line"
          className="h-9 w-full min-w-max justify-start gap-0 border-b p-0"
        >
          {tabs.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="group/tab h-full flex-none rounded-none px-3 pb-2 text-sm after:bottom-0! after:h-0.5 data-active:font-medium"
            >
              {t.label}
              {t.count !== undefined && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums transition-colors group-data-active/tab:bg-foreground group-data-active/tab:text-background">
                  {t.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value="versions">
        <VersionsTab
          versions={versions}
          onPromote={promote}
          onRollback={rollback}
          onCompare={compare}
        />
      </TabsContent>
      <TabsContent value="editor">
        <EditorTab
          prompt={prompt}
          versions={versions}
          versionId={editorId}
          onVersionChange={setEditorId}
        />
      </TabsContent>
      <TabsContent value="diff">
        <DiffTab
          versions={versions}
          fromId={diff[0]}
          toId={diff[1]}
          onChange={(a, b) => setDiff([a, b])}
        />
      </TabsContent>
      <TabsContent value="usage">
        <UsageTab versions={versions} />
      </TabsContent>
    </Tabs>
  )
}
