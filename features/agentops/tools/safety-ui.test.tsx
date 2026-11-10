import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import { getEvalRun, getUser } from "@/lib/data"
import { guardrails } from "@/lib/data/guardrails"
import {
  getTool,
  mcpServers,
  serverNeedsReview,
  toolIsSandboxed,
  tools,
} from "@/lib/data/tools"
import { PolicySheet } from "../guardrails/policy-sheet"
import { McpServersTab } from "./mcp-servers"
import { ToolSheet } from "./tool-sheet"

describe("tool side-effect safety & identity data", () => {
  it("derives identity from risk and keeps delegated tokens short", () => {
    for (const t of tools) {
      expect(t.outputSinks.length, t.name).toBeGreaterThan(0)
      expect(t.identity.scopes.length, t.name).toBeGreaterThan(0)
      if (t.risk === "Read") expect(t.idempotent, t.name).toBe(true)
      if (t.identity.mode === "delegated")
        expect(t.identity.tokenTtlMin, t.name).toBeLessThanOrEqual(15)
      if (t.compensatingToolId)
        expect(getTool(t.compensatingToolId), t.name).toBeDefined()
      if (t.maxTransactionUsd !== undefined)
        expect(t.risk, t.name).not.toBe("Read")
    }
    // Code execution is contained for the sandbox-backed tools.
    expect(toolIsSandboxed(getTool("run_python")!)).toBe(true)
    expect(toolIsSandboxed(getTool("fetch_url")!)).toBe(false)
    expect(getTool("fetch_url")!.outputSinks).toContain("renders_html")
    // Some destructive tool still lacks a dry run so the matrix hint shows.
    expect(
      tools.some((t) => t.risk === "Destructive" && !t.supportsDryRun)
    ).toBe(true)
  })
})

describe("MCP server integrity data", () => {
  it("has digests, reviewers and the planted findings", () => {
    for (const s of mcpServers) {
      expect(s.definitionDigest, s.id).toMatch(/^[0-9a-f]{12}$/)
      if (s.reviewerId) expect(getUser(s.reviewerId), s.id).toBeDefined()
      expect(s.vulnerabilities.scannedAt, s.id).toBeTruthy()
    }
    const unreviewed = mcpServers.filter(serverNeedsReview)
    expect(unreviewed.length).toBeGreaterThanOrEqual(1)
    expect(unreviewed.length).toBeLessThanOrEqual(2)
    expect(mcpServers.filter((s) => !s.signatureVerified)).toHaveLength(1)
  })
})

describe("guardrail effectiveness data", () => {
  it("links security policies to a real red-team run", () => {
    const security = guardrails.filter((g) => g.bypassRate > 0)
    expect(security.map((g) => g.id)).toEqual(
      expect.arrayContaining(["grd-prompt-injection", "grd-pii-redaction"])
    )
    for (const g of security) {
      expect(g.lastRedTeamRunId, g.id).toBeDefined()
      expect(getEvalRun(g.lastRedTeamRunId!)?.datasetId, g.id).toBe(
        "red-team-injections-v2"
      )
    }
    for (const g of guardrails) {
      expect(g.p95Ms, g.id).toBeGreaterThan(0)
      expect(g.bypassRate, g.id).toBeLessThanOrEqual(1)
    }
    expect(
      guardrails.find((g) => g.id === "grd-region-pinning")?.failMode
    ).toBe("fail_closed")
  })
})

describe("safety sheets render", () => {
  it("shows side-effect and identity sections for a destructive tool", () => {
    render(
      <TooltipProvider>
        <ToolSheet
          tool={getTool("pagerduty_page")!}
          onClose={vi.fn()}
          onPatch={vi.fn()}
          onOpenTool={vi.fn()}
          onOpenServer={vi.fn()}
        />
      </TooltipProvider>
    )
    expect(screen.getByText("Side-effect safety")).toBeInTheDocument()
    expect(screen.getByText("Identity & delegation")).toBeInTheDocument()
    expect(screen.getByText(/cannot be previewed/)).toBeInTheDocument()
  })

  it("warns about uncontained HTML rendering", () => {
    render(
      <TooltipProvider>
        <ToolSheet
          tool={getTool("fetch_url")!}
          onClose={vi.fn()}
          onPatch={vi.fn()}
          onOpenTool={vi.fn()}
          onOpenServer={vi.fn()}
        />
      </TooltipProvider>
    )
    expect(screen.getByText(/outside the sandbox/)).toBeInTheDocument()
  })

  it("shows the effectiveness section with the red-team link", () => {
    const g = guardrails.find((x) => x.id === "grd-prompt-injection")!
    render(
      <TooltipProvider>
        <PolicySheet
          policy={g}
          violations={[]}
          onClose={vi.fn()}
          onPatch={vi.fn()}
          onDuplicate={vi.fn()}
        />
      </TooltipProvider>
    )
    expect(screen.getByText("Effectiveness")).toBeInTheDocument()
    expect(screen.getByText("Red-team bypass")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: g.lastRedTeamRunId! })
    ).toHaveAttribute("href", `/agentops/evals/${g.lastRedTeamRunId}`)
  })

  it("renders MCP integrity badges and the server sheet", () => {
    render(
      <TooltipProvider>
        <McpServersTab
          openId="mcp-browser"
          onOpen={vi.fn()}
          onOpenTool={vi.fn()}
        />
      </TooltipProvider>
    )
    expect(screen.getAllByText("Changed since review").length).toBeGreaterThan(
      0
    )
    expect(screen.getAllByText("Unsigned").length).toBeGreaterThan(0)
    expect(screen.getByText("Egress allowlist")).toBeInTheDocument()
    expect(
      screen.getAllByRole("button", { name: /Mark reviewed/ }).length
    ).toBeGreaterThan(0)
  })
})
