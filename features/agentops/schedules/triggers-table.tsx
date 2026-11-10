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
  ZapIcon,
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
import { DetailList } from "@/components/shared/detail-list"
import { UserChip } from "@/components/shared/user-chip"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { deployedAgents, getDeployedAgent } from "@/lib/data"
import {
  triggerSources,
  triggers as seed,
  type SecretStatus,
  type Trigger,
  type TriggerStatus,
} from "@/lib/data/schedules"
import { AgentChip } from "../shared"
import { Mono, TriggerStatusBadge, actionIcon, sourceIcon } from "./shared"

const col = createColumnHelper<DataTableFeatures, Trigger>()

const secretTone: Record<SecretStatus, string> = {
  Valid: "text-success-text",
  Rotating: "text-warning-text",
  Missing: "text-danger-text",
}

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
            <TwoLineCell
              primary={row.original.name}
              secondary={
                row.original.sourceDetail
                  ? `${row.original.source} · ${row.original.sourceDetail}`
                  : row.original.source
              }
            />
          </span>
        )
      },
      enableHiding: false,
      meta: { width: "min-w-56 max-w-xs", label: "Trigger", skeleton: "w-40" },
    }),
    col.accessor("condition", {
      header: "Condition",
      cell: ({ getValue }) => (
        <code
          className="block max-w-sm truncate font-mono text-[11px] text-muted-foreground"
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
        <DataTableColumnHeader column={column} title="Failure rate" />
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
      header: "Secret",
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

export function TriggersTable({ agentId }: { agentId?: string }) {
  const [items, setItems] = React.useState<Trigger[]>(seed)
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [testId, setTestId] = React.useState<string | null>(null)
  const columns = React.useMemo(() => buildColumns((t) => setTestId(t.id)), [])

  const data = agentId ? items.filter((t) => t.agentId === agentId) : items
  const open = items.find((t) => t.id === openId) ?? null
  const testing = items.find((t) => t.id === testId) ?? null

  const patch = (id: string, p: Partial<Trigger>) =>
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...p } : t)))

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
        initialSorting={[{ id: "fired24h", desc: true }]}
        initialColumnVisibility={{ lastFired: false }}
        onRowClick={(r) => setOpenId(r.id)}
        totalLabel="triggers"
        selectionLabel={(n) => (n === 1 ? "trigger" : "triggers")}
        emptyTitle="No triggers"
        emptyMessage="Connect a webhook, queue or record event to start an agent on demand."
        emptyIcon={<ZapIcon />}
        toolbar={
          <Button
            size="sm"
            onClick={() =>
              toast("New trigger", {
                description:
                  "Choose a source, a condition and the agent to run.",
              })
            }
          >
            <PlusIcon /> New trigger
          </Button>
        }
      />
      <TriggerSheet
        trigger={open}
        onClose={() => setOpenId(null)}
        onPatch={patch}
        onTest={() => setTestId(openId)}
      />
      <TestTriggerDialog trigger={testing} onClose={() => setTestId(null)} />
    </>
  )
}

function TriggerSheet({
  trigger: t,
  onClose,
  onPatch,
  onTest,
}: {
  trigger: Trigger | null
  onClose: () => void
  onPatch: (id: string, p: Partial<Trigger>) => void
  onTest: () => void
}) {
  return (
    <Sheet open={t !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {t && (
          <>
            <SheetHeader className="gap-3 border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="font-mono text-[11px] text-muted-foreground"
                >
                  {t.id}
                </Badge>
                <TriggerStatusBadge status={t.status} size="sm" />
                <Badge
                  variant="outline"
                  className="text-[11px] text-muted-foreground"
                >
                  {t.source}
                  {t.sourceDetail ? ` · ${t.sourceDetail}` : ""}
                </Badge>
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

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
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
                {t.secret?.status === "Missing" && (
                  <div className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-sm">
                    <p className="font-medium">Signing secret missing</p>
                    <p className="text-xs text-muted-foreground">
                      Deliveries are accepted without signature verification.
                      Set an HMAC secret on both sides to close this gap.
                    </p>
                  </div>
                )}

                <section className="grid grid-cols-3 gap-3 text-sm">
                  <Fact label="Fired · 24h">
                    <span className="tabular-nums">{t.fired24h}</span>
                  </Fact>
                  <Fact label="Failure rate">
                    <span
                      className={cn(
                        "tabular-nums",
                        t.failureRate >= 10
                          ? "text-danger-text"
                          : t.failureRate >= 3
                            ? "text-warning-text"
                            : undefined
                      )}
                    >
                      {t.failureRate.toFixed(1)}%
                    </span>
                  </Fact>
                  <Fact label="Last fired">
                    <DateCell value={t.lastFired ?? null} tone="default" />
                  </Fact>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Recent deliveries</h3>
                  {t.deliveries.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                      No deliveries yet.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                          <tr>
                            <th className="px-3 py-1.5 text-left font-medium">
                              Received
                            </th>
                            <th className="px-3 py-1.5 text-left font-medium">
                              Status
                            </th>
                            <th className="px-3 py-1.5 text-right font-medium">
                              Latency
                            </th>
                            <th className="px-3 py-1.5 text-left font-medium">
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
                                  {d.latencyMs.toLocaleString()} ms
                                </td>
                                <td className="px-3 py-1.5">
                                  {d.runId ? (
                                    <Mono>{d.runId}</Mono>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      —
                                    </span>
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
                        value: t.secret ? (
                          <span className="inline-flex items-center gap-2">
                            <SecretChip secret={t.secret} />
                            <span className="text-xs text-muted-foreground">
                              {t.secret.kind}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Internal event — no secret
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
                  <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                    {JSON.stringify(t.samplePayload, null, 2)}
                  </pre>
                </section>
              </div>
            </div>

            <SheetFooter className="flex-row flex-wrap items-center justify-end gap-2 border-t px-6 py-4">
              {t.secret && t.secret.status !== "Valid" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onPatch(t.id, { secret: { ...t.secret!, status: "Valid" } })
                    toast.success("Secret rotated", {
                      description:
                        "Share the new signing secret with the sender.",
                    })
                  }}
                >
                  <KeyRoundIcon /> Rotate secret
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const next: TriggerStatus =
                    t.status === "Paused" ? "Active" : "Paused"
                  onPatch(t.id, { status: next })
                  toast(
                    next === "Paused" ? "Trigger paused" : "Trigger resumed"
                  )
                }}
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
              <Button size="sm" onClick={onTest}>
                <SendIcon /> Test trigger
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function TestTriggerDialog({
  trigger: t,
  onClose,
}: {
  trigger: Trigger | null
  onClose: () => void
}) {
  return (
    <Dialog open={t !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {t && (
          <>
            <DialogHeader>
              <DialogTitle>Test {t.name}</DialogTitle>
              <DialogDescription>
                Sends the sample payload through the condition{" "}
                <code className="font-mono text-xs">{t.condition}</code> and, if
                it matches, performs <strong>{t.action.toLowerCase()}</strong>{" "}
                on {getDeployedAgent(t.agentId)?.name} in dry-run mode.
              </DialogDescription>
            </DialogHeader>
            <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
              {JSON.stringify(t.samplePayload, null, 2)}
            </pre>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onClose()
                  toast.success("Test delivery accepted (202)", {
                    description: `Condition matched · dry run queued on ${getDeployedAgent(t.agentId)?.name}.`,
                  })
                }}
              >
                <SendIcon /> Send test
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  )
}
