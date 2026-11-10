import { describe, expect, it } from "vitest"

import { deployedAgents } from "@/lib/data"
import {
  getMcpServer,
  getTool,
  mcpServers,
  toolPermissions,
  toolRisks,
  tools,
  toolStats,
} from "@/lib/data/tools"

describe("tools registry data", () => {
  it("has unique tool names and server ids", () => {
    expect(new Set(tools.map((t) => t.name)).size).toBe(tools.length)
    expect(new Set(mcpServers.map((s) => s.id)).size).toBe(mcpServers.length)
  })

  it("registers every tool string referenced by a deployed agent", () => {
    const referenced = [...new Set(deployedAgents.flatMap((a) => a.tools))]
    const missing = referenced.filter((n) => !getTool(n))
    expect(missing).toEqual([])
    for (const a of deployedAgents)
      for (const n of a.tools)
        expect(getTool(n)!.agentIds, `${n} → ${a.id}`).toContain(a.id)
  })

  it("keeps the search_cmdb alias pointing at search_services", () => {
    expect(getTool("search_cmdb")?.status).toBe("Deprecated")
    expect(getTool("search_cmdb")?.replacedBy).toBe("search_services")
    expect(getTool("search_services")?.status).toBe("Active")
  })

  it("links every MCP tool to a known server and vice versa", () => {
    for (const t of tools)
      if (t.source.kind === "mcp")
        expect(getMcpServer(t.source.serverId ?? ""), t.name).toBeDefined()
    for (const s of mcpServers)
      for (const n of s.toolNames)
        expect(getTool(n)?.source.serverId, n).toBe(s.id)
  })

  it("produces well-formed metrics", () => {
    for (const t of tools) {
      expect(t.calls14d).toHaveLength(14)
      expect(t.calls24h).toBe(t.calls14d[13])
      expect(t.errorRate).toBeGreaterThanOrEqual(0)
      expect(
        t.inputSchema.required.every((r) => r in t.inputSchema.properties)
      ).toBe(true)
      if (t.status === "Disabled" || t.approval === "Blocked")
        expect(t.calls24h).toBe(0)
    }
    expect(toolStats.calls24h).toBeGreaterThan(0)
  })

  it("has one permission per agent × risk level", () => {
    expect(toolPermissions).toHaveLength(
      deployedAgents.length * toolRisks.length
    )
  })
})
