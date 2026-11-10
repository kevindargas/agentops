"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  KeyRoundIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  DataTable,
  DataTableColumnHeader,
  DateCell,
  EmptyValue,
  NumericCell,
  TwoLineCell,
  type DataTableFeatures,
  type FacetDef,
} from "@/components/data-table"
import { setQueryParam } from "@/hooks/use-query-param"
import { DetailList } from "@/components/shared/detail-list"
import { EmptyState } from "@/components/shared/empty-state"
import { MetricTile } from "@/components/shared/metric-tile"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { UserChip } from "@/components/shared/user-chip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { deployedAgents, getDeployedAgent } from "@/lib/data/agentops"
import {
  triggerSources,
  type SecretStatus,
  type Trigger,
  type TriggerAction,
  type TriggerSource,
  type TriggerStatus,
} from "@/lib/data/schedules"
import { clock } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import { formatMs } from "@/lib/format"
import { AgentChip } from "../shared"
import {
  Mono,
  TargetPausedBadge,
  TriggerStatusBadge,
  actionIcon,
  sourceIcon,
} from "./shared"
import { nextLocalId, queueRun, triggerStore } from "./store"

const col = createColumnHelper<DataTableFeatures, Trigger>()

const secretTone: Record<SecretStatus, string> = {
  Valid: "text-success-text",
  Rotating: "text-warning-text",
  Missing: "text-danger-text",
}

/** Sources that come from outside the platform and therefore carry a shared secret. */
const externalSources: TriggerSource[] = [
  "Webhook",
  "Slack mention",
  "Email inbox",
  "Git push",
]

function SecretChip({ secret }: { secret: Trigger["secret"] }) {
  if (!secret) return <span className="text-xs text-muted-foreground">n/a</span>
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        secretTone[secret.status]
      )}
      title={secret.kind}
    >
      <KeyRoundIcon className="size-3.5" />
      {secret.status}
    </span>
  )
}

function buildColumns(onTest: (t: Trigger) => void) {
  return col.columns([
    col.accessor("name", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Trigger" />
      ),
      cell: ({ row }) => {
        const Icon = sourceIcon[row.original.source]
        return (
          <span className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
              <Icon className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <TwoLineCell
                primary={row.original.name}
                secondary={
                  row.original.sourceDetail
                    ? `${row.original.source} · ${row.original.sourceDetail}`
                    : row.original.source
                }
              />
              {row.original.status === "Active" && (
                <TargetPausedBadge
                  agentId={row.original.agentId}
                  className="w-fit"
                />
              )}
            </span>
          </span>
        )
      },
      enableHiding: false,
      meta: { width: "min-w-56 max-w-xs", label: "Trigger", skeleton: "w-40" },
    }),
    col.accessor("condition", {
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Condition"
          hint="Filter expression evaluated against each incoming event. The trigger fires when it is true."
        />
      ),
      cell: ({ getValue }) => (
        <code
          className="block max-w-sm truncate font-mono text-2xs text-muted-foreground"
          title={getValue()}
        >
          {getValue()}
        </code>
      ),
      enableSorting: false,
      meta: {
        width: "min-w-56 max-w-sm",
        label: "Condition",
        skeleton: "w-48",
      },
    }),
    col.accessor("agentId", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Target" />
      ),
      cell: ({ getValue }) => <AgentChip agentId={getValue()} />,
      sortFn: (a, b) =>
        (getDeployedAgent(a.original.agentId)?.name ?? "").localeCompare(
          getDeployedAgent(b.original.agentId)?.name ?? ""
        ),
      meta: { width: "w-44", label: "Target agent", skeleton: "w-28" },
    }),
    col.accessor("action", {
      header: "Action",
      cell: ({ getValue }) => {
        const Icon = actionIcon[getValue()]
        return (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <Icon className="size-3.5 text-muted-foreground" />
            {getValue()}
          </span>
        )
      },
      enableSorting: false,
      meta: { width: "w-32", label: "Action", skeleton: "w-20" },
    }),
    col.accessor("fired24h", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Fired · 24h" />
      ),
      cell: ({ getValue }) => <NumericCell value={getValue()} />,
      meta: {
        width: "w-24",
        label: "Fired 24h",
        numeric: true,
        skeleton: "w-8",
      },
    }),
    col.accessor((r) => r.lastFired ?? "", {
      id: "lastFired",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last fired" />
      ),
      cell: ({ getValue }) => <DateCell value={getValue() || null} />,
      meta: { width: "w-28", label: "Last fired", skeleton: "w-16" },
    }),
    col.accessor("failureRate", {
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Failure rate"
          hint="Share of deliveries in the last 24 hours that returned a 4xx or 5xx status. Red at 10% or more, amber at 3% or more."
        />
      ),
      cell: ({ getValue }) => (
        <NumericCell
          value={getValue()}
          format={(n) => `${n.toFixed(1)}%`}
          className={cn(
            getValue() >= 10
              ? "text-danger-text"
              : getValue() >= 3
                ? "text-warning-text"
                : undefined
          )}
          muted={getValue() < 3}
        />
      ),
      meta: {
        width: "w-28",
        label: "Failure rate",
        numeric: true,
        skeleton: "w-10",
      },
    }),
    col.accessor("status", {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ getValue }) => <TriggerStatusBadge status={getValue()} />,
      meta: { width: "w-24", label: "Status", skeleton: "w-16 rounded-full" },
    }),
    col.accessor((r) => r.secret?.status ?? "", {
      id: "secret",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Secret"
          hint="HMAC-SHA256 signature or bearer token that proves a delivery came from the sender. Internal event sources have none."
        />
      ),
      cell: ({ row }) => <SecretChip secret={row.original.secret} />,
      enableSorting: false,
      meta: { width: "w-24", label: "Secret / HMAC", skeleton: "w-12" },
    }),
    col.display({
      id: "test",
      header: "",
      cell: ({ row }) => (
        <Button
          size="xs"
          variant="outline"
          onClick={() => onTest(row.original)}
          aria-label={`Test ${row.original.name}`}
        >
          <SendIcon /> Test
        </Button>
      ),
      enableHiding: false,
      meta: { width: "w-20", align: "right", skeleton: "w-12" },
    }),
  ])
}

const facets: FacetDef<Trigger>[] = [
  {
    id: "source",
    title: "Source",
    options: triggerSources.map((s) => ({ value: s, label: s })),
    getValue: (r) => r.source,
  },
  {
    id: "status",
    title: "Status",
    options: (["Active", "Paused", "Error"] as TriggerStatus[]).map((s) => ({
      value: s,
      label: s,
    })),
    getValue: (r) => r.status,
  },
  {
    id: "agent",
    title: "Target agent",
    options: deployedAgents.map((a) => ({ value: a.id, label: a.name })),
    getValue: (r) => r.agentId,
  },
]

/* ------------------------------------------------------------------------ */
/* Actions                                                                   */
/* ------------------------------------------------------------------------ */

function toggleTrigger(t: Trigger) {
  const next: TriggerStatus = t.status === "Paused" ? "Active" : "Paused"
  const prev = t.status
  triggerStore.patch(t.id, { status: next })
  toast(next === "Paused" ? "Trigger paused" : "Trigger resumed", {
    description:
      next === "Paused"
        ? `${t.name} stops firing until resumed.`
        : `${t.name} is listening again.`,
    action: {
      label: "Undo",
      onClick: () => triggerStore.patch(t.id, { status: prev }),
    },
  })
}

/**
 * Simulated test delivery: records a 202 under Recent deliveries and, for
 * "Run agent" triggers, appends a dry run to Run history. Nothing leaves the
 * browser.
 */
function sendTestDelivery(t: Trigger) {
  const agent = getDeployedAgent(t.agentId)
  const run =
    t.action === "Run agent" && !agent?.paused
      ? queueRun({
          source: "trigger",
          sourceId: t.id,
          sourceName: t.name,
          agentId: t.agentId,
        })
      : null
  const delivery = {
    id: nextLocalId("dlv"),
    at: clock().toISOString(),
    statusCode: 202,
    latencyMs: 90 + (t.name.length % 7) * 15,
    runId: run?.id,
  }
  triggerStore.patch(t.id, (prev) => ({
    ...prev,
    deliveries: [delivery, ...prev.deliveries],
    lastFired: delivery.at,
    fired24h: prev.fired24h + 1,
  }))
  toast.success("Test delivery recorded (simulated)", {
    description: run
      ? `202 added under Recent deliveries · dry run ${run.id} added to Run history on ${agent?.name ?? t.agentId}.`
      : agent?.paused
        ? `202 added under Recent deliveries. ${agent.name} is paused, so no run was queued.`
        : `202 added under Recent deliveries · action "${t.action}" is not executed in this template.`,
  })
}

/* ------------------------------------------------------------------------ */
/* Table                                                                     */
/* ------------------------------------------------------------------------ */

export function TriggersTable({
  agentId,
  initialAgentId,
  initialOpenId,
}: {
  /** Hard filter: hides the agent facet (agent record pages). */
  agentId?: string
  /** Preselects the agent facet (`?agent=` on the list page). */
  initialAgentId?: string
  /** Opens this trigger's sheet on load (`?trigger=`). */
  initialOpenId?: string
}) {
  const items = triggerStore.use()
  const [openId, setOpenIdState] = React.useState<string | null>(() =>
    initialOpenId && triggerStore.get().some((t) => t.id === initialOpenId)
      ? initialOpenId
      : null
  )
  const [testId, setTestId] = React.useState<string | null>(null)
  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const columns = React.useMemo(
    () => buildColumns((t) => setTestId(t.id)),
    [setTestId]
  )

  const setOpenId = React.useCallback((id: string | null) => {
    setOpenIdState(id)
    setQueryParam("trigger", id)
  }, [])

  const data = agentId ? items.filter((t) => t.agentId === agentId) : items
  const open = items.find((t) => t.id === openId) ?? null
  const testing = items.find((t) => t.id === testId) ?? null
  const deleting = items.find((t) => t.id === deleteId) ?? null

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        getRowId={(r) => r.id}
        getSearchText={(r) =>
          `${r.name} ${r.source} ${r.sourceDetail ?? ""} ${r.condition} ${getDeployedAgent(r.agentId)?.name ?? ""}`
        }
        searchPlaceholder="Search triggers…"
        facets={agentId ? facets.filter((f) => f.id !== "agent") : facets}
        initialFacets={
          initialAgentId && !agentId ? { agent: [initialAgentId] } : undefined
        }
        initialSorting={[{ id: "fired24h", desc: true }]}
        initialColumnVisibility={{ lastFired: false }}
        onRowClick={(r) => setOpenId(r.id)}
        totalLabel="triggers"
        caption="Event triggers with target agent, delivery health and secret status"
        selectionLabel={(n) => (n === 1 ? "trigger" : "triggers")}
        emptyTitle="No triggers"
        emptyMessage="Connect a webhook, queue or record event to start an agent on demand."
        emptyIcon={<ZapIcon />}
        toolbar={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon /> New trigger
          </Button>
        }
      />
      <TriggerSheet
        trigger={open}
        onClose={() => setOpenId(null)}
        onTest={() => setTestId(openId)}
        onDelete={() => setDeleteId(openId)}
      />
      <TestTriggerDialog
        trigger={testing}
        onClose={() => setTestId(null)}
        onSend={(t) => {
          setTestId(null)
          sendTestDelivery(t)
        }}
      />
      <NewTriggerSheet
        open={createOpen}
        defaultAgentId={initialAgentId ?? agentId}
        onClose={() => setCreateOpen(false)}
        onCreate={(t) => {
          triggerStore.add(t, "start")
          setCreateOpen(false)
          toast.success("Trigger created", {
            description: `${t.name} · ${t.source} · ${t.action} on ${getDeployedAgent(t.agentId)?.name ?? t.agentId}`,
          })
        }}
      />
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The sender keeps posting events but nothing listens any more.
              Deliveries already recorded stay in Run history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (!deleting) return
                const removed = deleting
                triggerStore.remove(removed.id)
                setDeleteId(null)
                setOpenId(null)
                toast("Trigger deleted", {
                  description: removed.name,
                  action: {
                    label: "Undo",
                    onClick: () => triggerStore.add(removed, "start"),
                  },
                })
              }}
            >
              <Trash2Icon /> Delete trigger
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/* ------------------------------------------------------------------------ */
/* Detail sheet                                                              */
/* ------------------------------------------------------------------------ */

function TriggerSheet({
  trigger: t,
  onClose,
  onTest,
  onDelete,
}: {
  trigger: Trigger | null
  onClose: () => void
  onTest: () => void
  onDelete: () => void
}) {
  const secret = t?.secret
  return (
    <Sheet open={t !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
      >
        {t && (
          <>
            <SheetHeader className="gap-3 border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="font-mono text-2xs text-muted-foreground"
                >
                  {t.id}
                </Badge>
                <TriggerStatusBadge status={t.status} size="sm" />
                <Badge
                  variant="outline"
                  className="text-2xs text-muted-foreground"
                >
                  {t.source}
                  {t.sourceDetail ? ` · ${t.sourceDetail}` : ""}
                </Badge>
                {t.status === "Active" && (
                  <TargetPausedBadge agentId={t.agentId} />
                )}
                <span className="ml-auto">
                  <AgentChip agentId={t.agentId} size="sm" />
                </span>
              </div>
              <SheetTitle className="text-lg leading-tight">
                {t.name}
              </SheetTitle>
              <SheetDescription>
                <code className="block rounded-md border bg-muted/40 px-2.5 py-1.5 font-mono text-xs leading-relaxed break-all">
                  {t.condition}
                </code>
              </SheetDescription>
            </SheetHeader>

            <SheetBody>
              <div className="flex flex-col gap-6">
                {t.status === "Error" && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                    <p className="font-medium">
                      Delivery failures above threshold
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.failureRate.toFixed(1)}% of deliveries failed in the
                      last 24 hours. The trigger keeps firing; failed deliveries
                      are retried three times.
                    </p>
                  </div>
                )}
                {secret?.status === "Missing" && (
                  <div className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-sm">
                    <p className="font-medium">Signing secret missing</p>
                    <p className="text-xs text-muted-foreground">
                      Deliveries are accepted without signature verification.
                      Set an HMAC secret on both sides to close this gap.
                    </p>
                  </div>
                )}

                <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MetricTile label="Fired · 24h" value={t.fired24h} />
                  <MetricTile
                    label="Failure rate"
                    value={`${t.failureRate.toFixed(1)}%`}
                    tone={
                      t.failureRate >= 10
                        ? "danger"
                        : t.failureRate >= 3
                          ? "warning"
                          : undefined
                    }
                  />
                  <MetricTile
                    label="Last fired"
                    value={
                      t.lastFired ? (
                        <DateCell value={t.lastFired} tone="default" />
                      ) : (
                        "Never"
                      )
                    }
                  />
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Recent deliveries</h3>
                  {t.deliveries.length === 0 ? (
                    <EmptyState
                      size="sm"
                      bare
                      title="No deliveries yet"
                      description="Use Test trigger to record a simulated one."
                    />
                  ) : (
                    <div className="overflow-hidden rounded-lg border">
                      <table className="w-full text-sm">
                        <caption className="sr-only">
                          Recent deliveries for {t.name}
                        </caption>
                        <thead className="bg-muted/40 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                          <tr>
                            <th
                              scope="col"
                              className="px-3 py-1.5 text-left font-medium"
                            >
                              Received
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-1.5 text-left font-medium"
                            >
                              Status
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-1.5 text-right font-medium"
                            >
                              Latency
                            </th>
                            <th
                              scope="col"
                              className="px-3 py-1.5 text-left font-medium"
                            >
                              Run
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {t.deliveries.map((d) => {
                            const ok = d.statusCode < 400
                            return (
                              <tr key={d.id}>
                                <td className="px-3 py-1.5">
                                  <DateCell
                                    value={d.at}
                                    mode="datetime"
                                    tone="default"
                                  />
                                </td>
                                <td className="px-3 py-1.5">
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1.5 font-mono text-xs tabular-nums",
                                      ok
                                        ? "text-success-text"
                                        : "text-danger-text"
                                    )}
                                  >
                                    <span
                                      aria-hidden
                                      className={cn(
                                        "size-1.5 rounded-full",
                                        ok ? "bg-success" : "bg-destructive"
                                      )}
                                    />
                                    {d.statusCode}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 text-right text-xs text-muted-foreground tabular-nums">
                                  {formatMs(d.latencyMs)}
                                </td>
                                <td className="px-3 py-1.5">
                                  {d.runId ? (
                                    <Mono>{d.runId}</Mono>
                                  ) : (
                                    <EmptyValue />
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Configuration</h3>
                  <DetailList
                    variant="rows"
                    dense
                    items={[
                      {
                        label: "Source",
                        value: `${t.source}${t.sourceDetail ? ` · ${t.sourceDetail}` : ""}`,
                      },
                      { label: "Action", value: t.action },
                      {
                        label: "Target",
                        value: <AgentChip agentId={t.agentId} size="sm" />,
                      },
                      {
                        label: "Secret",
                        value: secret ? (
                          <span className="inline-flex items-center gap-2">
                            <SecretChip secret={secret} />
                            <span className="text-xs text-muted-foreground">
                              {secret.kind}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Internal event, no secret
                          </span>
                        ),
                      },
                      {
                        label: "Owner",
                        value: <UserChip userId={t.ownerId} size="xs" />,
                      },
                    ]}
                  />
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Sample payload</h3>
                  {Object.keys(t.samplePayload).length === 0 ? (
                    <EmptyState
                      size="sm"
                      bare
                      title="No sample payload"
                      description="The first real delivery is stored here as the sample."
                    />
                  ) : (
                    <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                      {JSON.stringify(t.samplePayload, null, 2)}
                    </pre>
                  )}
                </section>
              </div>
            </SheetBody>

            <SheetFooterActions
              tertiary={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger-text hover:text-danger-text"
                  onClick={onDelete}
                >
                  <Trash2Icon /> Delete
                </Button>
              }
              secondary={
                <>
                  {secret && secret.status !== "Valid" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        triggerStore.patch(t.id, {
                          secret: { ...secret, status: "Valid" },
                        })
                        toast.success("Secret rotated", {
                          description:
                            "Status is now Valid. Share the new signing secret with the sender.",
                        })
                      }}
                    >
                      <KeyRoundIcon /> Rotate secret
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTrigger(t)}
                  >
                    {t.status === "Paused" ? (
                      <>
                        <PlayIcon /> Resume
                      </>
                    ) : (
                      <>
                        <PauseIcon /> Pause
                      </>
                    )}
                  </Button>
                </>
              }
              primary={
                <Button size="sm" onClick={onTest}>
                  <SendIcon /> Test trigger
                </Button>
              }
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------------ */
/* Test dialog                                                               */
/* ------------------------------------------------------------------------ */

function TestTriggerDialog({
  trigger: t,
  onClose,
  onSend,
}: {
  trigger: Trigger | null
  onClose: () => void
  onSend: (t: Trigger) => void
}) {
  return (
    <Dialog open={t !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {t && (
          <>
            <DialogHeader>
              <DialogTitle>Test {t.name}</DialogTitle>
              <DialogDescription>
                Evaluates the sample payload against{" "}
                <code className="font-mono text-xs">{t.condition}</code> and
                records a simulated 202 delivery.{" "}
                {t.action === "Run agent"
                  ? `A dry run on ${getDeployedAgent(t.agentId)?.name} is added to Run history.`
                  : `The "${t.action}" action is not executed in this template.`}
              </DialogDescription>
            </DialogHeader>
            {Object.keys(t.samplePayload).length === 0 ? (
              <EmptyState
                size="sm"
                title="No sample payload"
                description="The test still records a delivery with an empty body."
              />
            ) : (
              <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                {JSON.stringify(t.samplePayload, null, 2)}
              </pre>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => onSend(t)}>
                <SendIcon /> Send test
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------------ */
/* Create sheet                                                              */
/* ------------------------------------------------------------------------ */

const sourceItems = triggerSources.map((s) => ({ value: s, label: s }))
const actionItems = (
  ["Run agent", "Open review", "Notify"] as TriggerAction[]
).map((a) => ({ value: a, label: a }))
const agentItems = deployedAgents.map((a) => ({ value: a.id, label: a.name }))

function NewTriggerSheet({
  open,
  defaultAgentId,
  onClose,
  onCreate,
}: {
  open: boolean
  defaultAgentId?: string
  onClose: () => void
  onCreate: (t: Trigger) => void
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
      >
        {open && (
          <NewTriggerForm defaultAgentId={defaultAgentId} onCreate={onCreate} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function NewTriggerForm({
  defaultAgentId,
  onCreate,
}: {
  defaultAgentId?: string
  onCreate: (t: Trigger) => void
}) {
  const [name, setName] = React.useState("")
  const [source, setSource] = React.useState<TriggerSource>("Webhook")
  const [sourceDetail, setSourceDetail] = React.useState("")
  const [condition, setCondition] = React.useState("")
  const [agentId, setAgentId] = React.useState(
    defaultAgentId && getDeployedAgent(defaultAgentId)
      ? defaultAgentId
      : deployedAgents[0].id
  )
  const [action, setAction] = React.useState<TriggerAction>("Run agent")
  const external = externalSources.includes(source)
  const valid = name.trim().length >= 3 && condition.trim().length > 0

  return (
    <>
      <SheetHeader className="gap-1 border-b px-6 py-5">
        <SheetTitle>New trigger</SheetTitle>
        <SheetDescription>
          Choose a source, a condition and what to do when it matches. The
          trigger starts Active.
          {external
            ? " External sources start without a signing secret; rotate one in from the trigger sheet."
            : ""}
        </SheetDescription>
      </SheetHeader>
      <form
        id="new-trigger"
        className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          onCreate({
            id: nextLocalId("trg"),
            name: name.trim(),
            source,
            sourceDetail: sourceDetail.trim() || undefined,
            condition: condition.trim(),
            agentId,
            action,
            fired24h: 0,
            failureRate: 0,
            status: "Active",
            secret: external
              ? { kind: "HMAC-SHA256", status: "Missing" }
              : undefined,
            samplePayload: {},
            deliveries: [],
            ownerId: currentUser.id,
          })
        }}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="trg-name">Name</FieldLabel>
            <Input
              id="trg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Payments incident opened"
              required
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="trg-source">Source</FieldLabel>
              <Select
                value={source}
                onValueChange={(v) => v && setSource(v as TriggerSource)}
                items={sourceItems}
              >
                <SelectTrigger id="trg-source" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sourceItems.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="trg-detail">Source detail</FieldLabel>
              <Input
                id="trg-detail"
                value={sourceDetail}
                onChange={(e) => setSourceDetail(e.target.value)}
                placeholder="SQS, #ops-alerts, GitHub"
              />
              <FieldDescription>
                Optional integration name shown under the source.
              </FieldDescription>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="trg-condition">Condition</FieldLabel>
            <Input
              id="trg-condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder='event.type == "incident.opened" && event.priority <= 2'
              className="font-mono text-xs"
              required
            />
            <FieldDescription>
              Filter expression evaluated against each event.
            </FieldDescription>
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="trg-agent">Target agent</FieldLabel>
              <Select
                value={agentId}
                onValueChange={(v) => v && setAgentId(String(v))}
                items={agentItems}
              >
                <SelectTrigger id="trg-agent" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agentItems.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {getDeployedAgent(agentId)?.paused && (
                <FieldDescription className="text-warning-text">
                  This agent is paused. Runs are not accepted until it is
                  resumed.
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="trg-action">Action</FieldLabel>
              <Select
                value={action}
                onValueChange={(v) => v && setAction(v as TriggerAction)}
                items={actionItems}
              >
                <SelectTrigger id="trg-action" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {actionItems.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FieldGroup>
      </form>
      <SheetFooterActions
        primary={
          <Button type="submit" form="new-trigger" disabled={!valid}>
            <PlusIcon /> Create trigger
          </Button>
        }
      />
    </>
  )
}
