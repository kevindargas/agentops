"use client"

import { cn } from "cn"
import { TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { deployedAgents } from "@/lib/data/agentops"
import {
  guardrailAppliesTo,
  guardrailCategories,
  guardrailCoverage,
  type Guardrail,
  type GuardrailCategory,
} from "@/lib/data/guardrails"
import { AgentChip, ScoreBar } from "../shared"
import { categoryMeta } from "./shared"

export function CoverageMatrix({
  policies,
  onOpenPolicy,
}: {
  policies: Guardrail[]
  onOpenPolicy: (id: string) => void
}) {
  const rows = deployedAgents
    .map((a) => ({ agent: a, coverage: guardrailCoverage(a.id, policies) }))
    .sort((a, b) => a.coverage.score - b.coverage.score)
  const gaps = rows.reduce((s, r) => s + r.coverage.gaps.length, 0)
  const avg = Math.round(
    rows.reduce((s, r) => s + r.coverage.score, 0) / Math.max(1, rows.length)
  )

  const cellClick = (agentId: string, category: GuardrailCategory) => {
    const agent = deployedAgents.find((a) => a.id === agentId)
    const list = policies.filter(
      (g) =>
        g.status === "Active" &&
        g.category === category &&
        guardrailAppliesTo(g, agentId)
    )
    if (list.length === 0) {
      toast.warning(
        `No ${category.toLowerCase()} guardrail on ${agent?.name}`,
        {
          description: `Add an active ${category.toLowerCase()} policy with ${agent?.name} in scope to close the gap.`,
        }
      )
      return
    }
    toast(
      `${list.length} ${category.toLowerCase()} polic${list.length === 1 ? "y" : "ies"} · ${agent?.name}`,
      {
        description: list.map((g) => g.name).join(" · "),
        action:
          list.length === 1
            ? { label: "Open", onClick: () => onOpenPolicy(list[0].id) }
            : undefined,
      }
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span>
          <span className="font-medium text-foreground tabular-nums">
            {avg}
          </span>{" "}
          average coverage score
        </span>
        <span>
          <span
            className={cn(
              "font-medium tabular-nums",
              gaps > 0 ? "text-warning-text" : "text-foreground"
            )}
          >
            {gaps}
          </span>{" "}
          gap{gaps === 1 ? "" : "s"} across {rows.length} agents
        </span>
        <span className="ml-auto text-xs">
          Score: 70% category breadth, 30% depth (3+ policies per category).
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[44rem] text-sm">
          <caption className="sr-only">
            Active guardrail policies per agent and category, with a coverage
            score
          </caption>
          <thead className="bg-muted/40 text-xs font-medium text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th className="pl-4">Agent</th>
              {guardrailCategories.map((c) => {
                const Icon = categoryMeta[c].icon
                return (
                  <th key={c} className="text-center!">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="inline-flex cursor-default items-center gap-1.5" />
                        }
                      >
                        <Icon className="size-3.5" /> {c}
                      </TooltipTrigger>
                      <TooltipContent>{categoryMeta[c].hint}</TooltipContent>
                    </Tooltip>
                  </th>
                )
              })}
              <th className="w-28 pr-4 text-right!">Coverage</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(({ agent, coverage }) => (
              <tr key={agent.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 pl-4">
                  <div className="flex flex-col gap-0.5">
                    <AgentChip agentId={agent.id} />
                    <span className="pl-[26px] text-2xs text-muted-foreground">
                      {agent.environment} · {agent.team}
                    </span>
                  </div>
                </td>
                {guardrailCategories.map((c) => {
                  const n = coverage.counts[c]
                  const gap = n === 0
                  return (
                    <td key={c} className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => cellClick(agent.id, c)}
                        aria-label={`${n} active ${c.toLowerCase()} ${n === 1 ? "policy" : "policies"} for ${agent.name}`}
                        className={cn(
                          "inline-flex h-9 w-full min-w-16 items-center justify-center gap-1.5 rounded-md border text-sm font-semibold tabular-nums transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                          gap
                            ? "border-warning/40 bg-warning/15 text-warning-text hover:bg-warning/25"
                            : n >= 3
                              ? "border-success/25 bg-success/10 text-success-text hover:bg-success/20"
                              : "border-border bg-muted/40 text-foreground hover:bg-muted"
                        )}
                      >
                        {gap && <TriangleAlertIcon className="size-3.5" />}
                        {n}
                      </button>
                    </td>
                  )
                })}
                <td className="px-3 py-2 pr-4">
                  <ScoreBar
                    value={coverage.score}
                    className="ml-auto w-24 items-end"
                    thresholds={{ good: 85, ok: 70 }}
                    label={`Coverage score ${coverage.score} of 100`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <Legend className="border-warning/40 bg-warning/15">
          Gap: no active policy
        </Legend>
        <Legend className="border-border bg-muted/40">1 to 2 policies</Legend>
        <Legend className="border-success/25 bg-success/10">3+ policies</Legend>
        <span className="ml-auto">
          Counts include only Active policies. Disabled and Draft policies do
          not count toward coverage.
        </span>
      </div>
    </div>
  )
}

function Legend({
  className,
  children,
}: {
  className: string
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn("inline-block size-3 rounded-sm border", className)}
      />
      {children}
    </span>
  )
}
