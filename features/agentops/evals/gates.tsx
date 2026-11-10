"use client"

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
import { Button } from "@/components/ui/button"
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
import { getDeployedAgent } from "@/lib/data/agentops"
import type { ReleaseGate } from "@/lib/data/evals"
import { AgentChip, ModelChip } from "@/features/agentops/shared"
import { recordAudit } from "../audit/audit-store"
import { evalTone, PromptChip } from "./shared"
import { gateStore } from "./store"

export function ReleaseGates({ agentId }: { agentId?: string }) {
  const gates = gateStore.use()
  const visible = agentId ? gates.filter((g) => g.agentId === agentId) : gates
  const passing = visible.filter((g) => g.status === "Passed").length
  const enforced = visible.filter((g) => g.enforced).length

  const toggle = (id: string, on: boolean) => {
    const g = gateStore.get().find((x) => x.id === id)
    if (!g) return
    gateStore.patch(id, { enforced: on })
    const name = getDeployedAgent(g.agentId)?.name ?? g.agentId
    const event = recordAudit({
      action: on ? "release.gate.enforced" : "release.gate.advisory",
      source: "release",
      target: {
        kind: "release-gate",
        id: g.id,
        label: `${name} release gate`,
        href: "/agentops/evals?tab=gates",
      },
      summary: on
        ? `Enforced the release gate for ${name}: promotions block while any rule fails`
        : `Set the release gate for ${name} to advisory: failing rules are reported, not blocking`,
      before: g.enforced ? "enforced" : "advisory",
      after: on ? "enforced" : "advisory",
      context: { agentId: g.agentId },
    })
    toast(on ? "Gate enforced" : "Gate set to advisory", {
      description: on
        ? `Promotions of ${name} are blocked until every rule passes. Recorded as ${event.id}.`
        : `${name} can be promoted with failing rules; results are still reported. Recorded as ${event.id}.`,
    })
  }

  if (visible.length === 0)
    return (
      <EmptyState
        size="sm"
        icon={<ShieldCheckIcon />}
        title="No release gates"
        description="A gate is derived from the agent's latest completed golden-set run. Run an eval for this agent to get one."
        action={
          <Button
            variant="outline"
            size="sm"
            render={
              <Link
                href={
                  agentId
                    ? `/agentops/evals?tab=runs&agent=${agentId}`
                    : "/agentops/evals?tab=runs"
                }
              />
            }
          >
            Open eval runs
          </Button>
        }
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
            <ModelChip modelId={agent.modelId} className="text-2xs" />
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
              <span className="shrink-0 font-mono text-2xs text-muted-foreground tabular-nums">
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
