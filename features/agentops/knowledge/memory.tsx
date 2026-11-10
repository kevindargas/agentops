"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  BrainIcon,
  EraserIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  ShieldIcon,
  UserXIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  NumericCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { useQueryParam } from "@/hooks/use-query-param"
import { CopyButton } from "@/components/shared/copy-button"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { MetricTile } from "@/components/shared/metric-tile"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { deployedAgents, getDeployedAgent } from "@/lib/data/agentops"
import type {
  MemoryBackend,
  MemoryRecord,
  MemoryStore,
  MemoryType,
  MemoryWritePolicy,
  PiiPolicy,
} from "@/lib/data/knowledge"
import { NOW } from "@/lib/data/seed"
import { formatNumber } from "@/lib/format"
import { AgentChip, ScoreBar } from "../shared"
import { Fact, SectionTitle, fmtTtl, pct } from "./shared"
import { memoryStore } from "./store"

const col = createColumnHelper<DataTableFeatures, MemoryStore>()

const typeTone: Record<MemoryType, string> = {
  session: "border-chart-2/30 bg-chart-2/15 text-chart-2",
  "user long-term": "border-brand/30 bg-brand/10 text-brand",
  organisational: "border-chart-3/30 bg-chart-3/15 text-chart-3",
  episodic: "border-chart-4/30 bg-chart-4/15 text-chart-4",
  procedural: "border-chart-5/30 bg-chart-5/15 text-chart-5",
}
const piiTone: Record<PiiPolicy, string> = {
  redact: "border-warning/40 bg-warning/10 text-warning-text",
  encrypt: "border-success/30 bg-success/10 text-success-text",
  deny: "border-border bg-muted text-muted-foreground",
}
const writeLabel: Record<MemoryWritePolicy, string> = {
  "agent-writable": "Agent-writable",
  curated: "Curated",
  "read-only": "Read-only",
}

function TypeBadge({ type }: { type: MemoryType }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 px-1.5 text-2xs font-medium whitespace-nowrap capitalize",
        typeTone[type]
      )}
    >
      {type}
    </Badge>
  )
}

function PiiBadge({ policy }: { policy: PiiPolicy }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 gap-1 px-1.5 text-2xs font-medium capitalize",
        piiTone[policy]
      )}
    >
      <ShieldIcon className="size-3" /> {policy}
    </Badge>
  )
}

const columns = col.columns([
  col.accessor("agentId", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Agent" />
    ),
    cell: ({ getValue }) => <AgentChip agentId={getValue()} />,
    enableHiding: false,
    meta: { width: "w-48", label: "Agent", skeleton: "w-32" },
  }),
  col.accessor("name", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Store" />
    ),
    cell: ({ row }) => (
      <span className="flex min-w-0 items-center gap-2">
        <TwoLineCell
          primary={row.original.name}
          secondary={row.original.id}
          mono
          className="min-w-0"
        />
      </span>
    ),
    enableHiding: false,
    meta: { width: "min-w-48", label: "Store", skeleton: "w-32" },
  }),
  col.accessor("type", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ getValue }) => <TypeBadge type={getValue()} />,
    meta: { width: "w-36", label: "Type", skeleton: "w-20 rounded-full" },
  }),
  col.accessor("backend", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Backend" />
    ),
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground">{getValue()}</span>
    ),
    meta: { width: "w-24", label: "Backend", skeleton: "w-14" },
  }),
  col.accessor("records", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Records" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={(n) => formatNumber(n)} />
    ),
    meta: { width: "w-24", label: "Records", numeric: true, skeleton: "w-10" },
  }),
  col.accessor("avgSizeKb", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Avg size" />
    ),
    cell: ({ getValue }) => (
      <NumericCell
        value={getValue()}
        format={(n) => `${n.toFixed(1)} KB`}
        muted
      />
    ),
    meta: { width: "w-24", label: "Avg size", numeric: true, skeleton: "w-10" },
  }),
  col.accessor((r) => r.ttlDays ?? Number.POSITIVE_INFINITY, {
    id: "ttl",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Retention" />
    ),
    cell: ({ row }) => (
      <span className="text-sm tabular-nums">
        {fmtTtl(row.original.ttlDays)}
      </span>
    ),
    meta: { width: "w-24", label: "Retention", skeleton: "w-10" },
  }),
  col.accessor("piiPolicy", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="PII"
        hint="How personal data is handled on write: redact replaces it with placeholders, encrypt stores it encrypted, deny refuses to store it"
      />
    ),
    cell: ({ getValue }) => <PiiBadge policy={getValue()} />,
    meta: { width: "w-24", label: "PII policy", skeleton: "w-16 rounded-full" },
  }),
  col.accessor("writePolicy", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Writes" />
    ),
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground">
        {writeLabel[getValue()]}
      </span>
    ),
    meta: { width: "w-28", label: "Write policy", skeleton: "w-16" },
  }),
  col.accessor("lastCompaction", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Compacted" />
    ),
    cell: ({ getValue }) => <DateCell value={getValue()} />,
    meta: { width: "w-28", label: "Last compaction", skeleton: "w-16" },
  }),
  col.accessor("hitRate", {
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="Hit rate"
        hint="Share of turns where a memory read contributed to the answer"
      />
    ),
    cell: ({ getValue }) => (
      <ScoreBar
        value={getValue()}
        thresholds={{ good: 60, ok: 30 }}
        label={`Hit rate ${pct(getValue())}`}
      />
    ),
    meta: { width: "w-24", label: "Hit rate", numeric: true, skeleton: "w-12" },
  }),
])

const facets: FacetDef<MemoryStore>[] = [
  {
    id: "type",
    title: "Type",
    options: (Object.keys(typeTone) as MemoryType[]).map((v) => ({
      value: v,
      label: v.charAt(0).toUpperCase() + v.slice(1),
    })),
    getValue: (r) => r.type,
  },
  {
    id: "backend",
    title: "Backend",
    options: (
      ["Redis", "Postgres", "Mem0", "Letta", "Zep"] as MemoryBackend[]
    ).map((v) => ({ value: v, label: v })),
    getValue: (r) => r.backend,
  },
  {
    id: "pii",
    title: "PII policy",
    options: (["redact", "encrypt", "deny"] as PiiPolicy[]).map((v) => ({
      value: v,
      label: v.charAt(0).toUpperCase() + v.slice(1),
    })),
    getValue: (r) => r.piiPolicy,
  },
  {
    id: "agent",
    title: "Agent",
    options: deployedAgents.map((a) => ({ value: a.id, label: a.name })),
    getValue: (r) => r.agentId,
  },
]

export function MemoryTab({
  agentId,
}: {
  /** From `?agent=`: pre-selects the Agent facet. */
  agentId?: string | null
}) {
  const items = memoryStore.use()
  const [openId, setOpenId] = useQueryParam("mem")
  const open = items.find((m) => m.id === openId) ?? null
  const patch = (id: string, p: Partial<MemoryStore>) =>
    memoryStore.patch(id, p)

  return (
    <div className="flex flex-col gap-4">
      <RightToBeForgotten />
      <DataTable
        key={agentId ?? "all"}
        columns={columns}
        data={items}
        getRowId={(r) => r.id}
        getSearchText={(r) =>
          `${r.name} ${r.id} ${r.type} ${r.backend} ${getDeployedAgent(r.agentId)?.name ?? ""}`
        }
        searchPlaceholder="Search memory stores"
        facets={facets}
        initialFacets={agentId ? { agent: [agentId] } : undefined}
        initialSorting={[{ id: "records", desc: true }]}
        initialColumnVisibility={{ avgSizeKb: false, writePolicy: false }}
        onRowClick={(r) => setOpenId(r.id)}
        totalLabel="memory stores"
        caption="Memory stores per agent with type, backend, record count, retention, PII policy and hit rate"
        selectionLabel={(n) => (n === 1 ? "memory store" : "memory stores")}
        emptyTitle="No memory stores"
        emptyMessage="Agents are stateless until a memory backend is attached."
      />
      <MemorySheet
        store={open}
        onClose={() => setOpenId(null)}
        onPatch={patch}
      />
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Right to be forgotten                                                     */
/* ------------------------------------------------------------------------ */

interface ErasureReceipt {
  id: string
  userId: string
  stores: number
  recordsRemoved: number
}

function RightToBeForgotten() {
  const stores = memoryStore.use()
  const [userId, setUserId] = React.useState("")
  const [confirm, setConfirm] = React.useState(false)
  const [receipts, setReceipts] = React.useState<ErasureReceipt[]>([])
  const affected = stores.filter(
    (m) => m.type === "user long-term" || m.type === "session"
  )

  const forget = () => {
    const id = userId.trim()
    let removed = 0
    for (const m of affected) {
      const keep = m.sample.filter(
        (r) => !r.key.includes(id) && !r.summary.includes(id)
      )
      const gone = m.sample.length - keep.length
      if (gone > 0) {
        removed += gone
        memoryStore.patch(m.id, {
          sample: keep,
          records: Math.max(0, m.records - gone),
        })
      }
    }
    const receipt: ErasureReceipt = {
      id: `erasure-${receipts.length + 1}`,
      userId: id,
      stores: affected.length,
      recordsRemoved: removed,
    }
    setReceipts((r) => [receipt, ...r])
    setConfirm(false)
    setUserId("")
    toast.success(`Erasure recorded for ${id}`, {
      description: `${removed} sampled ${removed === 1 ? "record" : "records"} removed across ${affected.length} user and session stores. The receipt is listed on this card for the session.`,
    })
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <UserXIcon className="size-4 text-muted-foreground" /> Right to be
              forgotten
            </p>
            <p className="text-xs text-muted-foreground">
              Removes every memory keyed to a user across {affected.length} user
              and session stores and records an erasure receipt below. A real
              backend also writes the receipt to the Audit Log.
            </p>
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (userId.trim()) setConfirm(true)
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rtbf-user" className="text-xs">
                User id
              </Label>
              <Input
                id="rtbf-user"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="user_demo_1041"
                className="h-8 w-56 font-mono text-xs"
                autoComplete="off"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={!userId.trim()}
            >
              <EraserIcon /> Forget user
            </Button>
          </form>
        </div>
        {receipts.length > 0 && (
          <div className="rounded-lg border bg-muted/30 px-3 py-2">
            <Eyebrow as="span">Erasure receipts · this session</Eyebrow>
            <ul className="mt-1.5 divide-y text-xs">
              {receipts.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5 first:pt-0 last:pb-0"
                >
                  <span className="font-mono">{r.userId}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {r.recordsRemoved} sampled{" "}
                    {r.recordsRemoved === 1 ? "record" : "records"} removed
                    across {r.stores} stores
                  </span>
                  <Badge variant="outline" className="ml-auto text-2xs">
                    {r.id}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <UserXIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Forget <span className="font-mono">{userId.trim()}</span>?
            </AlertDialogTitle>
            <AlertDialogDescription>
              All memories for this user are deleted from{" "}
              {affected
                .map((m) => m.name)
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(", ")}{" "}
              across {new Set(affected.map((m) => m.agentId)).size} agents.
              Backups are purged within 30 days. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={forget}>
              Forget everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

/* ------------------------------------------------------------------------ */
/* Detail sheet                                                              */
/* ------------------------------------------------------------------------ */

const ttlOptions: { value: string; label: string }[] = [
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "180 days" },
  { value: "365", label: "1 year" },
  { value: "none", label: "No expiry" },
]

function MemorySheet({
  store: m,
  onClose,
  onPatch,
}: {
  store: MemoryStore | null
  onClose: () => void
  onPatch: (id: string, p: Partial<MemoryStore>) => void
}) {
  return (
    <Sheet open={m !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
      >
        {m && <MemorySheetBody key={m.id} store={m} onPatch={onPatch} />}
      </SheetContent>
    </Sheet>
  )
}

function ReadOnlyHint({
  readOnly,
  children,
}: {
  readOnly: boolean
  children: React.ReactElement
}) {
  if (!readOnly) return children
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>
        Read-only store: records cannot be changed
      </TooltipContent>
    </Tooltip>
  )
}

function MemorySheetBody({
  store: m,
  onPatch,
}: {
  store: MemoryStore
  onPatch: (id: string, p: Partial<MemoryStore>) => void
}) {
  const [ttl, setTtl] = React.useState(
    m.ttlDays === null ? "none" : String(m.ttlDays)
  )
  const [redact, setRedact] = React.useState(m.piiPolicy === "redact")
  const [editing, setEditing] = React.useState<MemoryRecord | null>(null)
  const dirty =
    ttl !== (m.ttlDays === null ? "none" : String(m.ttlDays)) ||
    redact !== (m.piiPolicy === "redact")
  const readOnly = m.writePolicy === "read-only"

  const patchRecord = (id: string, p: Partial<MemoryRecord>) =>
    onPatch(m.id, {
      sample: m.sample.map((r) => (r.id === id ? { ...r, ...p } : r)),
    })

  const forgetRecord = (r: MemoryRecord) => {
    const index = m.sample.findIndex((x) => x.id === r.id)
    onPatch(m.id, {
      sample: m.sample.filter((x) => x.id !== r.id),
      records: Math.max(0, m.records - 1),
    })
    toast("Record forgotten", {
      description: `${r.key} removed from ${m.backend}`,
      duration: 8000,
      action: {
        label: "Undo",
        onClick: () => {
          const current = memoryStore.get().find((x) => x.id === m.id)
          if (!current) return
          const sample = [...current.sample]
          sample.splice(Math.min(index, sample.length), 0, r)
          onPatch(m.id, { sample, records: current.records + 1 })
        },
      },
    })
  }

  return (
    <>
      <SheetHeader className="gap-3 border-b px-6 py-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeBadge type={m.type} />
          <PiiBadge policy={m.piiPolicy} />
          <Badge variant="outline" className="text-muted-foreground">
            {m.backend}
          </Badge>
          <Badge variant="outline" className="text-muted-foreground">
            {writeLabel[m.writePolicy]}
          </Badge>
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-2xs text-muted-foreground">
            {m.id} <CopyButton value={m.id} label="Copy id" />
          </span>
        </div>
        <SheetTitle className="text-lg leading-tight">{m.name}</SheetTitle>
        <SheetDescription className="flex items-center gap-2 text-sm">
          <AgentChip agentId={m.agentId} size="sm" />
          <span className="text-muted-foreground">
            · {formatNumber(m.records)} records · {fmtTtl(m.ttlDays)} retention
          </span>
        </SheetDescription>
      </SheetHeader>

      <SheetBody>
        <div className="flex flex-col gap-6">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile label="Records" value={formatNumber(m.records)} />
            <MetricTile
              label="Avg size"
              value={m.avgSizeKb.toFixed(1)}
              unit="KB"
            />
            <MetricTile label="Hit rate" value={pct(m.hitRate)} />
            <Fact label="Compacted">
              <DateCell value={m.lastCompaction} tone="default" />
            </Fact>
          </section>

          <section className="flex flex-col gap-2">
            <SectionTitle>
              Sample records{" "}
              <span className="text-xs font-normal text-muted-foreground">
                · synthetic, for illustration only
              </span>
            </SectionTitle>
            {m.sample.length === 0 ? (
              <EmptyState
                size="sm"
                icon={<BrainIcon />}
                title="No records left"
                description="Every sampled memory was forgotten."
              />
            ) : (
              <ul className="divide-y rounded-lg border">
                {m.sample.map((r) => (
                  <li key={r.id} className="flex flex-col gap-1.5 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <code className="truncate rounded-md border bg-background px-1.5 py-0.5 font-mono text-2xs">
                        {r.key}
                      </code>
                      {r.pinned && (
                        <Badge
                          variant="outline"
                          className="h-5 gap-1 px-1.5 text-2xs text-brand"
                        >
                          <PinIcon className="size-3" /> Pinned
                        </Badge>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {r.writtenBy}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{r.summary}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        Created <DateCell value={r.created} />
                      </span>
                      <span className="tabular-nums">
                        Confidence{" "}
                        <span
                          className={cn(
                            "font-medium",
                            r.confidence >= 0.8
                              ? "text-success-text"
                              : r.confidence >= 0.6
                                ? "text-warning-text"
                                : "text-danger-text"
                          )}
                        >
                          {r.confidence.toFixed(2)}
                        </span>
                      </span>
                      <span className="ml-auto flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={r.pinned ? "Unpin record" : "Pin record"}
                          onClick={() => {
                            patchRecord(r.id, { pinned: !r.pinned })
                            toast(
                              r.pinned ? "Record unpinned" : "Record pinned",
                              {
                                description: r.key,
                              }
                            )
                          }}
                        >
                          {r.pinned ? <PinOffIcon /> : <PinIcon />}
                        </Button>
                        <ReadOnlyHint readOnly={readOnly}>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Edit record"
                            disabled={readOnly}
                            onClick={() => setEditing(r)}
                          >
                            <PencilIcon />
                          </Button>
                        </ReadOnlyHint>
                        <ReadOnlyHint readOnly={readOnly}>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Forget record"
                            className="text-danger-text hover:text-danger-text"
                            disabled={readOnly}
                            onClick={() => forgetRecord(r)}
                          >
                            <EraserIcon />
                          </Button>
                        </ReadOnlyHint>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>Retention policy</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ttl">Time to live</Label>
                <Select
                  value={ttl}
                  onValueChange={(v) => v && setTtl(v)}
                  items={ttlOptions}
                >
                  <SelectTrigger id="ttl" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ttlOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Records older than the TTL are dropped at the next compaction.
                </p>
              </div>
              <div className="flex items-start justify-between gap-4 rounded-lg border px-3 py-2.5">
                <div>
                  <Label htmlFor="redact">Redact PII on write</Label>
                  <p className="text-xs text-muted-foreground">
                    Names, emails and ids are replaced with placeholders before
                    storage.
                  </p>
                </div>
                <Switch
                  id="redact"
                  checked={redact}
                  onCheckedChange={setRedact}
                />
              </div>
            </div>
          </section>
        </div>
      </SheetBody>

      <SheetFooterActions
        tertiary={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onPatch(m.id, { lastCompaction: NOW.toISOString() })
              toast("Compaction recorded", {
                description: `${m.name} · ${m.backend}. Last compaction set to now; the backend you wire does the actual compaction.`,
              })
            }}
          >
            Compact now
          </Button>
        }
        primary={
          <Button
            size="sm"
            disabled={!dirty}
            onClick={() => {
              onPatch(m.id, {
                ttlDays: ttl === "none" ? null : Number(ttl),
                piiPolicy: redact
                  ? "redact"
                  : m.piiPolicy === "redact"
                    ? "encrypt"
                    : m.piiPolicy,
              })
              toast.success("Retention policy saved", {
                description: `${m.name} · TTL ${ttlOptions.find((o) => o.value === ttl)?.label.toLowerCase()} · PII ${redact ? "redacted" : "not redacted"}`,
              })
            }}
          >
            Save policy
          </Button>
        }
      />

      <EditRecordDialog
        key={editing?.id ?? "none"}
        record={editing}
        onClose={() => setEditing(null)}
        onSave={(summary) => {
          if (!editing) return
          patchRecord(editing.id, { summary, writtenBy: "curator" })
          toast.success("Record updated", {
            description: `${editing.key} now written by curator`,
          })
          setEditing(null)
        }}
      />
    </>
  )
}

function EditRecordDialog({
  record,
  onClose,
  onSave,
}: {
  record: MemoryRecord | null
  onClose: () => void
  onSave: (summary: string) => void
}) {
  const [summary, setSummary] = React.useState(record?.summary ?? "")
  const dirty = record ? summary.trim() !== record.summary : false
  return (
    <Dialog open={record !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit record</DialogTitle>
          <DialogDescription>
            <code className="font-mono text-xs">{record?.key}</code>. Edits mark
            the record as curated.
          </DialogDescription>
        </DialogHeader>
        <Label htmlFor="record-summary" className="sr-only">
          Summary
        </Label>
        <Textarea
          id="record-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={4}
          className="text-sm"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!dirty || !summary.trim()}
            onClick={() => onSave(summary.trim())}
          >
            Save record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
