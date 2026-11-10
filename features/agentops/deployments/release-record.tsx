"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import {
  ActivityIcon,
  BotIcon,
  CheckCircle2Icon,
  CheckIcon,
  CircleDashedIcon,
  ClockIcon,
  FileClockIcon,
  FlaskConicalIcon,
  GitCompareIcon,
  PauseIcon,
  PlayIcon,
  RocketIcon,
  RouteIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  ShieldIcon,
  StepForwardIcon,
  UndoIcon,
  UserIcon,
  XCircleIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CHART_HEIGHT } from "@/components/charts/chart-primitives"
import { RolloutChart } from "@/components/charts/rollout-chart"
import { LifecycleTracker } from "@/components/record/lifecycle-tracker"
import { MetaItem, RecordHeader } from "@/components/record/record-header"
import { RecordLayout } from "@/components/record/record-layout"
import { RecordNotFound } from "@/components/record/record-not-found"
import { RecordSection } from "@/components/record/record-section"
import { DetailList } from "@/components/shared/detail-list"
import { Eyebrow } from "@/components/shared/eyebrow"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getDeployedAgent, getExperiment } from "@/lib/data/agentops"
import {
  releasePromptVersion,
  type Release,
  type ReleaseEvent,
  type ReleaseStage,
} from "@/lib/data/deployments"
import { clock } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import { formatDelta, formatDateTime, timeAgo } from "@/lib/format"
import { auditHref, recordAudit } from "../audit/audit-store"
import { downloadText } from "../audit/export"
import { AgentChip, ModelChip } from "../shared"
import {
  EnvironmentBadge,
  EvalGateChip,
  evalRunHref,
  healthTolerance,
  StageBadge,
  VersionChip,
  environmentLabel,
  strategyLabel,
} from "./shared"
import { releaseStore } from "./store"

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

/** Markdown release notes for the overflow export. */
function releaseNotes(release: Release, agentName: string) {
  const lines = [
    `# ${release.id}: ${agentName} ${release.previousVersion} to ${release.version}`,
    "",
    release.summary,
    "",
    `- Stage: ${release.stage}`,
    `- Environment: ${release.environment}`,
    `- Strategy: ${strategyLabel(release.strategy, release.steps)}`,
    `- Risk: ${release.risk}`,
    `- Eval gate: ${release.evalGate ? `${release.evalGate.status} (${release.evalGate.score} / ${release.evalGate.threshold}, run ${release.evalGate.runId})` : "not run"}`,
    `- Guardrail coverage: ${release.guardrailCoverage}%`,
    `- Cost delta: ${formatDelta(release.costDeltaPct, "%", 1)} per day`,
    `- Rollback target: ${release.rollbackTarget}`,
    "",
    "## Changes",
    "",
    "| Field | Before | After |",
    "| --- | --- | --- |",
    ...release.changes.map((c) => `| ${c.field} | ${c.before} | ${c.after} |`),
    "",
    "## Activity",
    "",
    ...[...release.activity]
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((e) => `- ${e.at} ${e.kind}: ${e.message}`),
    "",
  ]
  return lines.join("\n")
}

export function ReleaseRecord({
  id,
  initial,
}: {
  id: string
  /** Seeded release for the first server render; session drafts have none. */
  initial?: Release
}) {
  const router = useRouter()
  const releases = releaseStore.use()
  const release = releases.find((r) => r.id === id) ?? initial
  const [paused, setPaused] = React.useState(false)
  const [dialog, setDialog] = React.useState<Dialog>(null)
  const [reason, setReason] = React.useState("")
  const [touched, setTouched] = React.useState(false)

  if (!release)
    return (
      <RecordNotFound
        number={id}
        backHref="/agentops/deployments"
        backLabel="Deployments"
      />
    )

  const agent = getDeployedAgent(release.agentId)
  const agentName = agent?.name ?? release.agentId
  const experiment = release.experimentId
    ? getExperiment(release.experimentId)
    : undefined
  const promptVersion = releasePromptVersion(release)

  const approved = release.approvers.every((a) => a.status === "approved")
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
  const coverageOk = release.guardrailCoverage >= 80
  const costOk = release.costDeltaPct <= 10
  const canDeploy = approved && gateOk && !live && release.stage !== "Promoted"
  const reasonValid = reason.trim().length >= 10
  const errBad = release.health.errorRateDelta > healthTolerance.errorRateDelta
  const qBad = release.health.qualityDelta < healthTolerance.qualityDelta
  const deltasText = `Quality ${formatDelta(release.health.qualityDelta, "", 1)} and error rate ${formatDelta(release.health.errorRateDelta, "pt", 2)} versus ${release.previousVersion}`

  const releaseId = release.id
  const target = {
    kind: "release",
    id: release.id,
    label: `${agentName} ${release.version}`,
    href: `/agentops/deployments/${release.id}`,
  }
  const context = { agentId: release.agentId, releaseId: release.id }

  function log(
    kind: ReleaseEvent["kind"],
    message: string,
    patch?: Partial<Release>
  ) {
    releaseStore.patch(id, (r) => ({
      ...r,
      ...patch,
      activity: [
        ...r.activity,
        {
          id: `${r.id}-local-${r.activity.length}`,
          kind,
          at: clock().toISOString(),
          actorId: currentUser.id,
          message,
        },
      ],
    }))
  }

  function openDialog(next: Dialog) {
    setReason("")
    setTouched(false)
    setDialog(next)
  }

  function auditToast(
    title: string,
    description: string,
    eventId: string,
    kind: "success" | "default" = "default"
  ) {
    const opts = {
      description: `${description} Recorded as ${eventId}.`,
      action: {
        label: "Open audit log",
        onClick: () => router.push(auditHref("release", releaseId)),
      },
      duration: 8000,
    }
    if (kind === "success") toast.success(title, opts)
    else toast(title, opts)
  }

  function approve() {
    if (!release) return
    log("approval", "Approved: all required sign-offs collected", {
      approvers: release.approvers.map((a) =>
        a.status === "approved"
          ? a
          : { ...a, status: "approved", at: clock().toISOString() }
      ),
    })
    const event = recordAudit({
      action: "release.approved",
      source: "release",
      target,
      summary: `Approved ${release.id} (${agentName} ${release.version}) with gate ${release.evalGate?.status ?? "not run"} at ${release.evalGate?.score ?? "n/a"}`,
      context: { ...context, approvalId: `apr-${release.id.slice(4)}` },
    })
    auditToast(
      `${release.id} approved`,
      "The rollout can start whenever the owner is ready.",
      event.id,
      "success"
    )
  }

  function startRollout() {
    if (!release) return
    const first = release.steps[0]
    const stage: ReleaseStage =
      release.strategy === "Canary" ? "Canary" : "Progressing"
    log(
      "deploy",
      release.strategy === "Canary"
        ? `Canary started at ${first}% of ${release.environment} traffic`
        : `${release.strategy} deployment started`,
      { stage, traffic: first, deployedAt: clock().toISOString() }
    )
    const event = recordAudit({
      action: "release.deployed",
      source: "release",
      target,
      summary: `Started ${release.strategy.toLowerCase()} rollout of ${release.id} (${agentName} ${release.version}) at ${first}% of ${release.environment}`,
      before: release.stage,
      after: stage,
      context,
    })
    auditToast(
      "Rollout started",
      `${agentName} ${release.version} is receiving ${first}% of traffic.`,
      event.id,
      "success"
    )
  }

  function advance() {
    if (!release || nextStep === undefined) return
    const promotedNow = nextStep === 100
    log(
      promotedNow ? "promote" : "advance",
      promotedNow
        ? `Promoted to 100% of ${release.environment}`
        : `Advanced to ${nextStep}%. Quality ${formatDelta(release.health.qualityDelta, "", 1)} vs baseline`,
      {
        traffic: nextStep,
        stage: promotedNow ? "Promoted" : "Progressing",
        completedAt: promotedNow ? clock().toISOString() : release.completedAt,
      }
    )
    const event = recordAudit({
      action: promotedNow ? "release.promoted" : "release.canary.advanced",
      source: "release",
      target,
      summary: promotedNow
        ? `Promoted ${release.id} (${agentName} ${release.version}) to 100% of ${release.environment}`
        : `Advanced ${release.id} (${agentName} ${release.version}) to ${nextStep}% of ${release.environment}`,
      before: `${release.traffic}%`,
      after: `${nextStep}%`,
      context,
    })
    setDialog(null)
    auditToast(
      promotedNow ? "Release promoted" : `Advanced to ${nextStep}%`,
      deltasText + ".",
      event.id,
      "success"
    )
  }

  function promote() {
    if (!release) return
    const note = reason.trim()
    log(
      "promote",
      `Promoted to 100% of ${release.environment}${note ? `: ${note}` : ""}`,
      {
        traffic: 100,
        stage: "Promoted",
        completedAt: clock().toISOString(),
      }
    )
    const event = recordAudit({
      action: "release.promoted",
      source: "release",
      target,
      summary: `Promoted ${release.id} (${agentName} ${release.version}) to 100% of ${release.environment}, skipping remaining canary steps`,
      before: `${release.traffic}%`,
      after: "100%",
      context: { ...context, reason: note || undefined },
    })
    setDialog(null)
    auditToast(
      "Release promoted",
      `${agentName} now serves ${release.version} on 100% of ${release.environment}.`,
      event.id,
      "success"
    )
  }

  function rollback() {
    if (!release) return
    if (!reasonValid) {
      setTouched(true)
      return
    }
    const text = reason.trim()
    log("rollback", `Rolled back to ${release.rollbackTarget}: ${text}`, {
      traffic: 0,
      stage: "Rolled back",
      completedAt: clock().toISOString(),
    })
    const event = recordAudit({
      action: "release.rolled_back",
      source: "release",
      target,
      summary: `Rolled back ${release.id} (${agentName} ${release.version}) to ${release.rollbackTarget}`,
      before: release.version,
      after: release.rollbackTarget,
      context: { ...context, reason: text },
    })
    setDialog(null)
    auditToast(
      `Rolled back to ${release.rollbackTarget}`,
      `Traffic returned to ${release.rollbackTarget}; the reason is on the release activity.`,
      event.id
    )
  }

  function togglePause() {
    if (!release) return
    const next = !paused
    setPaused(next)
    log(
      "note",
      next ? "Rollout paused: traffic held at current step" : "Rollout resumed"
    )
    const event = recordAudit({
      action: next ? "release.paused" : "release.resumed",
      source: "release",
      target,
      summary: next
        ? `Paused the rollout of ${release.id} (${agentName} ${release.version}) at ${release.traffic}%`
        : `Resumed the rollout of ${release.id} (${agentName} ${release.version}) at ${release.traffic}%`,
      context,
    })
    setDialog(null)
    auditToast(
      next ? "Rollout paused" : "Rollout resumed",
      next
        ? `Traffic stays at ${release.traffic}% and nothing advances automatically.`
        : "Health checks and manual advancement are available again.",
      event.id
    )
  }

  function exportNotes() {
    if (!release) return
    const file = `${release.id}-release-notes.md`
    downloadText(file, releaseNotes(release, agentName), "text/markdown")
    toast.success("Release notes exported", { description: file })
    return false
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
        <span>
          Not run yet.{" "}
          <Link
            href={`/agentops/evals?agent=${release.agentId}`}
            className="underline-offset-4 hover:underline"
          >
            Open the agent&apos;s eval runs
          </Link>{" "}
          and promote a passed Pre-deploy run, or draft a new release once one
          exists.
        </span>
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
      ok: approved,
      detail: `${release.approvers.filter((a) => a.status === "approved").length} of ${release.approvers.length} approvers signed off`,
    },
  ]

  return (
    <>
      <RecordHeader
        number={release.id}
        title={`${agentName} ${release.version}`}
        backHref="/agentops/deployments"
        backLabel="Deployments"
        description={release.summary}
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
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex" />}>
                  <Button onClick={approve} disabled={!gateOk}>
                    <CheckIcon /> Approve
                  </Button>
                </TooltipTrigger>
                {!gateOk && (
                  <TooltipContent>
                    {release.evalGate
                      ? `Eval gate ${release.evalGate.status}${release.evalGate.reason ? `: ${release.evalGate.reason}` : ""}. The gate must pass before approval.`
                      : "No eval gate yet. Run a Pre-deploy eval first."}
                  </TooltipContent>
                )}
              </Tooltip>
            )}
            {canDeploy &&
              (release.stage === "Draft" ||
                release.stage === "Pending approval") && (
                <Button onClick={startRollout}>
                  <PlayIcon /> Start rollout
                </Button>
              )}
            {live && (
              <>
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex" />}>
                    <Button
                      onClick={() => openDialog("promote")}
                      disabled={paused}
                    >
                      <RocketIcon /> Promote
                    </Button>
                  </TooltipTrigger>
                  {paused && (
                    <TooltipContent>Resume the rollout first.</TooltipContent>
                  )}
                </Tooltip>
                <Button variant="outline" onClick={() => openDialog("pause")}>
                  {paused ? <PlayIcon /> : <PauseIcon />}{" "}
                  {paused ? "Resume" : "Pause"}
                </Button>
              </>
            )}
            {(live || release.stage === "Promoted") && (
              <Button variant="outline" onClick={() => openDialog("rollback")}>
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
          ...(promptVersion
            ? [
                {
                  label: `Open prompt version ${promptVersion.id}`,
                  icon: <ScrollTextIcon />,
                  href: `/agentops/prompts/${promptVersion.promptId}`,
                },
              ]
            : []),
          {
            label: promptVersion
              ? `Traces on ${promptVersion.id}`
              : "Compare traces for this agent",
            icon: <GitCompareIcon />,
            href: promptVersion
              ? `/agentops/traces?agent=${release.agentId}&version=${promptVersion.id}`
              : `/agentops/traces?agent=${release.agentId}`,
          },
          {
            label: "Audit history",
            icon: <FileClockIcon />,
            href: auditHref("release", release.id),
          },
          {
            label: "Export release notes (Markdown)",
            separatorBefore: true,
            onSelect: exportNotes,
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
                                "text-2xs font-medium capitalize",
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
                      <span className="flex flex-col gap-0.5">
                        <Link
                          href={evalRunHref(release.evalGate.runId)}
                          className="font-mono text-xs hover:underline"
                        >
                          {release.evalGate.runId}
                        </Link>
                        <Link
                          href={`/agentops/evals/${release.evalGate.runId}`}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          Open run record
                        </Link>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Not run (Draft)
                      </span>
                    ),
                  },
                  {
                    label: "Prompt version",
                    value: promptVersion ? (
                      <Link
                        href={`/agentops/prompts/${promptVersion.promptId}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {promptVersion.id}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Unchanged</span>
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
                    value: (
                      <Link
                        href={`/agentops/deployments?tab=environments&agent=${release.agentId}`}
                        title="Confirm in the environments matrix"
                      >
                        <VersionChip
                          version={release.rollbackTarget}
                          className="hover:underline"
                        />
                      </Link>
                    ),
                  },
                  {
                    label: "Deployed",
                    value: release.deployedAt
                      ? formatDateTime(release.deployedAt)
                      : "n/a",
                  },
                  {
                    label: "Completed",
                    value: release.completedAt
                      ? formatDateTime(release.completedAt)
                      : "n/a",
                  },
                ]}
              />
            </RecordSection>
          </>
        }
      >
        <StatGrid columns={4}>
          <StatCard
            label="Traffic on new version"
            value={
              live || release.stage === "Promoted"
                ? `${release.traffic}%`
                : "n/a"
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
            label="Quality vs baseline"
            value={
              release.rollout.length
                ? formatDelta(release.health.qualityDelta, "", 1)
                : "n/a"
            }
            hint={
              release.rollout.length ? "Evaluator composite" : "No rollout data"
            }
            className={cn(qBad && "ring-destructive/30")}
          />
          <StatCard
            label="Error rate vs baseline"
            value={
              release.rollout.length
                ? formatDelta(release.health.errorRateDelta, "pt", 2)
                : "n/a"
            }
            hint={errBad ? "Above tolerance" : "Within tolerance"}
            className={cn(errBad && "ring-destructive/30")}
          />
          <StatCard
            label="Cost delta"
            value={formatDelta(release.costDeltaPct, "%", 1)}
            hint="Estimated per day"
          />
        </StatGrid>

        <RecordSection
          title="Changes"
          description={`${release.previousVersion} → ${release.version} · ${release.changes.length} change${release.changes.length === 1 ? "" : "s"}`}
          icon={<GitCompareIcon />}
          contentClassName="overflow-x-auto"
        >
          <table className="w-full min-w-[32rem] text-sm">
            <caption className="sr-only">
              Configuration changes between {release.previousVersion} and{" "}
              {release.version}
            </caption>
            <thead className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
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
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex" />}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDialog("advance")}
                      disabled={paused || nextStep === undefined}
                    >
                      <StepForwardIcon /> Advance to {nextStep ?? 100}%
                    </Button>
                  </TooltipTrigger>
                  {(paused || nextStep === undefined) && (
                    <TooltipContent>
                      {paused
                        ? "Resume the rollout first."
                        : "Already at the last step; use Promote."}
                    </TooltipContent>
                  )}
                </Tooltip>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openDialog("pause")}
                >
                  {paused ? <PlayIcon /> : <PauseIcon />}{" "}
                  {paused ? "Resume" : "Pause"}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => openDialog("rollback")}
                >
                  <UndoIcon /> Roll back
                </Button>
              </div>
            ) : undefined
          }
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Eyebrow as="h3">Traffic share and quality</Eyebrow>
              <RolloutChart
                points={release.rollout}
                domain={[0, 100]}
                height={CHART_HEIGHT.md}
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
              <Eyebrow as="h3">Error rate</Eyebrow>
              <RolloutChart
                points={release.rollout}
                domain={[0, "auto"]}
                height={CHART_HEIGHT.md}
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
                `${deltasText}. The next step widens exposure for ${agentName}. A release.canary.advanced event is appended to the audit log.`}
              {dialog === "pause" &&
                (paused
                  ? "Traffic stays at the current step and automatic health checks resume."
                  : `Traffic is held at ${release.traffic}%. No automatic promotion while paused.`)}
              {dialog === "rollback" &&
                `${deltasText}. All traffic returns to ${release.rollbackTarget} and the release is marked rolled back. A release.rolled_back event with your reason is appended to the audit log; approvers and the author are listed on the record for you to notify.`}
              {dialog === "promote" &&
                `${deltasText}. Skips the remaining canary steps: ${release.environment === "production" ? "all production users" : "everyone on " + release.environment} get ${release.version} immediately.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(dialog === "rollback" || dialog === "promote") && (
            <Field
              data-invalid={
                dialog === "rollback" && touched && !reasonValid
                  ? true
                  : undefined
              }
            >
              <FieldLabel htmlFor={`${release.id}-reason`}>
                {dialog === "rollback" ? "Reason" : "Note (optional)"}
              </FieldLabel>
              <Textarea
                id={`${release.id}-reason`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={
                  dialog === "rollback" && touched && !reasonValid
                    ? true
                    : undefined
                }
                placeholder={
                  dialog === "rollback"
                    ? "e.g. Error rate +0.6pt on the 25% step, drift signal drf-003"
                    : "e.g. Canary held for the full window; skipping the last step"
                }
                className="min-h-20"
                autoFocus
              />
              {dialog === "rollback" && touched && !reasonValid ? (
                <FieldError>
                  Give at least 10 characters; this becomes the audit reason.
                </FieldError>
              ) : (
                <FieldDescription>
                  Posted to the release activity and stored as the audit reason.
                </FieldDescription>
              )}
            </Field>
          )}
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
    const added = change.before === ""
    const present = added ? side === "after" : side === "before"
    return present ? (
      <code
        className={cn(
          "rounded-sm px-1 py-0.5 font-mono text-2xs",
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
      <span className="text-xs text-muted-foreground">n/a</span>
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
