"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRoundIcon, ServerIcon, WrenchIcon } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { mcpServers, tools } from "@/lib/data/tools"
import { McpServersTab } from "./mcp-servers"
import { PermissionsTab } from "./permissions-matrix"
import { ToolsTab } from "./tools-table"

type TabKey = "tools" | "servers" | "permissions"
const tabKeys: TabKey[] = ["tools", "servers", "permissions"]

/**
 * Tabs + detail sheets driven entirely by the URL: `?tab=servers`,
 * `?tool=<name>`, `?server=<id>`. Opening a tool from a server (or vice versa)
 * swaps the param and the tab so deep links from agents resolve either way.
 */
export function ToolsRegistry() {
  const router = useRouter()
  const params = useSearchParams()

  const toolParam = params.get("tool")
  const serverParam = params.get("server")
  const tabParam = params.get("tab") as TabKey | null
  const tab: TabKey = toolParam
    ? "tools"
    : serverParam
      ? "servers"
      : tabParam && tabKeys.includes(tabParam)
        ? tabParam
        : "tools"

  const navigate = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v)
        else next.delete(k)
      }
      router.replace(`/agentops/tools${next.size ? `?${next}` : ""}`, {
        scroll: false,
      })
    },
    [params, router]
  )

  const openTool = React.useCallback(
    (name: string | null) =>
      navigate({ tool: name, server: null, tab: name ? "tools" : null }),
    [navigate]
  )
  const openServer = React.useCallback(
    (id: string | null) =>
      navigate({ server: id, tool: null, tab: id ? "servers" : null }),
    [navigate]
  )

  return (
    <Tabs
      value={tab}
      onValueChange={(v) =>
        navigate({
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
          <Trigger value="tools" icon={<WrenchIcon />} count={tools.length}>
            Tools
          </Trigger>
          <Trigger
            value="servers"
            icon={<ServerIcon />}
            count={mcpServers.length}
          >
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
        <PermissionsTab />
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
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums transition-colors group-data-active/tab:bg-foreground group-data-active/tab:text-background">
          {count}
        </span>
      )}
    </TabsTrigger>
  )
}
