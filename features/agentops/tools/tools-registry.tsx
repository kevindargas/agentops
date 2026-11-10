"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { KeyRoundIcon, ServerIcon, WrenchIcon } from "lucide-react"

import { setQueryParams } from "@/hooks/use-query-param"
import { CountPill } from "@/components/shared/count-pill"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDeployedAgent } from "@/lib/data/agentops"
import { McpServersTab } from "./mcp-servers"
import { PermissionsTab } from "./permissions-matrix"
import { serverStore, toolStore } from "./store"
import { ToolsTab } from "./tools-table"

type TabKey = "tools" | "servers" | "permissions"
const tabKeys: TabKey[] = ["tools", "servers", "permissions"]

/**
 * Tabs + detail sheets driven entirely by the URL: `?tab=servers`,
 * `?tool=<name>`, `?server=<id>`, `?agent=<agt-id>`. Opening a tool from a
 * server (or vice versa) swaps the param and the tab so deep links from agents
 * resolve either way. `?agent=` pre-filters the Tools tab to that agent's
 * allowlist and emphasises its row on the Permissions tab.
 */
export function ToolsRegistry() {
  const params = useSearchParams()
  const toolCount = toolStore.use().length
  const serverCount = serverStore.use().length

  const toolParam = params.get("tool")
  const serverParam = params.get("server")
  const agentParam = params.get("agent")
  const agentId = agentParam && getDeployedAgent(agentParam) ? agentParam : null
  const tabParam = params.get("tab") as TabKey | null
  const tab: TabKey = toolParam
    ? "tools"
    : serverParam
      ? "servers"
      : tabParam && tabKeys.includes(tabParam)
        ? tabParam
        : "tools"

  const openTool = (name: string | null) =>
    setQueryParams({ tool: name, server: null, tab: name ? "tools" : null })
  const openServer = (id: string | null) =>
    setQueryParams({ server: id, tool: null, tab: id ? "servers" : null })

  return (
    <Tabs
      value={tab}
      onValueChange={(v) =>
        setQueryParams({
          tab: v === "tools" ? null : String(v),
          tool: null,
          server: null,
        })
      }
      className="gap-5"
    >
      <div className="-mx-4 overflow-x-auto px-4 lg:-mx-6 lg:px-6">
        <TabsList
          variant="line"
          className="h-9 w-full min-w-max justify-start gap-0 border-b p-0"
        >
          <Trigger value="tools" icon={<WrenchIcon />} count={toolCount}>
            Tools
          </Trigger>
          <Trigger value="servers" icon={<ServerIcon />} count={serverCount}>
            MCP Servers
          </Trigger>
          <Trigger value="permissions" icon={<KeyRoundIcon />}>
            Permissions
          </Trigger>
        </TabsList>
      </div>
      <TabsContent value="tools">
        <ToolsTab
          openName={toolParam}
          agentId={agentId}
          onOpen={openTool}
          onOpenServer={openServer}
        />
      </TabsContent>
      <TabsContent value="servers">
        <McpServersTab
          openId={serverParam}
          onOpen={openServer}
          onOpenTool={openTool}
        />
      </TabsContent>
      <TabsContent value="permissions">
        <PermissionsTab highlightAgentId={agentId} />
      </TabsContent>
    </Tabs>
  )
}

function Trigger({
  value,
  icon,
  count,
  children,
}: {
  value: TabKey
  icon: React.ReactNode
  count?: number
  children: React.ReactNode
}) {
  return (
    <TabsTrigger
      value={value}
      className="group/tab h-full flex-none rounded-none px-3 pb-2 text-sm after:bottom-0! after:h-0.5 data-active:font-medium"
    >
      <span className="text-muted-foreground group-data-active/tab:text-foreground [&_svg]:size-3.5">
        {icon}
      </span>
      {children}
      {count !== undefined && (
        <CountPill
          count={count}
          className="transition-colors group-data-active/tab:bg-foreground group-data-active/tab:text-background"
        />
      )}
    </TabsTrigger>
  )
}
