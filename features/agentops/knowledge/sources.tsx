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
  PlusIcon,
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
import { useQueryParam } from "@/hooks/use-query-param"
import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ingestionJobs,
  type IngestionJob,
  type KbSource,
  type KbSourceType,
} from "@/lib/data/knowledge"
import { NOW } from "@/lib/data/seed"
import { formatNumber, timeAgo } from "@/lib/format"
import { KbStateBadge, KNOWLEDGE_PATH, sourceTypeLabel } from "./shared"
import { kbStore, sourceStore } from "./store"

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
  kbName: (id: string) => string,
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
              secondary={sourceTypeLabel[row.original.type]}
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
          {kbName(getValue())}
        </Link>
      ),
      meta: { width: "w-40", label: "Knowledge base", skeleton: "w-24" },
    }),
    col.accessor("documents", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Documents" />
      ),
      cell: ({ getValue }) => (
        <NumericCell value={getValue()} format={(n) => formatNumber(n)} />
      ),
      meta: {
        width: "w-24",
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
              <TooltipContent>
                {s.status === "Running"
                  ? "A sync is already running"
                  : "Sync now"}
              </TooltipContent>
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

export function SourcesTab() {
  const items = sourceStore.use()
  const bases = kbStore.use()
  const [kbFilter] = useQueryParam("kb")
  const kbName = React.useCallback(
    (id: string) => bases.find((k) => k.id === id)?.name ?? id,
    [bases]
  )

  const facets = React.useMemo<FacetDef<KbSource>[]>(
    () => [
      {
        id: "type",
        title: "Type",
        options: (Object.keys(typeIcon) as KbSourceType[]).map((v) => ({
          value: v,
          label: sourceTypeLabel[v],
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
        options: bases.map((k) => ({ value: k.id, label: k.name })),
        getValue: (r) => r.kbId,
      },
    ],
    [bases]
  )

  const columns = React.useMemo(
    () =>
      buildColumns(kbName, (id, action) => {
        const s = sourceStore.get().find((x) => x.id === id)
        if (!s) return
        if (action === "sync") {
          sourceStore.patch(id, { status: "Running" })
          toast("Status set to Running", {
            description: `${s.name} · ${s.connector}. The sync itself runs in the connector service you wire.`,
          })
        } else if (action === "pause") {
          sourceStore.patch(id, { status: "Paused" })
          toast(`${s.name} paused`, {
            description: "Scheduled syncs are skipped until resumed",
          })
        } else {
          sourceStore.patch(id, { status: "Synced" })
          toast.success(`${s.name} resumed`)
        }
      }),
    [kbName]
  )

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <DataTable
        columns={columns}
        data={items}
        getRowId={(r) => r.id}
        getSearchText={(r) =>
          `${r.name} ${r.type} ${sourceTypeLabel[r.type]} ${r.connector} ${kbName(r.kbId)} ${r.errors.join(" ")}`
        }
        searchPlaceholder="Search sources"
        facets={facets}
        initialFacets={kbFilter ? { kb: [kbFilter] } : undefined}
        initialSorting={[{ id: "lastSync", desc: true }]}
        initialColumnVisibility={{ connector: false }}
        totalLabel="sources"
        caption="Ingestion sources with their connector, target knowledge base, schedule, status and errors"
        selectionLabel={(n) => (n === 1 ? "source" : "sources")}
        emptyTitle="No sources"
        emptyMessage="Connect Confluence, SharePoint, GitHub, Zendesk, Notion, S3 or a website."
        toolbar={<AddSourceButton />}
        className="min-w-0"
      />
      <IngestionJobsPanel />
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Add source                                                                */
/* ------------------------------------------------------------------------ */

const typeItems = (Object.keys(typeIcon) as KbSourceType[]).map((t) => ({
  value: t,
  label: sourceTypeLabel[t],
}))
const scheduleItems = [
  { value: "0 * * * *", label: "Hourly" },
  { value: "0 */6 * * *", label: "Every 6 hours" },
  { value: "0 2 * * *", label: "Daily at 02:00 UTC" },
  { value: "0 3 * * 1", label: "Weekly on Monday" },
]

function AddSourceButton() {
  const bases = kbStore.use()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [type, setType] = React.useState<KbSourceType>("Confluence")
  const [kbId, setKbId] = React.useState(bases[0]?.id ?? "")
  const [schedule, setSchedule] = React.useState(scheduleItems[2].value)
  const [href, setHref] = React.useState("")
  const kbItems = bases.map((k) => ({ value: k.id, label: k.name }))
  const canSave = name.trim().length > 1 && kbId

  const reset = () => {
    setName("")
    setType("Confluence")
    setSchedule(scheduleItems[2].value)
    setHref("")
  }

  const save = () => {
    const seq = sourceStore.get().length + 1
    const source: KbSource = {
      id: `src-${String(seq).padStart(3, "0")}`,
      name: name.trim(),
      type,
      connector: `${type.toLowerCase().replace(/\s+/g, "-")}@1.0`,
      kbId,
      documents: 0,
      lastSync: NOW.toISOString(),
      schedule,
      scheduleLabel:
        scheduleItems.find((s) => s.value === schedule)?.label ?? schedule,
      status: "Running",
      errors: [],
      href: href.trim() || undefined,
    }
    sourceStore.add(source, "start")
    const kb = bases.find((k) => k.id === kbId)
    toast.success(`${source.name} added`, {
      description: `${sourceTypeLabel[type]} source feeding ${kb?.name ?? kbId}, first sync marked Running.`,
    })
    reset()
    setOpen(false)
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <PlusIcon /> Add source
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Add source</SheetTitle>
            <SheetDescription>
              Registers a connector feeding one knowledge base. The first sync
              is marked Running; documents arrive once the connector runs.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="source-name">Name</FieldLabel>
                <Input
                  id="source-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Vendor contracts (SharePoint)"
                  autoComplete="off"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="source-type">Type</FieldLabel>
                  <Select
                    value={type}
                    onValueChange={(v) => v && setType(v as KbSourceType)}
                    items={typeItems}
                  >
                    <SelectTrigger id="source-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {typeItems.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="source-kb">Knowledge base</FieldLabel>
                  <Select
                    value={kbId}
                    onValueChange={(v) => v && setKbId(v)}
                    items={kbItems}
                  >
                    <SelectTrigger id="source-kb" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {kbItems.map((k) => (
                        <SelectItem key={k.value} value={k.value}>
                          {k.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="source-schedule">Schedule</FieldLabel>
                <Select
                  value={schedule}
                  onValueChange={(v) => v && setSchedule(v)}
                  items={scheduleItems}
                >
                  <SelectTrigger id="source-schedule" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleItems.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription className="font-mono">
                  {schedule}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="source-href">Link (optional)</FieldLabel>
                <Input
                  id="source-href"
                  value={href}
                  onChange={(e) => setHref(e.target.value)}
                  placeholder="https://wiki.example.com/spaces/..."
                  autoComplete="off"
                />
              </Field>
            </FieldGroup>
          </SheetBody>
          <SheetFooterActions
            primary={
              <Button disabled={!canSave} onClick={save}>
                Add source
              </Button>
            }
          />
        </SheetContent>
      </Sheet>
    </>
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
          <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
            <CountPill count={running} tone={running ? "progress" : "muted"} />{" "}
            running
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {jobs.length === 0 ? (
          <EmptyState
            size="sm"
            bare
            title="No jobs"
            description="Jobs appear here when a source syncs."
          />
        ) : (
          jobs.map((j) => <JobRow key={j.id} job={j} />)
        )}
      </CardContent>
    </Card>
  )
}

function JobRow({ job: j }: { job: IngestionJob }) {
  const sources = sourceStore.use()
  const bases = kbStore.use()
  const source = sources.find((s) => s.id === j.sourceId)
  const kb = bases.find((k) => k.id === j.kbId)
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
        <span className="w-full text-2xs text-muted-foreground tabular-nums">
          {formatNumber(j.docsProcessed)} / {formatNumber(j.docsTotal)} docs
          {j.chunksWritten > 0 &&
            ` · ${formatNumber(j.chunksWritten, true)} chunks`}
          <span className="float-right">{j.progress}%</span>
        </span>
      </Progress>
      {j.error && (
        <p className="truncate text-2xs text-danger-text" title={j.error}>
          {j.error}
        </p>
      )}
    </div>
  )
}
