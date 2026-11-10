"use client"

import * as React from "react"
import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  BookOpenIcon,
  CloudIcon,
  ExternalLinkIcon,
  FileTextIcon,
  GitBranchIcon,
  GlobeIcon,
  HeadsetIcon,
  LayoutGridIcon,
  NotebookIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  NumericCell,
  TwoLineCell,
  actionsColumnMeta,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  getKnowledgeBase,
  ingestionJobs,
  kbSources as seed,
  type IngestionJob,
  type KbSource,
  type KbSourceType,
} from "@/lib/data/knowledge"
import { formatNumber, timeAgo } from "@/lib/format"
import { KbStateBadge, KNOWLEDGE_PATH, useQueryParam } from "./shared"

const typeIcon: Record<KbSourceType, LucideIcon> = {
  Confluence: BookOpenIcon,
  SharePoint: LayoutGridIcon,
  GitHub: GitBranchIcon,
  Zendesk: HeadsetIcon,
  Notion: NotebookIcon,
  S3: CloudIcon,
  Website: GlobeIcon,
  "ITSM Knowledge": FileTextIcon,
}

const col = createColumnHelper<DataTableFeatures, KbSource>()

function buildColumns(
  act: (id: string, action: "sync" | "pause" | "resume") => void
) {
  return col.columns([
    col.accessor("name", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Source" />
      ),
      cell: ({ row }) => {
        const Icon = typeIcon[row.original.type]
        return (
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
              <Icon className="size-3.5" />
            </span>
            <TwoLineCell
              primary={
                row.original.href ? (
                  <Link
                    href={row.original.href}
                    target={
                      row.original.href.startsWith("http")
                        ? "_blank"
                        : undefined
                    }
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    {row.original.name}
                    <ExternalLinkIcon className="size-3 text-muted-foreground" />
                  </Link>
                ) : (
                  row.original.name
                )
              }
              secondary={row.original.type}
              className="min-w-0"
            />
          </span>
        )
      },
      enableHiding: false,
      meta: { width: "min-w-60 max-w-sm", label: "Source", skeleton: "w-48" },
    }),
    col.accessor("connector", {
      header: "Connector",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {getValue()}
        </span>
      ),
      enableSorting: false,
      meta: { width: "w-40", label: "Connector", skeleton: "w-24" },
    }),
    col.accessor("kbId", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Knowledge base" />
      ),
      cell: ({ getValue }) => (
        <Link
          href={`${KNOWLEDGE_PATH}?tab=bases&kb=${getValue()}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-xs hover:underline"
        >
          {getKnowledgeBase(getValue())?.name ?? getValue()}
        </Link>
      ),
      meta: { width: "w-40", label: "Knowledge base", skeleton: "w-24" },
    }),
    col.accessor("documents", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Docs" />
      ),
      cell: ({ getValue }) => (
        <NumericCell value={getValue()} format={(n) => formatNumber(n)} />
      ),
      meta: {
        width: "w-20",
        label: "Documents",
        numeric: true,
        skeleton: "w-8",
      },
    }),
    col.accessor("lastSync", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last sync" />
      ),
      cell: ({ getValue, row }) => (
        <DateCell
          value={getValue()}
          tone={row.original.status === "Failed" ? "danger" : "muted"}
        />
      ),
      meta: { width: "w-28", label: "Last sync", skeleton: "w-16" },
    }),
    col.accessor("schedule", {
      header: "Schedule",
      cell: ({ row }) => (
        <TwoLineCell
          primary={
            <span className="text-sm font-normal">
              {row.original.scheduleLabel}
            </span>
          }
          secondary={row.original.schedule}
          mono
        />
      ),
      enableSorting: false,
      meta: { width: "w-44", label: "Schedule", skeleton: "w-28" },
    }),
    col.accessor("status", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ getValue }) => <KbStateBadge state={getValue()} />,
      meta: { width: "w-28", label: "Status", skeleton: "w-20 rounded-full" },
    }),
    col.accessor((r) => r.errors.length, {
      id: "errors",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Errors" />
      ),
      cell: ({ row }) => {
        const errs = row.original.errors
        if (errs.length === 0) return <NumericCell value={0} muted />
        return (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex w-full items-center justify-end gap-1 text-sm font-medium text-danger-text tabular-nums" />
              }
            >
              <TriangleAlertIcon className="size-3.5" aria-hidden />
              {errs.length}
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <ul className="flex flex-col gap-1 text-xs">
                {errs.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        )
      },
      meta: { width: "w-20", label: "Errors", numeric: true, skeleton: "w-6" },
    }),
    col.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const s = row.original
        const paused = s.status === "Paused"
        return (
          <span className="flex items-center justify-end gap-0.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Sync ${s.name} now`}
                    disabled={s.status === "Running"}
                    onClick={(e) => {
                      e.stopPropagation()
                      act(s.id, "sync")
                    }}
                  />
                }
              >
                <RefreshCwIcon />
              </TooltipTrigger>
              <TooltipContent>Sync now</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={paused ? `Resume ${s.name}` : `Pause ${s.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      act(s.id, paused ? "resume" : "pause")
                    }}
                  />
                }
              >
                {paused ? <PlayIcon /> : <PauseIcon />}
              </TooltipTrigger>
              <TooltipContent>{paused ? "Resume" : "Pause"}</TooltipContent>
            </Tooltip>
          </span>
        )
      },
      enableSorting: false,
      enableHiding: false,
      meta: { ...actionsColumnMeta, width: "w-20" },
    }),
  ])
}

const facets: FacetDef<KbSource>[] = [
  {
    id: "type",
    title: "Type",
    options: (Object.keys(typeIcon) as KbSourceType[]).map((v) => ({
      value: v,
      label: v,
    })),
    getValue: (r) => r.type,
  },
  {
    id: "status",
    title: "Status",
    options: ["Synced", "Running", "Failed", "Paused"].map((v) => ({
      value: v,
      label: v,
    })),
    getValue: (r) => r.status,
  },
  {
    id: "kb",
    title: "Knowledge base",
    options: [...new Set(seed.map((s) => s.kbId))].map((id) => ({
      value: id,
      label: getKnowledgeBase(id)?.name ?? id,
    })),
    getValue: (r) => r.kbId,
  },
]

export function SourcesTab() {
  const [items, setItems] = React.useState<KbSource[]>(seed)
  const [kbFilter] = useQueryParam("kb")
  const patch = (id: string, p: Partial<KbSource>) =>
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)))

  const columns = React.useMemo(
    () =>
      buildColumns((id, action) => {
        const s = items.find((x) => x.id === id)
        if (!s) return
        if (action === "sync") {
          patch(id, { status: "Running" })
          toast("Sync started", { description: `${s.name} · ${s.connector}` })
        } else if (action === "pause") {
          patch(id, { status: "Paused" })
          toast(`${s.name} paused`, {
            description: "Scheduled syncs are skipped until resumed",
          })
        } else {
          patch(id, { status: "Synced" })
          toast.success(`${s.name} resumed`)
        }
      }),
    [items]
  )

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <DataTable
        columns={columns}
        data={items}
        getRowId={(r) => r.id}
        getSearchText={(r) =>
          `${r.name} ${r.type} ${r.connector} ${getKnowledgeBase(r.kbId)?.name ?? ""} ${r.errors.join(" ")}`
        }
        searchPlaceholder="Search sources…"
        facets={facets}
        initialFacets={kbFilter ? { kb: [kbFilter] } : undefined}
        initialSorting={[{ id: "lastSync", desc: true }]}
        initialColumnVisibility={{ connector: false }}
        totalLabel="sources"
        selectionLabel={(n) => (n === 1 ? "source" : "sources")}
        emptyTitle="No sources"
        emptyMessage="Connect Confluence, SharePoint, GitHub, Zendesk, Notion, S3 or a website."
        toolbar={
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast("Connector catalog opened")}
          >
            Add source
          </Button>
        }
        className="min-w-0"
      />
      <IngestionJobsPanel />
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Ingestion jobs                                                            */
/* ------------------------------------------------------------------------ */

function IngestionJobsPanel() {
  const jobs = ingestionJobs.slice(0, 9)
  const running = ingestionJobs.filter((j) => j.status === "Running").length
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          Ingestion jobs
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            {running} running
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {jobs.length === 0 ? (
          <EmptyState size="sm" bare title="No jobs" />
        ) : (
          jobs.map((j) => <JobRow key={j.id} job={j} />)
        )}
      </CardContent>
    </Card>
  )
}

function JobRow({ job: j }: { job: IngestionJob }) {
  const source = seed.find((s) => s.id === j.sourceId)
  const kb = getKnowledgeBase(j.kbId)
  const live = j.status === "Running"
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg px-2.5 py-2",
        live && "bg-brand/5"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <TwoLineCell
          primary={
            <span className="text-sm">{source?.name ?? j.sourceId}</span>
          }
          secondary={`${kb?.name ?? j.kbId} · ${j.trigger} · ${timeAgo(j.startedAt)}`}
          className="min-w-0"
        />
        <KbStateBadge state={j.status} size="sm" />
      </div>
      <Progress
        value={j.progress}
        aria-label={`${j.id} progress`}
        className="gap-2"
      >
        <span className="w-full text-[11px] text-muted-foreground tabular-nums">
          {formatNumber(j.docsProcessed)} / {formatNumber(j.docsTotal)} docs
          {j.chunksWritten > 0 &&
            ` · ${formatNumber(j.chunksWritten, true)} chunks`}
          <span className="float-right">{j.progress}%</span>
        </span>
      </Progress>
      {j.error && (
        <p className="truncate text-[11px] text-danger-text" title={j.error}>
          {j.error}
        </p>
      )}
    </div>
  )
}
