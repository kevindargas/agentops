"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  ArrowUpRightIcon,
  CheckCircle2Icon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react"
import { toast } from "sonner"

import { DateCell } from "@/components/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { StateBadge } from "@/components/shared/status-badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { getDeployedAgent } from "@/lib/data"
import { releaseGates as seed, type ReleaseGate } from "@/lib/data/evals"
import { AgentChip, ModelChip } from "@/features/agentops/shared"
import { evalTone, PromptChip } from "./shared"

export function ReleaseGates({ agentId }: { agentId?: string }) {
  const [gates, setGates] = React.useState<ReleaseGate[]>(seed)
  const visible = agentId ? gates.filter((g) => g.agentId === agentId) : gates
  const passing = visible.filter((g) => g.status === "Passed").length
  const enforced = visible.filter((g) => g.enforced).length

  const toggle = (id: string, on: boolean) => {
    setGates((prev) =>
      prev.map((g) => (g.id === id ? { ...g, enforced: on } : g))
    )
    const g = gates.find((x) => x.id === id)
    const name = getDeployedAgent(g?.agentId ?? "")?.name ?? "agent"
    toast(on ? "Gate enforced" : "Gate set to advisory", {
      description: on
        ? `Promotions of ${name} are blocked until every rule passes`
        : `${name} can be promoted with failing rules; results are still reported`,
    })
  }

  if (visible.length === 0)
    return (
      <EmptyState
        size="sm"
        icon={<ShieldCheckIcon />}
        title="No release gates"
        description="Define the eval rules a candidate must clear before it can be promoted."
      />
    )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground tabular-nums">
        {passing} of {visible.length} gates passing · {enforced} enforced ·
        rules are evaluated on the latest completed golden-set run and the
        latest PII probe run for each agent.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((g) => (
          <GateCard key={g.id} gate={g} onToggle={toggle} />
        ))}
      </div>
    </div>
  )
}

function GateCard({
  gate: g,
  onToggle,
}: {
  gate: ReleaseGate
  onToggle: (id: string, on: boolean) => void
}) {
  const agent = getDeployedAgent(g.agentId)
  const failing = g.rules.filter((r) => !r.pass).length
  return (
    <Card
      size="sm"
      className={cn(
        "h-full",
        g.status === "Failed" && g.enforced && "ring-destructive/25"
      )}
    >
      <CardHeader className="gap-1.5">
        <CardTitle className="flex items-center gap-2">
          <AgentChip agentId={g.agentId} />
          <StateBadge
            state={g.status}
            tone={evalTone[g.status]}
            size="sm"
            className="ml-auto"
          />
        </CardTitle>
        {agent && (
          <CardDescription className="flex flex-wrap items-center gap-1.5">
            <PromptChip version={agent.promptVersion} />
            <ModelChip modelId={agent.modelId} className="text-[11px]" />
            <StateBadge state={agent.environment} size="sm" />
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-lg border">
          {g.rules.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-2.5 px-3 py-2 text-sm"
            >
              {r.pass ? (
                <CheckCircle2Icon
                  className="size-4 shrink-0 text-success"
                  aria-label="Pass"
                />
              ) : (
                <XCircleIcon
                  className="size-4 shrink-0 text-destructive"
                  aria-label="Fail"
                />
              )}
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                {r.requirement}
              </span>
              <span
                className={cn(
                  "w-14 shrink-0 text-right font-mono text-xs font-medium tabular-nums",
                  r.pass ? "text-success-text" : "text-danger-text"
                )}
              >
                {r.current}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span>
            Evaluated <DateCell value={g.lastEvaluated} tone="default" />
            {g.lastRunId && (
              <>
                {" · "}
                <Link
                  href={`/agentops/evals/${g.lastRunId}`}
                  className="inline-flex items-center gap-0.5 font-mono hover:text-foreground hover:underline"
                >
                  {g.lastRunId}
                  <ArrowUpRightIcon className="size-3" />
                </Link>
              </>
            )}
          </span>
          <span>
            {failing === 0
              ? "Ready to promote"
              : `${failing} ${failing === 1 ? "rule" : "rules"} failing${g.enforced ? " · promotion blocked" : " · advisory"}`}
          </span>
        </span>
        <Label className="flex shrink-0 items-center gap-2 text-xs font-normal">
          Enforce
          <Switch
            size="sm"
            checked={g.enforced}
            onCheckedChange={(on) => onToggle(g.id, on)}
            aria-label={`Enforce release gate for ${agent?.name ?? g.agentId}`}
          />
        </Label>
      </CardFooter>
    </Card>
  )
}
