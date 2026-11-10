"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import {
  ArrowRightIcon,
  BellOffIcon,
  CheckIcon,
  FlaskConicalIcon,
  RouteIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ChartCard } from "@/components/charts/chart-card"
import { CHART_HEIGHT } from "@/components/charts/chart-primitives"
import { IncidentTrendChart } from "@/components/charts/incident-trend-chart"
import { Sparkline } from "@/components/charts/sparkline"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge } from "@/components/shared/status-badge"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  deployedAgents,
  fleetDaily,
  fleetQualityBaseline,
  getDeployedAgent,
} from "@/lib/data/agentops"
import { timeAgo } from "@/lib/format"
import type {
  DriftKind,
  DriftSignal,
  ExperimentKind,
  ExperimentMetric,
} from "@/lib/types"
import { AgentChip } from "./shared"
import { draftExperiment, driftStore } from "./stores"

const kindLabel: Record<DriftKind, string> = {
  input: "Input drift",
  output: "Output drift",
  quality: "Quality regression",
  tool: "Tool reliability",
  cost: "Cost anomaly",
}
const severityRank = { Critical: 0, Warning: 1, Info: 2 }
const states = ["active", "Open", "Acknowledged", "Resolved", "all"] as const
type StateFilter = (typeof states)[number]

/** Which kind of experiment usually tests a fix for a drift kind. */
const experimentFor: Record<
  Exclude<DriftKind, "cost">,
  { kind: ExperimentKind; metric: ExperimentMetric }
> = {
  input: { kind: "retrieval", metric: "quality" },
  output: { kind: "prompt", metric: "quality" },
  quality: { kind: "prompt", metric: "quality" },
  tool: { kind: "tooling", metric: "quality" },
}

function fmtVal(v: number, unit: string) {
  const n =
    Math.abs(v) < 1 && unit === ""
      ? v.toFixed(2)
      : Number.isInteger(v)
        ? String(v)
        : v.toFixed(1)
  return unit === "$"
    ? `$${n}`
    : `${n}${unit ? (unit === "%" ? "%" : ` ${unit}`) : ""}`
}

export function DriftBoard({
  initialAgentId,
  initialState,
}: {
  /** `?agent=<agt-id>`: show one agent's signals. */
  initialAgentId?: string
  /** `?state=Open|Acknowledged|Resolved|active|all`. */
  initialState?: string
}) {
  const signals = driftStore.use()
  const [state, setState] = React.useState<StateFilter>(
    states.includes(initialState as StateFilter)
      ? (initialState as StateFilter)
      : "active"
  )
  const [resolving, setResolving] = React.useState<DriftSignal | null>(null)
  const agent = initialAgentId ? getDeployedAgent(initialAgentId) : undefined

  const scoped = agent ? signals.filter((s) => s.agentId === agent.id) : signals
  const active = scoped.filter((s) => s.state !== "Resolved")
  const visible = scoped
    .filter((s) =>
      state === "active"
        ? s.state !== "Resolved"
        : state === "all"
          ? true
          : s.state === state
    )
    .sort(
      (a, b) =>
        severityRank[a.severity] - severityRank[b.severity] ||
        b.detected.localeCompare(a.detected)
    )

  const byAgent = new Map<string, DriftSignal[]>()
  for (const s of visible)
    byAgent.set(s.agentId, [...(byAgent.get(s.agentId) ?? []), s])

  const acknowledge = (s: DriftSignal) => {
    driftStore.patch(s.id, { state: "Acknowledged" })
    toast("Signal acknowledged", {
      description: `${s.metric} · you own the follow-up for this session`,
      action: {
        label: "Undo",
        onClick: () => driftStore.patch(s.id, { state: s.state }),
      },
      duration: 6000,
    })
  }

  const quality = fleetDaily.slice(-14).map((d) => ({
    name: d.name,
    quality: d.quality,
    baseline: fleetQualityBaseline,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <ChartCard
          className="min-w-0"
          title="Fleet quality vs baseline"
          description={`Composite evaluator score across production agents, last 14 days, against the ${fleetQualityBaseline} baseline`}
        >
          <IncidentTrendChart
            data={quality}
            series={[
              { key: "quality", label: "Quality", color: "var(--chart-1)" },
              { key: "baseline", label: "Baseline", color: "var(--chart-5)" },
            ]}
            height={CHART_HEIGHT.sm}
            valueFormatter={(v) => v.toFixed(1)}
          />
        </ChartCard>
        <StatGrid columns={2} className="gap-3">
          {(["Critical", "Warning", "Info"] as const).map((sev) => {
            const list = active.filter((s) => s.severity === sev)
            const open = list.filter((s) => s.state === "Open").length
            return (
              <StatCard
                key={sev}
                label={sev}
                value={list.length}
                upIsGood={false}
                hint={`${open} open · ${list.length - open} acknowledged`}
              />
            )
          })}
          <StatCard
            label="Agents affected"
            value={new Set(active.map((s) => s.agentId)).size}
            unit={`/ ${deployedAgents.filter((a) => a.environment === "production").length}`}
            hint="Production agents with an active signal"
          />
        </StatGrid>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            value={[state]}
            onValueChange={(v) => v[0] && setState(v[0] as StateFilter)}
            aria-label="Filter signals"
          >
            {states.map((v) => (
              <ToggleGroupItem
                key={v}
                value={v}
                size="sm"
                className="text-xs capitalize"
              >
                {v}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {agent && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AgentChip agentId={agent.id} size="sm" /> only
              <Button
                variant="ghost"
                size="xs"
                render={<Link href="/agentops/drift" />}
              >
                All agents
              </Button>
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Baselines are the trailing 28-day window per agent. PSI above 0.25 or
          a quality drop over 5 points raises Critical.
        </p>
      </div>

      {byAgent.size === 0 ? (
        <EmptyState
          icon={<CheckIcon />}
          title="No drift signals"
          description={
            state === "active"
              ? "Every production agent is within its baseline for inputs, outputs, quality, tools and cost."
              : "No signals match this filter."
          }
          action={
            state !== "active" ? (
              <Button variant="outline" onClick={() => setState("active")}>
                Show active signals
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {[...byAgent.entries()].map(([agentId, list]) => (
            <section key={agentId} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <AgentChip agentId={agentId} />
                <span className="text-xs text-muted-foreground">
                  {list.length} signal{list.length === 1 ? "" : "s"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-xs"
                  render={<Link href={`/agentops/traces?agent=${agentId}`} />}
                >
                  <RouteIcon /> Traces
                </Button>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {list.map((s) => (
                  <SignalCard
                    key={s.id}
                    signal={s}
                    onAcknowledge={() => acknowledge(s)}
                    onResolve={() => setResolving(s)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ResolveDialog signal={resolving} onClose={() => setResolving(null)} />
    </div>
  )
}

function ResolveDialog({
  signal: s,
  onClose,
}: {
  signal: DriftSignal | null
  onClose: () => void
}) {
  const [reason, setReason] = React.useState("")
  const [resetBaseline, setResetBaseline] = React.useState(false)
  const confirm = () => {
    if (!s) return
    const previous = s
    driftStore.patch(s.id, {
      state: "Resolved",
      ...(resetBaseline ? { baseline: s.current } : {}),
    })
    toast.success("Signal resolved", {
      description: resetBaseline
        ? `${s.metric} · baseline reset to ${s.current}${reason.trim() ? ` · ${reason.trim()}` : ""}`
        : `${s.metric}${reason.trim() ? ` · ${reason.trim()}` : ""}`,
      action: {
        label: "Undo",
        onClick: () =>
          driftStore.set((prev) =>
            prev.map((x) => (x.id === previous.id ? previous : x))
          ),
      },
      duration: 6000,
    })
    setReason("")
    setResetBaseline(false)
    onClose()
  }
  return (
    <AlertDialog open={s !== null} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resolve this signal?</AlertDialogTitle>
          <AlertDialogDescription>
            {s
              ? `${s.metric} on ${getDeployedAgent(s.agentId)?.name ?? s.agentId} leaves the active list. Resolve once the metric is back in its baseline band, or mark the new level as the intended behaviour.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-3">
          <Label className="flex items-start gap-2 text-sm font-normal">
            <Checkbox
              checked={resetBaseline}
              onCheckedChange={(v) => setResetBaseline(v === true)}
              className="mt-0.5"
            />
            <span>
              This is the new normal: reset the baseline to the current value
              {s ? ` (${fmtVal(s.current, s.unit)})` : ""}
            </span>
          </Label>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resolve-reason">Reason (optional)</Label>
            <Textarea
              id="resolve-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What changed, and which release or experiment fixed it"
              className="min-h-16 text-sm"
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirm}>Resolve</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function SignalCard({
  signal: s,
  onAcknowledge,
  onResolve,
}: {
  signal: DriftSignal
  onAcknowledge: () => void
  onResolve: () => void
}) {
  const router = useRouter()
  const delta =
    s.baseline === 0 ? 0 : ((s.current - s.baseline) / s.baseline) * 100
  const bad =
    s.kind === "quality" ? s.current < s.baseline : s.current > s.baseline

  const startExperiment = () => {
    if (s.kind === "cost") return
    const spec = experimentFor[s.kind]
    const agent = getDeployedAgent(s.agentId)
    const exp = draftExperiment({
      agentId: s.agentId,
      kind: spec.kind,
      primaryMetric: spec.metric,
      name: `${agent?.name ?? s.agentId}: fix for ${s.metric.toLowerCase()}`,
      hypothesis: `A ${spec.kind} change returns ${s.metric.toLowerCase()} to its ${fmtVal(s.baseline, s.unit)} baseline (currently ${fmtVal(s.current, s.unit)}). Opened from drift signal ${s.id}.`,
    })
    toast.success("Draft experiment created", {
      description: `${exp.name} · ${exp.split}% split, not started`,
    })
    router.push(`/agentops/experiments?open=${exp.id}`)
  }

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4",
        s.severity === "Critical" &&
          s.state === "Open" &&
          "border-destructive/40",
        s.state === "Resolved" && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow className="flex items-center gap-1.5">
            {kindLabel[s.kind]}
            <span aria-hidden>·</span>
            {timeAgo(s.detected)}
          </Eyebrow>
          <h3 className="mt-0.5 truncate text-sm font-semibold">{s.metric}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StateBadge state={s.severity} size="sm" />
          <StateBadge state={s.state} size="sm" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm text-muted-foreground tabular-nums">
            {fmtVal(s.baseline, s.unit)}
          </span>
          <ArrowRightIcon className="size-3.5 text-muted-foreground" />
          <span
            className={cn(
              "font-mono text-lg font-semibold tabular-nums",
              bad ? "text-danger-text" : "text-success-text"
            )}
          >
            {fmtVal(s.current, s.unit)}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "h-5 px-1.5 font-mono text-3xs",
              bad
                ? "border-destructive/30 text-danger-text"
                : "border-success/30 text-success-text"
            )}
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(0)}%
          </Badge>
        </div>
        <Sparkline
          data={s.history}
          className="ml-auto h-8 w-28"
          color={bad ? "var(--destructive)" : "var(--chart-1)"}
          baseline={s.baseline}
        />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {s.explanation}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {s.state === "Open" && (
          <Button variant="outline" size="sm" onClick={onAcknowledge}>
            <BellOffIcon /> Acknowledge
          </Button>
        )}
        {s.state !== "Resolved" && (
          <Button variant="ghost" size="sm" onClick={onResolve}>
            <CheckIcon /> Resolve
          </Button>
        )}
        {s.kind !== "cost" && s.state !== "Resolved" && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={startExperiment}
          >
            <FlaskConicalIcon /> Start experiment
          </Button>
        )}
      </div>
    </article>
  )
}
