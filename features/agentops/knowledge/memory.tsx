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
import { CopyButton } from "@/components/shared/copy-button"
import { EmptyState } from "@/components/shared/empty-state"
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { deployedAgents, getDeployedAgent } from "@/lib/data"
import {
  memoryStores as seed,
  type MemoryBackend,
  type MemoryRecord,
  type MemoryStore,
  type MemoryType,
  type MemoryWritePolicy,
  type PiiPolicy,
} from "@/lib/data/knowledge"
import { formatNumber } from "@/lib/format"
import { AgentChip, ScoreBar } from "../shared"
import { Fact, SectionTitle, fmtTtl, pct, useQueryParam } from "./shared"

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
        "h-5 px-1.5 text-[11px] font-medium whitespace-nowrap capitalize",
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
        "h-5 gap-1 px-1.5 text-[11px] font-medium capitalize",
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
      <DataTableColumnHeader column={column} title="PII" />
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
      <DataTableColumnHeader column={column} title="Hit rate" />
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

export function MemoryTab() {
  const [items, setItems] = React.useState<MemoryStore[]>(seed)
  const [openId, setOpenId] = useQueryParam("mem")
  const open = items.find((m) => m.id === openId) ?? null
  const patch = (id: string, p: Partial<MemoryStore>) =>
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...p } : m)))

  return (
    <div className="flex flex-col gap-4">
      <RightToBeForgotten />
      <DataTable
        columns={columns}
        data={items}
        getRowId={(r) => r.id}
        getSearchText={(r) =>
          `${r.name} ${r.id} ${r.type} ${r.backend} ${getDeployedAgent(r.agentId)?.name ?? ""}`
        }
        searchPlaceholder="Search memory stores…"
        facets={facets}
        initialSorting={[{ id: "records", desc: true }]}
        initialColumnVisibility={{ avgSizeKb: false, writePolicy: false }}
        onRowClick={(r) => setOpenId(r.id)}
        totalLabel="memory stores"
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

function RightToBeForgotten() {
  const [userId, setUserId] = React.useState("")
  const [confirm, setConfirm] = React.useState(false)
  const affected = seed.filter(
    (m) => m.type === "user long-term" || m.type === "session"
  )
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <UserXIcon className="size-4 text-muted-foreground" /> Right to be
            forgotten
          </p>
          <p className="text-xs text-muted-foreground">
            Purges every memory keyed to a user across {affected.length} user
            and session stores, then writes an erasure receipt to the audit log.
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
            <AlertDialogCancel>Keep memories</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirm(false)
                toast.success(`Erasure queued for ${userId.trim()}`, {
                  description: `${affected.length} stores · receipt written to audit log`,
                })
                setUserId("")
              }}
            >
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
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {m && <MemorySheetBody key={m.id} store={m} onPatch={onPatch} />}
      </SheetContent>
    </Sheet>
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
  const dirty =
    ttl !== (m.ttlDays === null ? "none" : String(m.ttlDays)) ||
    redact !== (m.piiPolicy === "redact")

  const patchRecord = (id: string, p: Partial<MemoryRecord>) =>
    onPatch(m.id, {
      sample: m.sample.map((r) => (r.id === id ? { ...r, ...p } : r)),
    })

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
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
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

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-6">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact label="Records">{formatNumber(m.records)}</Fact>
            <Fact label="Avg size">{m.avgSizeKb.toFixed(1)} KB</Fact>
            <Fact label="Hit rate">{pct(m.hitRate)}</Fact>
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
                      <code className="truncate rounded-md border bg-background px-1.5 py-0.5 font-mono text-[11px]">
                        {r.key}
                      </code>
                      {r.pinned && (
                        <Badge
                          variant="outline"
                          className="h-5 gap-1 px-1.5 text-[11px] text-brand"
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
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Edit record"
                          disabled={m.writePolicy === "read-only"}
                          onClick={() =>
                            toast("Record editor opened", {
                              description: r.key,
                            })
                          }
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Forget record"
                          className="text-danger-text hover:text-danger-text"
                          disabled={m.writePolicy === "read-only"}
                          onClick={() => {
                            onPatch(m.id, {
                              sample: m.sample.filter((x) => x.id !== r.id),
                              records: Math.max(0, m.records - 1),
                            })
                            toast("Record forgotten", {
                              description: `${r.key} removed from ${m.backend}`,
                            })
                          }}
                        >
                          <EraserIcon />
                        </Button>
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
      </div>

      <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            toast("Compaction started", {
              description: `${m.name} · ${m.backend}`,
            })
          }
        >
          Compact now
        </Button>
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
      </SheetFooter>
    </>
  )
}
