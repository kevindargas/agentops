"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  ArrowRightIcon,
  ArrowUpIcon,
  CheckIcon,
  RocketIcon,
} from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
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
import { deployedAgents } from "@/lib/data"
import {
  compareVersions,
  environments,
  releases,
  type EnvironmentState,
  type ReleaseEnvironment,
} from "@/lib/data/deployments"
import { timeAgo } from "@/lib/format"
import { AgentChip, ModelChip } from "../shared"
import { ChangeChips, VersionChip, environmentLabel } from "./shared"

const columns: ReleaseEnvironment[] = [
  "development",
  "staging",
  "production",
  "shadow",
]

/** Number of known release versions between `from` (exclusive) and `to` (inclusive). */
function versionsAhead(agentId: string, from: string, to: string) {
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

export function EnvironmentsMatrix() {
  const [promote, setPromote] = React.useState<string | null>(null)
  const [promoted, setPromoted] = React.useState<Set<string>>(new Set())

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

  const target = promote ? byAgent.get(promote) : undefined
  const targetAgent = deployedAgents.find((a) => a.id === promote)
  const pendingRelease =
    target?.staging &&
    releases.find(
      (r) => r.agentId === promote && r.version === target.staging?.version
    )

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
          <thead className="bg-muted/40 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
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
                  ? versionsAhead(agent.id, prod.version, staging.version)
                  : 0
              const done = promoted.has(agent.id)
              return (
                <tr key={agent.id} className="align-top">
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
                          {c === "production" ? "Not deployed" : "—"}
                        </td>
                      )
                    const driftFromProd =
                      prod && c !== "production"
                        ? versionsAhead(agent.id, prod.version, e.version)
                        : 0
                    return (
                      <td key={c} className="px-4 py-3">
                        <EnvCell
                          state={e}
                          ahead={done && c === "staging" ? 0 : driftFromProd}
                          highlight={c === "production"}
                        />
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-right">
                    {prod && staging && ahead > 0 && !done ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPromote(agent.id)}
                      >
                        Promote <ArrowRightIcon /> prod
                      </Button>
                    ) : done ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success-text">
                        <CheckIcon className="size-3.5" /> Promoted
                      </span>
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
            <DialogTitle>Promote staging → production</DialogTitle>
            <DialogDescription>
              {targetAgent?.name}: {target?.production?.version} →{" "}
              {target?.staging?.version}. A canary release will be drafted with
              the changes below and sent for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
              <div>
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Production
                </p>
                <div className="mt-1 flex flex-col gap-1">
                  <VersionChip
                    version={target?.production?.version ?? "—"}
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
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Staging
                </p>
                <div className="mt-1 flex flex-col gap-1">
                  <VersionChip
                    version={target?.staging?.version ?? "—"}
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
                <p className="text-xs text-muted-foreground">
                  Already tracked as{" "}
                  <Link
                    href={`/agentops/deployments/${pendingRelease.id}`}
                    className="font-mono hover:underline"
                  >
                    {pendingRelease.id}
                  </Link>{" "}
                  ({pendingRelease.stage.toLowerCase()}).
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Prompt {target?.production?.promptVersion} →{" "}
                {target?.staging?.promptVersion}. Eval gate will run before the
                canary starts.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromote(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (promote) setPromoted((s) => new Set(s).add(promote))
                toast.success("Promotion drafted", {
                  description: `${targetAgent?.name} ${target?.staging?.version} queued for production as a 5% canary.`,
                })
                setPromote(null)
              }}
            >
              <RocketIcon /> Draft canary
            </Button>
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
                <span className="inline-flex items-center gap-0.5 rounded-sm bg-info/10 px-1 py-0.5 text-[10px] font-medium text-info-text tabular-nums" />
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
      <p className="text-[11px] text-muted-foreground">
        <span className="font-mono">{state.promptVersion}</span> ·{" "}
        {timeAgo(state.lastDeployedAt)}
      </p>
    </div>
  )
}
