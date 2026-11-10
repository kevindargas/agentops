"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import {
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  RocketIcon,
} from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { deployedAgents } from "@/lib/data/agentops"
import {
  compareVersions,
  environments,
  GATE_THRESHOLD,
  type EnvironmentState,
  type Release,
  type ReleaseEnvironment,
} from "@/lib/data/deployments"
import { evalRuns } from "@/lib/data/evals"
import { timeAgo } from "@/lib/format"
import { AgentChip, ModelChip } from "../shared"
import {
  ChangeChips,
  EvalGateChip,
  StageBadge,
  VersionChip,
  environmentLabel,
} from "./shared"
import { draftReleaseFromStaging, releaseStore } from "./store"

const columns: ReleaseEnvironment[] = [
  "development",
  "staging",
  "production",
  "shadow",
]

/** Number of known release versions between `from` (exclusive) and `to` (inclusive). */
function versionsAhead(
  releases: Release[],
  agentId: string,
  from: string,
  to: string
) {
  if (compareVersions(to, from) <= 0) return 0
  const between = new Set(
    releases
      .filter(
        (r) =>
          r.agentId === agentId &&
          compareVersions(r.version, from) > 0 &&
          compareVersions(r.version, to) <= 0
      )
      .map((r) => r.version)
  )
  return Math.max(1, between.size)
}

/** Most recent finished run of the agent on the staging prompt version, else any passed run. */
function gateRunFor(agentId: string, promptVersion: string) {
  const finished = evalRuns
    .filter(
      (r) =>
        r.agentId === agentId &&
        (r.status === "Passed" || r.status === "Failed")
    )
    .sort((a, b) => b.started.localeCompare(a.started))
  return (
    finished.find((r) => r.promptVersion === promptVersion) ??
    finished.find((r) => r.status === "Passed")
  )
}

export function EnvironmentsMatrix({
  highlightAgentId,
}: {
  /** Agent from `?agent=`; its row is tinted so the operator lands on it. */
  highlightAgentId?: string
}) {
  const router = useRouter()
  const releases = releaseStore.use()
  const [promote, setPromote] = React.useState<string | null>(null)

  const byAgent = React.useMemo(() => {
    const map = new Map<
      string,
      Partial<Record<ReleaseEnvironment, EnvironmentState>>
    >()
    for (const e of environments) {
      const entry = map.get(e.agentId) ?? {}
      entry[e.environment] = e
      map.set(e.agentId, entry)
    }
    return map
  }, [])

  /** A release in this session or the seed already tracking an agent's staging version. */
  const trackingRelease = (agentId: string, version?: string) =>
    version
      ? releases.find(
          (r) =>
            r.agentId === agentId &&
            r.version === version &&
            r.stage !== "Rolled back" &&
            r.stage !== "Failed"
        )
      : undefined

  const target = promote ? byAgent.get(promote) : undefined
  const targetAgent = deployedAgents.find((a) => a.id === promote)
  const pendingRelease = promote
    ? trackingRelease(promote, target?.staging?.version)
    : undefined
  const gateRun =
    promote && target?.staging
      ? gateRunFor(promote, target.staging.promptVersion)
      : undefined

  function draftCanary() {
    if (!targetAgent || !target?.production || !target.staging) return
    const release = draftReleaseFromStaging({
      agent: targetAgent,
      production: target.production,
      staging: target.staging,
      gateRun,
    })
    setPromote(null)
    toast.success(`${release.id} drafted`, {
      description:
        release.stage === "Pending approval"
          ? `${targetAgent.name} ${target.staging.version} waits for ${release.approvers.length} approver${release.approvers.length === 1 ? "" : "s"}; canary 5% then 25% then 100% once approved.`
          : `${targetAgent.name} ${target.staging.version} is a Draft without an eval gate. Run a Pre-deploy eval before requesting approval.`,
      action: {
        label: "Open release",
        onClick: () => router.push(`/agentops/deployments/${release.id}`),
      },
      duration: 10_000,
    })
  }

  if (byAgent.size === 0)
    return (
      <EmptyState
        title="No environments"
        description="Register an agent to see its environments here."
        icon={<RocketIcon />}
      />
    )

  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[56rem] text-sm">
          <caption className="sr-only">
            Deployed version, model and prompt per agent and environment
          </caption>
          <thead className="bg-muted/40 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Agent</th>
              {columns.map((c) => (
                <th key={c} className="px-4 py-2.5 text-left font-medium">
                  {environmentLabel[c]}
                </th>
              ))}
              <th className="px-4 py-2.5 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {deployedAgents.map((agent) => {
              const envs = byAgent.get(agent.id) ?? {}
              const prod = envs.production
              const staging = envs.staging
              const ahead =
                prod && staging
                  ? versionsAhead(
                      releases,
                      agent.id,
                      prod.version,
                      staging.version
                    )
                  : 0
              const tracked = trackingRelease(agent.id, staging?.version)
              const drafted =
                tracked &&
                (tracked.stage === "Draft" ||
                  tracked.stage === "Pending approval")
              return (
                <tr
                  key={agent.id}
                  id={`env-${agent.id}`}
                  className={cn(
                    "align-top",
                    highlightAgentId === agent.id && "bg-brand/5"
                  )}
                >
                  <td className="px-4 py-3">
                    <AgentChip agentId={agent.id} />
                    <p className="mt-0.5 pl-6.5 text-xs text-muted-foreground">
                      {agent.team}
                    </p>
                  </td>
                  {columns.map((c) => {
                    const e = envs[c]
                    if (!e)
                      return (
                        <td
                          key={c}
                          className="px-4 py-3 text-xs text-muted-foreground"
                        >
                          {c === "production" ? "Not deployed" : "n/a"}
                        </td>
                      )
                    const driftFromProd =
                      prod && c !== "production"
                        ? versionsAhead(
                            releases,
                            agent.id,
                            prod.version,
                            e.version
                          )
                        : 0
                    return (
                      <td key={c} className="px-4 py-3">
                        <EnvCell
                          state={e}
                          ahead={driftFromProd}
                          highlight={c === "production"}
                        />
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-right">
                    {prod && staging && ahead > 0 && drafted ? (
                      <Button
                        size="sm"
                        variant="outline"
                        render={
                          <Link href={`/agentops/deployments/${tracked.id}`} />
                        }
                      >
                        {tracked.id} <ArrowUpRightIcon />
                      </Button>
                    ) : prod && staging && ahead > 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPromote(agent.id)}
                      >
                        Promote <ArrowRightIcon /> prod
                      </Button>
                    ) : prod ? (
                      <span className="text-xs text-muted-foreground">
                        In sync
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Staging only
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog
        open={promote !== null}
        onOpenChange={(o) => !o && setPromote(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Promote staging to production</DialogTitle>
            <DialogDescription>
              {targetAgent?.name}: {target?.production?.version} to{" "}
              {target?.staging?.version}. A canary release (5% then 25% then
              100%) is drafted with the changes below and sent for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
              <div>
                <Eyebrow>Production</Eyebrow>
                <div className="mt-1 flex flex-col gap-1">
                  <VersionChip
                    version={target?.production?.version ?? "n/a"}
                    className="w-fit"
                  />
                  {target?.production && (
                    <ModelChip
                      modelId={target.production.modelId}
                      className="text-xs"
                    />
                  )}
                </div>
              </div>
              <div>
                <Eyebrow>Staging</Eyebrow>
                <div className="mt-1 flex flex-col gap-1">
                  <VersionChip
                    version={target?.staging?.version ?? "n/a"}
                    className="w-fit"
                  />
                  {target?.staging && (
                    <ModelChip
                      modelId={target.staging.modelId}
                      className="text-xs"
                    />
                  )}
                </div>
              </div>
            </div>
            {pendingRelease ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Changes in {pendingRelease.version}
                </p>
                <ChangeChips changes={pendingRelease.changes} max={6} />
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Already tracked as{" "}
                  <Link
                    href={`/agentops/deployments/${pendingRelease.id}`}
                    className="font-mono hover:underline"
                  >
                    {pendingRelease.id}
                  </Link>
                  <StageBadge stage={pendingRelease.stage} size="sm" />
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                <p>
                  Prompt {target?.production?.promptVersion} to{" "}
                  {target?.staging?.promptVersion}.
                </p>
                <p className="flex flex-wrap items-center gap-1.5">
                  Eval gate:
                  {gateRun ? (
                    <EvalGateChip
                      gate={{
                        status:
                          gateRun.status === "Passed" ? "passed" : "failed",
                        score: gateRun.composite,
                        threshold: GATE_THRESHOLD,
                        runId: gateRun.id,
                      }}
                      showReason={false}
                    />
                  ) : (
                    <span>
                      none yet. The release is drafted without a gate and cannot
                      start until a Pre-deploy run passes.
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromote(null)}>
              Cancel
            </Button>
            {pendingRelease ? (
              <Button
                render={
                  <Link href={`/agentops/deployments/${pendingRelease.id}`} />
                }
              >
                Open {pendingRelease.id} <ArrowUpRightIcon />
              </Button>
            ) : (
              <Button onClick={draftCanary}>
                <RocketIcon /> Draft canary
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function EnvCell({
  state,
  ahead,
  highlight,
}: {
  state: EnvironmentState
  ahead: number
  highlight?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {state.releaseId ? (
          <Link href={`/agentops/deployments/${state.releaseId}`}>
            <VersionChip
              version={state.version}
              className={cn(
                highlight &&
                  "border-success/40 bg-success/10 text-success-text",
                "hover:underline"
              )}
            />
          </Link>
        ) : (
          <VersionChip version={state.version} tone="muted" />
        )}
        {ahead > 0 && (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex items-center gap-0.5 rounded-sm bg-info/10 px-1 py-0.5 text-3xs font-medium text-info-text tabular-nums" />
              }
            >
              <ArrowUpIcon className="size-2.5" />
              {ahead}
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {ahead} version{ahead === 1 ? "" : "s"} ahead of production
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <ModelChip modelId={state.modelId} className="text-xs" />
      <p className="text-2xs text-muted-foreground">
        <span className="font-mono">{state.promptVersion}</span> ·{" "}
        {timeAgo(state.lastDeployedAt)}
      </p>
    </div>
  )
}
