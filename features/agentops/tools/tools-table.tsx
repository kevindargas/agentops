"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import { PlusIcon, WrenchIcon } from "lucide-react"
import { toast } from "sonner"

import { Sparkline } from "@/components/charts/sparkline"
import {
  DataTable,
  DataTableColumnHeader,
  NumericCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { UserChip } from "@/components/shared/user-chip"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { deployedAgents } from "@/lib/data/agentops"
import {
  mcpServers,
  toolApprovals,
  toolRisks,
  toolStatuses,
  type Tool,
  type ToolApproval,
  type ToolRisk,
  type ToolSourceKind,
} from "@/lib/data/tools"
import { currentUser } from "@/lib/data/users"
import { formatMs, formatNumber } from "@/lib/format"
import {
  AgentStack,
  ApprovalBadge,
  fmtPct,
  RiskBadge,
  SafetyGlyphs,
  SourceChip,
  sourceKindMeta,
  sourceLabel,
  ToolStatusBadge,
} from "./shared"
import { toolStore } from "./store"
import { ToolSheet } from "./tool-sheet"

const col = createColumnHelper<DataTableFeatures, Tool>()
const riskRank: Record<Tool["risk"], number> = {
  Read: 0,
  Write: 1,
  Destructive: 2,
}

function buildColumns(onOpenServer: (id: string) => void) {
  return col.columns([
    col.accessor("name", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Tool" />
      ),
      cell: ({ row }) => (
        <div className="min-w-0 leading-tight">
          <p
            className={cn(
              "truncate font-mono text-[13px] font-medium",
              row.original.status !== "Active" && "text-muted-foreground"
            )}
            title={row.original.name}
          >
            {row.original.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.original.description}
          </p>
        </div>
      ),
      enableHiding: false,
      meta: { width: "min-w-72 max-w-xl", label: "Tool", skeleton: "w-56" },
    }),
    col.accessor((r) => sourceLabel(r.source), {
      id: "source",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Source" />
      ),
      cell: ({ row }) => (
        <SourceChip source={row.original.source} onServerClick={onOpenServer} />
      ),
      meta: { width: "w-44", label: "Source", skeleton: "w-24" },
    }),
    col.accessor("risk", {
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Risk"
          hint="Read fetches data, Write creates or updates records, Destructive deletes, pages, publishes or pays"
        />
      ),
      cell: ({ getValue }) => <RiskBadge risk={getValue()} size="sm" />,
      sortFn: (a, b) => riskRank[a.original.risk] - riskRank[b.original.risk],
      meta: { width: "w-28", label: "Risk", skeleton: "w-16 rounded-full" },
    }),
    col.accessor("approval", {
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Policy"
          hint="Auto runs within the rate limit, Require approval parks each call in the review queue, Blocked rejects every call"
        />
      ),
      cell: ({ getValue }) => <ApprovalBadge approval={getValue()} size="sm" />,
      meta: {
        width: "w-36",
        label: "Approval policy",
        skeleton: "w-24 rounded-full",
      },
    }),
    col.accessor(
      (r) =>
        (r.idempotent ? 1 : 0) +
        (r.supportsDryRun ? 1 : 0) +
        (r.identity.mode === "delegated" ? 1 : 0),
      {
        id: "safety",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Safety"
            hint="Three slots: idempotent, supports dry run, delegated identity"
          />
        ),
        cell: ({ row }) => <SafetyGlyphs tool={row.original} />,
        meta: {
          width: "w-24",
          label: "Safety (idempotent, dry run, delegated)",
          skeleton: "w-16",
        },
      }
    ),
    col.accessor((r) => r.agentIds.length, {
      id: "agents",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Agents" />
      ),
      cell: ({ row }) => <AgentStack agentIds={row.original.agentIds} />,
      meta: { width: "w-28", label: "Agents using it", skeleton: "w-16" },
    }),
    col.accessor("calls24h", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Calls · 24h" />
      ),
      cell: ({ getValue, row }) => (
        <span className="flex items-center justify-end gap-2">
          <Sparkline
            data={row.original.calls14d}
            className="h-5 w-14"
            showEndDot={false}
            showArea={false}
            color={
              row.original.status === "Active"
                ? "var(--chart-1)"
                : "var(--muted-foreground)"
            }
          />
          <NumericCell
            value={getValue()}
            format={(n) => formatNumber(n, true)}
            muted={getValue() === 0}
            className="w-10"
          />
        </span>
      ),
      meta: { width: "w-32", label: "Calls", numeric: true, skeleton: "w-16" },
    }),
    col.accessor("errorRate", {
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Error rate"
          hint="Failed calls as a share of the last 24 hours; amber at 1.5%, red at 3%"
        />
      ),
      cell: ({ getValue, row }) => (
        <NumericCell
          value={row.original.calls24h ? getValue() : null}
          format={(n) => fmtPct(n)}
          className={cn(
            getValue() >= 3 && "font-medium text-danger-text",
            getValue() >= 1.5 && getValue() < 3 && "text-warning-text"
          )}
        />
      ),
      meta: {
        width: "w-24",
        label: "Error rate",
        numeric: true,
        skeleton: "w-8",
      },
    }),
    col.accessor("p95Ms", {
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="p95"
          hint="95th percentile call latency over the last 24 hours"
        />
      ),
      cell: ({ getValue, row }) => (
        <NumericCell
          value={row.original.calls24h ? getValue() : null}
          format={formatMs}
          muted
        />
      ),
      meta: {
        width: "w-20",
        label: "p95 latency",
        numeric: true,
        skeleton: "w-8",
      },
    }),
    col.accessor("status", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ getValue }) => <ToolStatusBadge status={getValue()} size="sm" />,
      meta: { width: "w-28", label: "Status", skeleton: "w-16 rounded-full" },
    }),
    col.accessor("ownerId", {
      header: "Owner",
      cell: ({ getValue }) => <UserChip userId={getValue()} size="xs" />,
      enableSorting: false,
      meta: { width: "w-40", label: "Owner", skeleton: "w-24" },
    }),
  ])
}

const facets: FacetDef<Tool>[] = [
  {
    id: "source",
    title: "Source",
    options: [
      ...(Object.keys(sourceKindMeta) as Tool["source"]["kind"][])
        .filter((k) => k !== "mcp")
        .map((k) => ({ value: k, label: sourceKindMeta[k].label })),
      ...mcpServers.map((s) => ({ value: s.id, label: `MCP · ${s.name}` })),
    ],
    getValue: (r) =>
      r.source.kind === "mcp" ? (r.source.serverId ?? "mcp") : r.source.kind,
  },
  {
    id: "risk",
    title: "Risk",
    options: toolRisks.map((v) => ({ value: v, label: v })),
    getValue: (r) => r.risk,
  },
  {
    id: "approval",
    title: "Policy",
    options: toolApprovals.map((v) => ({ value: v, label: v })),
    getValue: (r) => r.approval,
  },
  {
    id: "status",
    title: "Status",
    options: toolStatuses.map((v) => ({ value: v, label: v })),
    getValue: (r) => r.status,
  },
  {
    id: "agent",
    title: "Agent",
    options: deployedAgents.map((a) => ({ value: a.id, label: a.name })),
    getValue: (r) => r.agentIds,
  },
]

/** Call-weighted fleet stats over tools that are not Disabled. */
function statsFor(items: Tool[]) {
  const live = items.filter((t) => t.status !== "Disabled")
  const calls24h = live.reduce((n, t) => n + t.calls24h, 0)
  const errors = live.reduce((n, t) => n + (t.calls24h * t.errorRate) / 100, 0)
  const calls14d = Array.from({ length: 14 }, (_, i) =>
    live.reduce((n, t) => n + (t.calls14d[i] ?? 0), 0)
  )
  return {
    calls24h,
    calls14d,
    errorRate: calls24h ? (errors / calls24h) * 100 : 0,
  }
}

export function ToolsTab({
  openName,
  agentId,
  onOpen,
  onOpenServer,
}: {
  openName: string | null
  /** From `?agent=`: pre-selects the Agent facet. */
  agentId?: string | null
  onOpen: (name: string | null) => void
  onOpenServer: (id: string) => void
}) {
  const items = toolStore.use()
  const open = items.find((t) => t.name === openName) ?? null
  const columns = React.useMemo(
    () => buildColumns(onOpenServer),
    [onOpenServer]
  )
  const patch = (name: string, p: Partial<Tool>) => toolStore.patch(name, p)
  const stats = statsFor(items)
  const errorTone = stats.errorRate >= 2 ? "warning" : undefined

  return (
    <div className="flex flex-col gap-6">
      <StatGrid columns={4}>
        <StatCard
          label="Tools registered"
          value={items.length}
          hint={`${items.filter((t) => t.status === "Active").length} active · ${items.filter((t) => t.source.kind === "mcp").length} from MCP servers`}
        />
        <StatCard
          label="Calls · 24h"
          value={formatNumber(stats.calls24h, true)}
          sparkline={<Sparkline data={stats.calls14d} className="h-8 w-full" />}
          hint="14-day trend, Disabled tools excluded"
        />
        <StatCard
          label="Error rate"
          value={
            <span className={errorTone && "text-warning-text"}>
              {fmtPct(stats.errorRate, 2)}
            </span>
          }
          upIsGood={false}
          hint="Weighted by call volume"
        />
        <StatCard
          label="Awaiting approval"
          value={items.reduce((n, t) => n + t.pendingApprovals, 0)}
          upIsGood={false}
          hint={`${items.filter((t) => t.approval === "Require approval" && t.status === "Active").length} tools gated by a reviewer`}
        />
      </StatGrid>

      <DataTable
        key={agentId ?? "all"}
        columns={columns}
        data={items}
        getRowId={(r) => r.name}
        getSearchText={(r) =>
          `${r.name} ${r.description} ${sourceLabel(r.source)} ${r.tags.join(" ")} ${r.risk} ${r.approval}`
        }
        searchPlaceholder="Search tools, servers, tags"
        facets={facets}
        initialFacets={agentId ? { agent: [agentId] } : undefined}
        initialSorting={[{ id: "calls24h", desc: true }]}
        initialColumnVisibility={{ ownerId: false }}
        onRowClick={(r) => onOpen(r.name)}
        totalLabel="tools"
        caption="Tool registry: one row per tool with its source, risk, policy, safety flags and 24-hour performance"
        selectionLabel={(n) => (n === 1 ? "tool" : "tools")}
        emptyIcon={<WrenchIcon />}
        toolbar={<RegisterToolButton onCreated={onOpen} />}
      />
      <ToolSheet
        tool={open}
        onClose={() => onOpen(null)}
        onPatch={patch}
        onOpenTool={onOpen}
        onOpenServer={onOpenServer}
      />
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Register tool                                                             */
/* ------------------------------------------------------------------------ */

const kindItems = (["builtin", "http", "code"] as ToolSourceKind[]).map(
  (k) => ({ value: k, label: sourceKindMeta[k].label })
)
const riskItems = toolRisks.map((r) => ({ value: r, label: r }))
const approvalItems = toolApprovals.map((a) => ({ value: a, label: a }))

/** Minimal registration form: adds an Active tool with an empty schema. */
function RegisterToolButton({
  onCreated,
}: {
  onCreated: (name: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [kind, setKind] = React.useState<ToolSourceKind>("http")
  const [label, setLabel] = React.useState("")
  const [risk, setRisk] = React.useState<ToolRisk>("Read")
  const [approval, setApproval] = React.useState<ToolApproval>("Auto")

  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
  const taken = toolStore.get().some((t) => t.name === normalized)
  const canSave = normalized.length > 1 && !taken && description.trim()

  const reset = () => {
    setName("")
    setDescription("")
    setKind("http")
    setLabel("")
    setRisk("Read")
    setApproval("Auto")
  }

  const save = () => {
    const tool: Tool = {
      name: normalized,
      description: description.trim(),
      source: {
        kind,
        label: kind === "builtin" ? undefined : label.trim() || undefined,
      },
      risk,
      approval,
      status: "Active",
      ownerId: currentUser.id,
      agentIds: [],
      calls24h: 0,
      errorRate: 0,
      p95Ms: 0,
      calls14d: Array.from({ length: 14 }, () => 0),
      pendingApprovals: 0,
      rateLimit: "60 / min",
      timeoutMs: 10_000,
      retries: 0,
      inputSchema: { type: "object", properties: {}, required: [] },
      outputDescription: "Not documented yet.",
      recentErrors: [],
      tags: ["new"],
      idempotent: risk === "Read",
      supportsDryRun: false,
      outputSinks: risk === "Read" ? ["none"] : ["writes_record"],
      identity: { mode: "service", scopes: [], tokenTtlMin: 15 },
    }
    toolStore.add(tool, "start")
    toast.success(`${tool.name} registered`, {
      description: `${risk} tool, policy ${approval}. No agent is allowlisted yet; grant it on an agent record.`,
    })
    reset()
    setOpen(false)
    onCreated(tool.name)
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> Register tool
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Register tool</SheetTitle>
            <SheetDescription>
              Adds the tool to the registry as Active with an empty input
              schema. Edit the schema from the tool sheet afterwards.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="tool-name">Name</FieldLabel>
                <Input
                  id="tool-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="lookup_customer"
                  autoComplete="off"
                  className="font-mono"
                />
                <FieldDescription>
                  {taken
                    ? `${normalized} already exists.`
                    : normalized && normalized !== name
                      ? `Stored as ${normalized}`
                      : "snake_case; this is what the model calls."}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="tool-description">Description</FieldLabel>
                <Textarea
                  id="tool-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What the tool does, in one sentence the model will read."
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="tool-kind">Source</FieldLabel>
                  <Select
                    value={kind}
                    onValueChange={(v) => v && setKind(v as ToolSourceKind)}
                    items={kindItems}
                  >
                    <SelectTrigger id="tool-kind" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {kindItems.map((k) => (
                        <SelectItem key={k.value} value={k.value}>
                          {k.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {kind !== "builtin" && (
                  <Field>
                    <FieldLabel htmlFor="tool-label">
                      {kind === "http" ? "API name" : "Runner"}
                    </FieldLabel>
                    <Input
                      id="tool-label"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder={
                        kind === "http" ? "Customer API" : "Python sandbox"
                      }
                    />
                  </Field>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="tool-risk">Risk</FieldLabel>
                  <Select
                    value={risk}
                    onValueChange={(v) => v && setRisk(v as ToolRisk)}
                    items={riskItems}
                  >
                    <SelectTrigger id="tool-risk" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {riskItems.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="tool-approval">Policy</FieldLabel>
                  <Select
                    value={approval}
                    onValueChange={(v) => v && setApproval(v as ToolApproval)}
                    items={approvalItems}
                  >
                    <SelectTrigger id="tool-approval" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {approvalItems.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FieldGroup>
          </SheetBody>
          <SheetFooterActions
            primary={
              <Button disabled={!canSave} onClick={save}>
                Register
              </Button>
            }
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
