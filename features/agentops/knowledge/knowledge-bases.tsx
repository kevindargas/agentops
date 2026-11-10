"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  DownloadIcon,
  FlaskConicalIcon,
  PencilIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Sparkline } from "@/components/charts/sparkline"
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
import { UserChip } from "@/components/shared/user-chip"
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
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  ingestionJobs,
  isKbStale,
  kbSources,
  knowledgeBases as seed,
  type KnowledgeBase,
  type RetrievalConfig,
} from "@/lib/data/knowledge"
import { formatNumber } from "@/lib/format"
import { AgentChip, fmtMs } from "../shared"
import {
  EmbeddingChip,
  Fact,
  KbStateBadge,
  SectionTitle,
  StoreBadge,
  pct,
  useQueryParam,
} from "./shared"
import { TestRetrievalPanel } from "./test-retrieval"

const col = createColumnHelper<DataTableFeatures, KnowledgeBase>()

function retrievalSummary(r: RetrievalConfig) {
  return [
    `top_k ${r.topK}`,
    `BM25 ${r.hybridWeight.toFixed(2)}`,
    `thr ${r.scoreThreshold.toFixed(2)}`,
    r.reranker ? "rerank" : null,
    r.mmr ? "MMR" : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

const columns = col.columns([
  col.accessor("name", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Knowledge base" />
    ),
    cell: ({ row }) => (
      <TwoLineCell
        primary={
          <span className="inline-flex items-center gap-1.5">
            <span className="font-mono text-[13px]">{row.original.name}</span>
            {isKbStale(row.original) && (
              <TriangleAlertIcon
                className="size-3.5 text-warning"
                aria-label="Not synced in over 7 days"
              />
            )}
          </span>
        }
        secondary={row.original.description}
        title={row.original.name}
      />
    ),
    enableHiding: false,
    meta: {
      width: "min-w-72 max-w-xl",
      label: "Knowledge base",
      skeleton: "w-56",
    },
  }),
  col.accessor("store", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Store" />
    ),
    cell: ({ getValue }) => <StoreBadge store={getValue()} />,
    meta: { width: "w-32", label: "Store", skeleton: "w-16 rounded-full" },
  }),
  col.accessor("embeddingModel", {
    header: "Embedding",
    cell: ({ getValue }) => (
      <EmbeddingChip modelId={getValue()} className="text-xs" />
    ),
    enableSorting: false,
    meta: { width: "w-48", label: "Embedding model", skeleton: "w-28" },
  }),
  col.accessor("documents", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Docs" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={(n) => formatNumber(n)} />
    ),
    meta: { width: "w-20", label: "Documents", numeric: true, skeleton: "w-8" },
  }),
  col.accessor("chunks", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Chunks" />
    ),
    cell: ({ getValue }) => (
      <NumericCell
        value={getValue()}
        format={(n) => formatNumber(n, true)}
        muted
      />
    ),
    meta: { width: "w-20", label: "Chunks", numeric: true, skeleton: "w-8" },
  }),
  col.accessor((r) => `${r.chunking.size}/${r.chunking.overlap}`, {
    id: "chunking",
    header: "Chunking",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground tabular-nums">
        {row.original.chunking.size} / {row.original.chunking.overlap} ·{" "}
        {row.original.chunking.strategy}
      </span>
    ),
    enableSorting: false,
    meta: { width: "w-44", label: "Chunking", skeleton: "w-24" },
  }),
  col.accessor((r) => r.retrieval.topK, {
    id: "retrieval",
    header: "Retrieval",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground tabular-nums">
        {retrievalSummary(row.original.retrieval)}
      </span>
    ),
    enableSorting: false,
    meta: { width: "w-64", label: "Retrieval config", skeleton: "w-40" },
  }),
  col.accessor("lastSync", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Freshness" />
    ),
    cell: ({ getValue, row }) => (
      <DateCell
        value={getValue()}
        tone={isKbStale(row.original) ? "warning" : "muted"}
      />
    ),
    meta: { width: "w-28", label: "Last sync", skeleton: "w-16" },
  }),
  col.accessor((r) => r.access.agentIds.length, {
    id: "agents",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Agents" />
    ),
    cell: ({ row }) => <AgentStack ids={row.original.access.agentIds} />,
    meta: { width: "w-44", label: "Agents attached", skeleton: "w-24" },
  }),
  col.accessor("sizeGb", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Size" />
    ),
    cell: ({ getValue }) => (
      <NumericCell
        value={getValue()}
        format={(n) => `${n.toFixed(1)} GB`}
        muted
      />
    ),
    meta: { width: "w-20", label: "Size", numeric: true, skeleton: "w-10" },
  }),
  col.accessor("status", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ getValue }) => <KbStateBadge state={getValue()} />,
    meta: { width: "w-28", label: "Status", skeleton: "w-20 rounded-full" },
  }),
  col.accessor("ownerId", {
    header: "Owner",
    cell: ({ getValue }) => <UserChip userId={getValue()} size="xs" />,
    enableSorting: false,
    meta: { width: "w-40", label: "Owner", skeleton: "w-24" },
  }),
])

function AgentStack({ ids }: { ids: string[] }) {
  if (ids.length === 0)
    return <span className="text-xs text-muted-foreground">None</span>
  const shown = ids.slice(0, 2)
  return (
    <span className="flex flex-col gap-0.5">
      {shown.map((id) => (
        <AgentChip key={id} agentId={id} size="sm" />
      ))}
      {ids.length > shown.length && (
        <span className="text-xs text-muted-foreground">
          +{ids.length - shown.length} more
        </span>
      )}
    </span>
  )
}

const facets: FacetDef<KnowledgeBase>[] = [
  {
    id: "store",
    title: "Store",
    options: [...new Set(seed.map((k) => k.store))]
      .sort()
      .map((v) => ({ value: v, label: v })),
    getValue: (r) => r.store,
  },
  {
    id: "status",
    title: "Status",
    options: ["Healthy", "Syncing", "Stale", "Error"].map((v) => ({
      value: v,
      label: v,
    })),
    getValue: (r) => r.status,
  },
]

export function KnowledgeBasesTable() {
  const [items, setItems] = React.useState<KnowledgeBase[]>(seed)
  const [openId, setOpenId] = useQueryParam("kb")
  const open = items.find((k) => k.id === openId) ?? null
  const patch = (id: string, p: Partial<KnowledgeBase>) =>
    setItems((prev) => prev.map((k) => (k.id === id ? { ...k, ...p } : k)))

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        getRowId={(r) => r.id}
        getSearchText={(r) =>
          `${r.name} ${r.description} ${r.store} ${r.embeddingModel} ${r.access.agentIds.join(" ")}`
        }
        searchPlaceholder="Search knowledge bases…"
        facets={facets}
        initialSorting={[{ id: "documents", desc: true }]}
        initialColumnVisibility={{
          chunking: false,
          sizeGb: false,
          ownerId: false,
        }}
        onRowClick={(r) => setOpenId(r.id)}
        totalLabel="knowledge bases"
        selectionLabel={(n) => (n === 1 ? "knowledge base" : "knowledge bases")}
        emptyTitle="No knowledge bases"
        emptyMessage="Connect a vector store to give agents something to retrieve from."
        toolbar={
          <Button size="sm" onClick={() => toast("Create index wizard opened")}>
            New knowledge base
          </Button>
        }
      />
      <KnowledgeBaseSheet
        kb={open}
        onClose={() => setOpenId(null)}
        onPatch={patch}
      />
    </>
  )
}

/* ------------------------------------------------------------------------ */
/* Detail sheet                                                              */
/* ------------------------------------------------------------------------ */

function KnowledgeBaseSheet({
  kb,
  onClose,
  onPatch,
}: {
  kb: KnowledgeBase | null
  onClose: () => void
  onPatch: (id: string, p: Partial<KnowledgeBase>) => void
}) {
  const [editOpen, setEditOpen] = React.useState(false)
  const [testOpen, setTestOpen] = React.useState(false)
  const [reindexOpen, setReindexOpen] = React.useState(false)

  const sources = kb ? kbSources.filter((s) => s.kbId === kb.id) : []
  const jobs = kb
    ? ingestionJobs.filter((j) => j.kbId === kb.id).slice(0, 10)
    : []

  const exportConfig = () => {
    if (!kb) return
    const payload = {
      id: kb.id,
      name: kb.name,
      store: kb.store,
      embedding: { model: kb.embeddingModel, dims: kb.embeddingDims },
      chunking: kb.chunking,
      retrieval: kb.retrieval,
      access: kb.access,
      sources: sources.map((s) => ({
        id: s.id,
        type: s.type,
        connector: s.connector,
        schedule: s.schedule,
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${kb.name}.kb.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Config exported", { description: `${kb.name}.kb.json` })
  }

  return (
    <Sheet open={kb !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {kb && (
          <>
            <SheetHeader className="gap-3 border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <KbStateBadge state={kb.status} />
                <StoreBadge store={kb.store} />
                {isKbStale(kb) && (
                  <Badge
                    variant="outline"
                    className="border-warning/40 bg-warning/10 text-warning-text"
                  >
                    <TriangleAlertIcon /> Stale sync
                  </Badge>
                )}
                <span className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                  {kb.id} <CopyButton value={kb.id} label="Copy id" />
                </span>
              </div>
              <SheetTitle className="font-mono text-lg leading-tight">
                {kb.name}
              </SheetTitle>
              <SheetDescription className="text-sm leading-relaxed text-foreground/80">
                {kb.description}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-6">
                <section className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Fact label="Documents">{formatNumber(kb.documents)}</Fact>
                    <Fact label="Chunks">{formatNumber(kb.chunks)}</Fact>
                    <Fact label="Hit rate">{pct(kb.hitRate)}</Fact>
                    <Fact label="p95 latency">{fmtMs(kb.latency.p95Ms)}</Fact>
                  </div>
                  <div className="flex flex-col items-end justify-between rounded-lg border bg-muted/30 px-3 py-2">
                    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Queries · 14d
                    </p>
                    <Sparkline
                      data={kb.queries14d}
                      className="h-8 w-28"
                      color="var(--chart-1)"
                    />
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatNumber(
                        kb.queries14d.reduce((a, b) => a + b, 0),
                        true
                      )}{" "}
                      total
                    </p>
                  </div>
                </section>

                <section className="flex flex-col gap-2">
                  <SectionTitle
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditOpen(true)}
                      >
                        <PencilIcon /> Edit
                      </Button>
                    }
                  >
                    Retrieval settings
                  </SectionTitle>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Fact label="top_k">{kb.retrieval.topK}</Fact>
                    <Fact label="Score threshold">
                      {kb.retrieval.scoreThreshold.toFixed(2)}
                    </Fact>
                    <Fact label="Hybrid (BM25 weight)">
                      {kb.retrieval.hybridWeight.toFixed(2)}
                    </Fact>
                    <Fact label="Reranker">
                      {kb.retrieval.reranker ? (
                        <EmbeddingChip
                          modelId={kb.retrieval.reranker}
                          className="text-xs"
                        />
                      ) : (
                        <span className="text-muted-foreground">Off</span>
                      )}
                    </Fact>
                    <Fact label="MMR">
                      {kb.retrieval.mmr
                        ? `On · λ ${kb.retrieval.mmrLambda.toFixed(2)}`
                        : "Off"}
                    </Fact>
                    <Fact label="Embedding">
                      <EmbeddingChip
                        modelId={kb.embeddingModel}
                        className="text-xs"
                      />
                      <span className="ml-1 text-xs text-muted-foreground">
                        {kb.embeddingDims}d
                      </span>
                    </Fact>
                    <Fact label="Chunking">
                      {kb.chunking.size} tok / {kb.chunking.overlap} overlap ·{" "}
                      {kb.chunking.strategy}
                    </Fact>
                  </div>
                </section>

                <section className="flex flex-col gap-2">
                  <SectionTitle>Sources</SectionTitle>
                  {sources.length === 0 ? (
                    <EmptyState
                      size="sm"
                      title="No sources"
                      description="This index has nothing to ingest from."
                    />
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {sources.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center gap-3 px-3 py-2 text-sm"
                        >
                          <TwoLineCell
                            primary={s.name}
                            secondary={`${s.type} · ${s.connector} · ${s.scheduleLabel}`}
                            className="min-w-0 flex-1"
                          />
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatNumber(s.documents)} docs
                          </span>
                          <KbStateBadge state={s.status} size="sm" />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="flex flex-col gap-2">
                  <SectionTitle>Ingestion history</SectionTitle>
                  {jobs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No ingestion jobs recorded yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full min-w-[28rem] text-sm">
                        <thead className="bg-muted/40 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">
                              Job
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Source
                            </th>
                            <th className="px-3 py-2 text-right font-medium">
                              Docs
                            </th>
                            <th className="px-3 py-2 text-right font-medium">
                              Chunks
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Started
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {jobs.map((j) => (
                            <tr key={j.id}>
                              <td className="px-3 py-2 font-mono text-xs">
                                {j.id}
                              </td>
                              <td className="max-w-40 truncate px-3 py-2">
                                {kbSources.find((s) => s.id === j.sourceId)
                                  ?.name ?? j.sourceId}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatNumber(j.docsProcessed)}
                                <span className="text-muted-foreground">
                                  /{formatNumber(j.docsTotal)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                                {formatNumber(j.chunksWritten, true)}
                              </td>
                              <td className="px-3 py-2">
                                <DateCell value={j.startedAt} />
                              </td>
                              <td className="px-3 py-2">
                                <KbStateBadge state={j.status} size="sm" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="flex flex-col gap-2">
                  <SectionTitle>Access policy</SectionTitle>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        Agents attached
                      </p>
                      {kb.access.agentIds.length === 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          No agent can query this index.
                        </p>
                      ) : (
                        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                          {kb.access.agentIds.map((id) => (
                            <li key={id}>
                              <AgentChip agentId={id} size="sm" />
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Direct roles: {kb.access.roles.join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <PolicyFlag
                        on={kb.access.piiFilter}
                        label="PII filter"
                        hint="Chunks are scrubbed before reaching the model"
                      />
                      <PolicyFlag
                        on={kb.access.aclInheritance}
                        label="ACL inheritance"
                        hint="Source document permissions enforced per user"
                      />
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <Fact label="Owner">
                    <UserChip userId={kb.ownerId} size="xs" />
                  </Fact>
                  <Fact label="Last sync">
                    <DateCell value={kb.lastSync} tone="default" />
                  </Fact>
                  <Fact label="Size">{kb.sizeGb.toFixed(1)} GB</Fact>
                </section>
              </div>
            </div>

            <SheetFooter className="flex-row flex-wrap items-center justify-end gap-2 border-t px-6 py-4">
              <Button variant="ghost" size="sm" onClick={exportConfig}>
                <DownloadIcon /> Export config
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTestOpen(true)}
              >
                <FlaskConicalIcon /> Test retrieval
              </Button>
              <Button size="sm" onClick={() => setReindexOpen(true)}>
                <RefreshCwIcon /> Re-index
              </Button>
            </SheetFooter>

            <EditRetrievalSheet
              key={kb.id}
              open={editOpen}
              kb={kb}
              onClose={() => setEditOpen(false)}
              onSave={(retrieval) => {
                onPatch(kb.id, { retrieval })
                setEditOpen(false)
                toast.success("Retrieval settings saved", {
                  description: `${kb.name} · ${retrievalSummary(retrieval)}`,
                })
              }}
            />

            <Sheet open={testOpen} onOpenChange={setTestOpen}>
              <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
                <SheetHeader className="border-b px-6 py-5">
                  <SheetTitle>Test retrieval</SheetTitle>
                  <SheetDescription>
                    Runs a query against{" "}
                    <span className="font-mono">{kb.name}</span> with its
                    current retrieval settings.
                  </SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <TestRetrievalPanel kbId={kb.id} lockKb />
                </div>
              </SheetContent>
            </Sheet>

            <AlertDialog open={reindexOpen} onOpenChange={setReindexOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia className="bg-brand/10 text-brand">
                    <RefreshCwIcon />
                  </AlertDialogMedia>
                  <AlertDialogTitle>Re-index {kb.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All {formatNumber(kb.documents)} documents will be
                    re-chunked and re-embedded with{" "}
                    <span className="font-mono">{kb.embeddingModel}</span>.
                    Agents keep serving from the current index until the swap
                    completes. Estimated cost: ~$
                    {Math.max(1, Math.round(kb.chunks / 9000))}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setReindexOpen(false)
                      onPatch(kb.id, { status: "Syncing" })
                      toast("Re-index queued", {
                        description: `${kb.name} · ${formatNumber(kb.chunks)} chunks`,
                      })
                    }}
                  >
                    Start re-index
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function PolicyFlag({
  on,
  label,
  hint,
}: {
  on: boolean
  label: string
  hint: string
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2",
        on ? "border-success/30 bg-success/5" : "bg-muted/30"
      )}
    >
      <ShieldCheckIcon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          on ? "text-success-text" : "text-muted-foreground/60"
        )}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {label}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            · {on ? "on" : "off"}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Edit retrieval settings                                                   */
/* ------------------------------------------------------------------------ */

function EditRetrievalSheet({
  open,
  kb,
  onClose,
  onSave,
}: {
  open: boolean
  kb: KnowledgeBase
  onClose: () => void
  onSave: (r: RetrievalConfig) => void
}) {
  const [draft, setDraft] = React.useState<RetrievalConfig>(kb.retrieval)
  const update = (p: Partial<RetrievalConfig>) =>
    setDraft((d) => ({ ...d, ...p }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(kb.retrieval)

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setDraft(kb.retrieval)
          onClose()
        }
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>Retrieval settings</SheetTitle>
          <SheetDescription>
            Changes apply to every agent attached to{" "}
            <span className="font-mono">{kb.name}</span> on their next query.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-6">
            <SliderField
              id="top-k"
              label="top_k"
              hint="Chunks returned to the model after reranking."
              value={draft.topK}
              display={String(draft.topK)}
              min={1}
              max={20}
              step={1}
              onChange={(v) => update({ topK: v })}
            />
            <SliderField
              id="threshold"
              label="Score threshold"
              hint="Chunks below this similarity are dropped. Higher is stricter."
              value={draft.scoreThreshold}
              display={draft.scoreThreshold.toFixed(2)}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => update({ scoreThreshold: v })}
            />
            <SliderField
              id="hybrid"
              label="Hybrid weight (BM25)"
              hint="0 is dense-only, 1 is lexical-only. Exact identifiers favour lexical."
              value={draft.hybridWeight}
              display={draft.hybridWeight.toFixed(2)}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => update({ hybridWeight: v })}
            />
            <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
              <div>
                <Label htmlFor="rerank">Reranker</Label>
                <p className="text-xs text-muted-foreground">
                  Cross-encoder pass over the candidate set. Adds ~80 ms.
                </p>
              </div>
              <Switch
                id="rerank"
                checked={draft.reranker !== null}
                onCheckedChange={(c) =>
                  update({
                    reranker: c
                      ? (kb.retrieval.reranker ?? "cohere/rerank-v3.5")
                      : null,
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-3 rounded-lg border px-3 py-2.5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="mmr">Maximal marginal relevance</Label>
                  <p className="text-xs text-muted-foreground">
                    Trade a little relevance for diversity across sources.
                  </p>
                </div>
                <Switch
                  id="mmr"
                  checked={draft.mmr}
                  onCheckedChange={(c) => update({ mmr: c })}
                />
              </div>
              {draft.mmr && (
                <SliderField
                  id="mmr-lambda"
                  label="λ (relevance vs diversity)"
                  value={draft.mmrLambda}
                  display={draft.mmrLambda.toFixed(2)}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => update({ mmrLambda: v })}
                />
              )}
            </div>
          </div>
        </div>
        <SheetFooter className="flex-row items-center justify-end gap-2 border-t px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDraft(kb.retrieval)}
            disabled={!dirty}
          >
            Reset
          </Button>
          <Button size="sm" onClick={() => onSave(draft)} disabled={!dirty}>
            Save settings
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function SliderField({
  id,
  label,
  hint,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  value: number
  display: string
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={id}>{label}</Label>
        <span className="font-mono text-sm tabular-nums">{display}</span>
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        aria-label={label}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
