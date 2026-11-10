"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  ActivityIcon,
  BotIcon,
  CheckCircle2Icon,
  CheckIcon,
  CircleDashedIcon,
  ClockIcon,
  FlaskConicalIcon,
  GitCompareIcon,
  PauseIcon,
  PlayIcon,
  RocketIcon,
  RouteIcon,
  ShieldCheckIcon,
  ShieldIcon,
  StepForwardIcon,
  UndoIcon,
  UserIcon,
  XCircleIcon,
} from "lucide-react"
import { toast } from "sonner"

import { LifecycleTracker } from "@/components/record/lifecycle-tracker"
import { MetaItem, RecordHeader } from "@/components/record/record-header"
import { RecordLayout } from "@/components/record/record-layout"
import { RecordSection } from "@/components/record/record-section"
import { DetailList } from "@/components/shared/detail-list"
import { StatCard } from "@/components/shared/stat-card"
import { RiskBadge } from "@/components/shared/status-badge"
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
import { Button } from "@/components/ui/button"
import { getDeployedAgent, getExperiment, NOW } from "@/lib/data"
import type {
  Release,
  ReleaseEvent,
  ReleaseStage,
} from "@/lib/data/deployments"
import { formatDelta, formatDateTime, timeAgo } from "@/lib/format"
import { AgentChip, ModelChip } from "../shared"
import { RolloutChart } from "./rollout-chart"
import {
  EnvironmentBadge,
  EvalGateChip,
  StageBadge,
  VersionChip,
  environmentLabel,
  strategyLabel,
} from "./shared"

function costDeltaUsd(costPerDay: number, pct: number) {
  const usd = (costPerDay * pct) / 100
  const sign = usd > 0 ? "+" : usd < 0 ? "−" : ""
  return `${sign}$${Math.abs(usd).toFixed(0)}`
}

const lifecycle = [
  "Draft",
  "Approved",
  "Canary",
  "Progressing",
  "Promoted",
] as const
const terminal = ["Rolled back", "Failed"] as const

type Dialog = "advance" | "pause" | "rollback" | "promote" | null

const eventIcon: Record<ReleaseEvent["kind"], React.ReactNode> = {
  created: <CircleDashedIcon />,
  eval: <FlaskConicalIcon />,
  approval: <CheckCircle2Icon />,
  deploy: <RocketIcon />,
  advance: <StepForwardIcon />,
  promote: <CheckCircle2Icon />,
  rollback: <UndoIcon />,
  fail: <XCircleIcon />,
  note: <ActivityIcon />,
}

const eventTone: Partial<Record<ReleaseEvent["kind"], string>> = {
  promote: "text-success-text",
  approval: "text-success-text",
  rollback: "text-warning-text",
  fail: "text-danger-text",
}

export function ReleaseRecord({ release: initial }: { release: Release }) {
  const [release, setRelease] = React.useState(initial)
  const [approved, setApproved] = React.useState(
    initial.approvers.every((a) => a.status === "approved")
  )
  const [paused, setPaused] = React.useState(false)
  const [dialog, setDialog] = React.useState<Dialog>(null)
  const agent = getDeployedAgent(release.agentId)
  const experiment = release.experimentId
    ? getExperiment(release.experimentId)
    : undefined

  const lifecycleCurrent =
    release.stage === "Draft" || release.stage === "Pending approval"
      ? approved
        ? "Approved"
        : "Draft"
      : release.stage
  const live = release.stage === "Canary" || release.stage === "Progressing"
  const stepIdx = release.steps.indexOf(release.traffic)
  const nextStep = release.steps[stepIdx + 1]
  const gateOk = release.evalGate?.status === "passed"
  const allApproved = release.approvers.every((a) => a.status === "approved")
  const coverageOk = release.guardrailCoverage >= 80
  const costOk = release.costDeltaPct <= 10
  const canDeploy = approved && gateOk && !live && release.stage !== "Promoted"

  function log(
    kind: ReleaseEvent["kind"],
    message: string,
    patch?: Partial<Release>
  ) {
    setRelease((r) => ({
      ...r,
      ...patch,
      activity: [
        ...r.activity,
        {
          id: `local-${r.activity.length}`,
          kind,
          at: NOW.toISOString(),
          actorId: "u-001",
          message,
        },
      ],
    }))
  }

  function approve() {
    setApproved(true)
    setRelease((r) => ({
      ...r,
      approvers: r.approvers.map((a) =>
        a.status === "approved"
          ? a
          : { ...a, status: "approved", at: NOW.toISOString() }
      ),
    }))
    log("approval", "Approved — all required sign-offs collected")
    toast.success(`${release.id} approved`, {
      description: "The rollout can start whenever the owner is ready.",
    })
  }

  function startRollout() {
    const first = release.steps[0]
    const stage: ReleaseStage =
      release.strategy === "Canary" ? "Canary" : "Progressing"
    log(
      "deploy",
      release.strategy === "Canary"
        ? `Canary started at ${first}% of ${release.environment} traffic`
        : `${release.strategy} deployment started`,
      { stage, traffic: first, deployedAt: NOW.toISOString() }
    )
    toast.success("Rollout started", {
      description: `${agent?.name} ${release.version} is receiving ${first}% of traffic.`,
    })
  }

  function advance() {
    if (nextStep === undefined) return
    const promotedNow = nextStep === 100
    log(
      promotedNow ? "promote" : "advance",
      promotedNow
        ? `Promoted to 100% of ${release.environment}`
        : `Advanced to ${nextStep}% — quality ${formatDelta(release.health.qualityDelta, "", 1)} vs baseline`,
      {
        traffic: nextStep,
        stage: promotedNow ? "Promoted" : "Progressing",
        completedAt: promotedNow ? NOW.toISOString() : release.completedAt,
      }
    )
    setDialog(null)
    toast.success(promotedNow ? "Release promoted" : `Advanced to ${nextStep}%`)
  }

  function promote() {
    log("promote", `Promoted to 100% of ${release.environment}`, {
      traffic: 100,
      stage: "Promoted",
      completedAt: NOW.toISOString(),
    })
    setDialog(null)
    toast.success("Release promoted", {
      description: `${agent?.name} now serves ${release.version} on 100% of ${release.environment}.`,
    })
  }

  function rollback() {
    log("rollback", `Rolled back to ${release.rollbackTarget}`, {
      traffic: 0,
      stage: "Rolled back",
      completedAt: NOW.toISOString(),
    })
    setDialog(null)
    toast(`Rolled back to ${release.rollbackTarget}`, {
      description:
        "Traffic returned to the previous version within 30 seconds.",
    })
  }

  function togglePause() {
    const next = !paused
    setPaused(next)
    log(
      "note",
      next ? "Rollout paused — traffic held at current step" : "Rollout resumed"
    )
    setDialog(null)
    toast(next ? "Rollout paused" : "Rollout resumed")
  }

  const gateItems = [
    {
      label: "Eval gate",
      ok: release.evalGate
        ? release.evalGate.status === "pending"
          ? undefined
          : gateOk
        : undefined,
      detail: release.evalGate ? (
        <EvalGateChip gate={release.evalGate} />
      ) : (
        "Not run"
      ),
    },
    {
      label: "Guardrail coverage",
      ok: coverageOk,
      detail: `${release.guardrailCoverage}% of the suite exercises these changes`,
    },
    {
      label: "Cost delta estimate",
      ok: costOk,
      detail: agent
        ? `${formatDelta(release.costDeltaPct, "%", 1)} per day (~${costDeltaUsd(agent.metrics.costPerDay, release.costDeltaPct)}/day)`
        : `${formatDelta(release.costDeltaPct, "%", 1)} per day`,
    },
    {
      label: "Approvals",
      ok: allApproved,
      detail: `${release.approvers.filter((a) => a.status === "approved").length} of ${release.approvers.length} approvers signed off`,
    },
  ]

  return (
    <>
      <RecordHeader
        number={release.id}
        title={`${agent?.name ?? release.agentId} ${release.version}`}
        backHref="/agentops/deployments"
        backLabel="deployments"
        description={release.summary}
        editable={false}
        badges={
          <>
            <StageBadge stage={release.stage} />
            <EnvironmentBadge environment={release.environment} />
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <VersionChip version={release.previousVersion} tone="muted" /> →{" "}
              <VersionChip version={release.version} />
            </span>
            {paused && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-text">
                <PauseIcon className="size-3" /> Paused
              </span>
            )}
          </>
        }
        meta={
          <>
            <MetaItem label="Agent" icon={<BotIcon />}>
              <AgentChip agentId={release.agentId} size="sm" />
            </MetaItem>
            <MetaItem label="Strategy" icon={<RouteIcon />}>
              {strategyLabel(release.strategy, release.steps)}
            </MetaItem>
            <MetaItem label="Deployed by" icon={<UserIcon />}>
              <UserChip userId={release.deployedById} size="xs" />
            </MetaItem>
            <MetaItem label="Created" icon={<ClockIcon />}>
              {timeAgo(release.createdAt)}
            </MetaItem>
          </>
        }
        actions={
          <>
            {release.stage === "Pending approval" && !approved && (
              <Button onClick={approve} disabled={!gateOk}>
                <CheckIcon /> Approve
              </Button>
            )}
            {canDeploy &&
              (release.stage === "Draft" ||
                release.stage === "Pending approval") && (
                <Button onClick={startRollout}>
                  <PlayIcon /> Start rollout
                </Button>
              )}
            {live && (
              <Button onClick={() => setDialog("promote")} disabled={paused}>
                <RocketIcon /> Promote
              </Button>
            )}
            {(live || release.stage === "Promoted") && (
              <Button variant="outline" onClick={() => setDialog("rollback")}>
                <UndoIcon /> Roll back
              </Button>
            )}
          </>
        }
        overflow={[
          {
            label: "Open agent",
            icon: <BotIcon />,
            href: `/agentops/agents/${release.agentId}`,
          },
          {
            label: "Compare traces by version",
            icon: <GitCompareIcon />,
            href: `/agentops/traces?agent=${release.agentId}`,
          },
          {
            label: "Export release notes",
            message: "Release notes copied as Markdown",
          },
        ]}
      />

      <RecordLayout
        aside={
          <>
            <RecordSection title="Lifecycle" size="sm">
              <LifecycleTracker
                stages={lifecycle}
                current={lifecycleCurrent}
                terminal={terminal}
                orientation="vertical"
              />
            </RecordSection>
            <RecordSection title="Details" size="sm">
              <DetailList
                variant="rows"
                dense
                items={[
                  {
                    label: "Strategy",
                    value: strategyLabel(release.strategy, release.steps),
                  },
                  {
                    label: "Environment",
                    value: environmentLabel[release.environment],
                  },
                  {
                    label: "Risk",
                    value: <RiskBadge risk={release.risk} size="sm" />,
                  },
                  {
                    label: "Author",
                    value: <UserChip userId={release.deployedById} size="xs" />,
                  },
                  {
                    label: "Approvers",
                    value: (
                      <ul className="flex flex-col gap-1">
                        {release.approvers.map((a) => (
                          <li
                            key={a.userId}
                            className="flex items-center justify-between gap-2"
                          >
                            <UserChip
                              userId={a.userId}
                              size="xs"
                              secondary={a.role}
                            />
                            <span
                              className={cn(
                                "text-[11px] font-medium capitalize",
                                a.status === "approved"
                                  ? "text-success-text"
                                  : "text-warning-text"
                              )}
                            >
                              {a.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                  {
                    label: "Eval run",
                    value: release.evalGate ? (
                      <Link
                        href={`/agentops/evals?run=${release.evalGate.runId}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {release.evalGate.runId}
                      </Link>
                    ) : (
                      "—"
                    ),
                  },
                  {
                    label: "Experiment",
                    value: experiment ? (
                      <Link
                        href={`/agentops/experiments?open=${experiment.id}`}
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        <FlaskConicalIcon className="size-3 text-muted-foreground" />
                        <span className="truncate">{experiment.name}</span>
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">
                        Not derived from one
                      </span>
                    ),
                  },
                  {
                    label: "Rollback target",
                    value: <VersionChip version={release.rollbackTarget} />,
                  },
                  {
                    label: "Deployed",
                    value: release.deployedAt
                      ? formatDateTime(release.deployedAt)
                      : "—",
                  },
                  {
                    label: "Completed",
                    value: release.completedAt
                      ? formatDateTime(release.completedAt)
                      : "—",
                  },
                ]}
              />
            </RecordSection>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            size="sm"
            label="Traffic on new version"
            value={
              live || release.stage === "Promoted" ? `${release.traffic}%` : "—"
            }
            hint={
              live && nextStep !== undefined
                ? `Next step ${nextStep}%`
                : release.stage === "Promoted"
                  ? "Fully promoted"
                  : "Not deployed"
            }
          />
          <StatCard
            size="sm"
            label="Quality vs baseline"
            value={
              release.rollout.length
                ? formatDelta(release.health.qualityDelta, "", 1)
                : "—"
            }
            hint={
              release.rollout.length ? "Evaluator composite" : "No rollout data"
            }
            className={cn(
              release.health.qualityDelta < -0.5 && "ring-destructive/30"
            )}
          />
          <StatCard
            size="sm"
            label="Error rate vs baseline"
            value={
              release.rollout.length
                ? formatDelta(release.health.errorRateDelta, "pt", 2)
                : "—"
            }
            hint={
              release.health.errorRateDelta > 0.2
                ? "Above tolerance"
                : "Within tolerance"
            }
            className={cn(
              release.health.errorRateDelta > 0.2 && "ring-destructive/30"
            )}
          />
          <StatCard
            size="sm"
            label="Cost delta"
            value={formatDelta(release.costDeltaPct, "%", 1)}
            hint="Estimated per day"
          />
        </div>

        <RecordSection
          title="Changes"
          description={`${release.previousVersion} → ${release.version} · ${release.changes.length} change${release.changes.length === 1 ? "" : "s"}`}
          icon={<GitCompareIcon />}
          contentClassName="overflow-x-auto"
        >
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <tr className="border-b">
                <th className="py-2 pr-3 text-left font-medium">Field</th>
                <th className="py-2 pr-3 text-left font-medium">
                  Before · {release.previousVersion}
                </th>
                <th className="py-2 text-left font-medium">
                  After · {release.version}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {release.changes.map((c, i) => (
                <tr key={i}>
                  <td className="py-2.5 pr-3 align-top">
                    <span className="inline-flex items-center gap-2">
                      <span className="text-xs text-muted-foreground capitalize">
                        {c.kind}
                      </span>
                      <span className="font-mono text-xs">{c.field}</span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 align-top">
                    <DiffValue change={c} side="before" />
                  </td>
                  <td className="py-2.5 align-top">
                    <DiffValue change={c} side="after" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </RecordSection>

        <RecordSection
          title="Rollout"
          description={
            release.rollout.length
              ? `${strategyLabel(release.strategy, release.steps)} · started ${release.deployedAt ? timeAgo(release.deployedAt) : ""}`
              : "Traffic steps and health during the rollout appear once it starts."
          }
          icon={<RocketIcon />}
          action={
            live ? (
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDialog("advance")}
                  disabled={paused || nextStep === undefined}
                >
                  <StepForwardIcon /> Advance to {nextStep ?? 100}%
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDialog("pause")}
                >
                  {paused ? <PlayIcon /> : <PauseIcon />}{" "}
                  {paused ? "Resume" : "Pause"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDialog("rollback")}
                >
                  <UndoIcon /> Roll back
                </Button>
              </div>
            ) : undefined
          }
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-medium text-muted-foreground">
                Traffic share and quality
              </h4>
              <RolloutChart
                points={release.rollout}
                domain={[0, 100]}
                series={[
                  {
                    key: "traffic",
                    label: "Traffic %",
                    color: "var(--chart-5)",
                    kind: "step",
                  },
                  {
                    key: "quality",
                    label: "Quality (new)",
                    color: "var(--chart-1)",
                  },
                  {
                    key: "baselineQuality",
                    label: "Quality (baseline)",
                    color: "var(--chart-3)",
                    dashed: true,
                  },
                ]}
                valueFormatter={(v, key) =>
                  key === "traffic" ? `${v}%` : v.toFixed(1)
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-medium text-muted-foreground">
                Error rate
              </h4>
              <RolloutChart
                points={release.rollout}
                domain={[0, "auto"]}
                series={[
                  {
                    key: "errorRate",
                    label: "Error rate (new)",
                    color: "var(--chart-2)",
                  },
                  {
                    key: "baselineErrorRate",
                    label: "Error rate (baseline)",
                    color: "var(--chart-3)",
                    dashed: true,
                  },
                ]}
                valueFormatter={(v) => `${v.toFixed(2)}%`}
              />
            </div>
          </div>
          {release.strategy === "Canary" && (
            <ol className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              {release.steps.map((s, i) => {
                const reached =
                  release.stage === "Promoted" ||
                  (live && release.traffic >= s) ||
                  (release.stage === "Rolled back" && i === 0)
                return (
                  <React.Fragment key={s}>
                    {i > 0 && <span className="text-muted-foreground">→</span>}
                    <li
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 tabular-nums",
                        reached
                          ? "border-brand/30 bg-brand/10 text-brand"
                          : "text-muted-foreground"
                      )}
                    >
                      {reached && <CheckIcon className="size-3" />}
                      {s}%
                    </li>
                  </React.Fragment>
                )
              })}
            </ol>
          )}
        </RecordSection>

        <div className="grid gap-6 lg:grid-cols-2">
          <RecordSection title="Guardrails & gates" icon={<ShieldCheckIcon />}>
            <ul className="flex flex-col divide-y">
              {gateItems.map((g) => (
                <li
                  key={g.label}
                  className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 [&_svg]:size-4",
                      g.ok === undefined
                        ? "text-muted-foreground"
                        : g.ok
                          ? "text-success-text"
                          : "text-danger-text"
                    )}
                  >
                    {g.ok === undefined ? (
                      <CircleDashedIcon />
                    ) : g.ok ? (
                      <ShieldCheckIcon />
                    ) : (
                      <ShieldIcon />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5 text-sm">
                    <span className="font-medium">{g.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {g.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </RecordSection>

          <RecordSection
            title="Activity"
            count={release.activity.length}
            icon={<ActivityIcon />}
          >
            <ol className="relative flex flex-col gap-0">
              {[...release.activity]
                .sort((a, b) => b.at.localeCompare(a.at))
                .map((e, i, arr) => (
                  <li key={e.id} className="relative flex gap-3 pb-3 last:pb-0">
                    {i < arr.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute top-5 left-[9px] h-[calc(100%-0.75rem)] w-px bg-border"
                      />
                    )}
                    <span
                      className={cn(
                        "relative z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border bg-background [&_svg]:size-3",
                        eventTone[e.kind] ?? "text-muted-foreground"
                      )}
                    >
                      {eventIcon[e.kind]}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="text-sm leading-snug">{e.message}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {e.actorId && (
                          <UserChip
                            userId={e.actorId}
                            size="xs"
                            className="[&_span]:text-xs"
                          />
                        )}
                        {e.actorId && "·"}
                        <time dateTime={e.at} title={formatDateTime(e.at)}>
                          {timeAgo(e.at)}
                        </time>
                      </p>
                    </div>
                  </li>
                ))}
            </ol>
          </RecordSection>
        </div>
      </RecordLayout>

      <AlertDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog === "advance" && `Advance to ${nextStep}% of traffic?`}
              {dialog === "pause" &&
                (paused ? "Resume the rollout?" : "Pause the rollout?")}
              {dialog === "rollback" &&
                `Roll back to ${release.rollbackTarget}?`}
              {dialog === "promote" && `Promote ${release.version} to 100%?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === "advance" &&
                `Quality is ${formatDelta(release.health.qualityDelta, "", 1)} and error rate ${formatDelta(release.health.errorRateDelta, "pt", 2)} versus ${release.previousVersion}. The next step widens exposure for ${agent?.name}.`}
              {dialog === "pause" &&
                (paused
                  ? "Traffic stays at the current step and automatic health checks resume."
                  : "Traffic is held at the current step. No automatic promotion while paused.")}
              {dialog === "rollback" &&
                "All traffic returns to the previous version. The release is marked rolled back and the author is notified."}
              {dialog === "promote" &&
                `Skips the remaining canary steps. ${release.environment === "production" ? "All production users" : "Everyone on " + release.environment} get ${release.version} immediately.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={dialog === "rollback" ? "destructive" : "default"}
              onClick={() =>
                dialog === "advance"
                  ? advance()
                  : dialog === "pause"
                    ? togglePause()
                    : dialog === "rollback"
                      ? rollback()
                      : promote()
              }
            >
              {dialog === "advance" && (
                <>
                  <StepForwardIcon /> Advance
                </>
              )}
              {dialog === "pause" &&
                (paused ? (
                  <>
                    <PlayIcon /> Resume
                  </>
                ) : (
                  <>
                    <PauseIcon /> Pause
                  </>
                ))}
              {dialog === "rollback" && (
                <>
                  <UndoIcon /> Roll back
                </>
              )}
              {dialog === "promote" && (
                <>
                  <RocketIcon /> Promote
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function DiffValue({
  change,
  side,
}: {
  change: Release["changes"][number]
  side: "before" | "after"
}) {
  const v = change[side]
  if (change.kind === "model")
    return <ModelChip modelId={v} className="text-xs" />
  if (change.kind === "tools") {
    const added = change.before === "—"
    const present = added ? side === "after" : side === "before"
    return present ? (
      <code
        className={cn(
          "rounded-sm px-1 py-0.5 font-mono text-[11px]",
          added && side === "after"
            ? "bg-success/10 text-success-text"
            : !added && side === "before"
              ? "bg-destructive/10 text-danger-text line-through"
              : "bg-muted"
        )}
      >
        {v}
      </code>
    ) : (
      <span className="text-xs text-muted-foreground">—</span>
    )
  }
  return (
    <code
      className={cn(
        "rounded-sm px-1 py-0.5 font-mono text-xs tabular-nums",
        side === "after"
          ? "bg-brand/10 text-brand"
          : "bg-muted text-muted-foreground"
      )}
    >
      {v}
    </code>
  )
}
