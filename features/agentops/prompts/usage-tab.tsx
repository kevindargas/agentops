"use client"

import Link from "next/link"
import { cn } from "cn"
import { ActivityIcon, FlaskConicalIcon } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { StateBadge } from "@/components/shared/status-badge"
import { experiments } from "@/lib/data"
import { agentsUsingVersion, type PromptVersion } from "@/lib/data/prompts"
import { formatNumber } from "@/lib/format"
import { AgentChip, fmtCost } from "../shared"
import { LabelBadge, VersionTag } from "./shared"

export function UsageTab({
  versions,
}: {
  /** Ascending by version number. */
  versions: PromptVersion[]
}) {
  const totalCost = versions.reduce((acc, v) => acc + v.cost24h, 0)
  const maxReq = Math.max(...versions.map((v) => v.requests24h), 1)
  const rows = [...versions].reverse().map((v) => ({
    v,
    agents: agentsUsingVersion(v.id),
    exps: experiments.filter((e) =>
      e.variants.some((x) => x.promptVersion === v.id)
    ),
  }))
  const live = rows.filter(
    (r) => r.v.requests24h > 0 || r.agents.length || r.exps.length
  )

  if (live.length === 0)
    return (
      <EmptyState
        size="sm"
        icon={<ActivityIcon />}
        title="No traffic yet"
        description="Nothing references this prompt. Pin a version on an agent or start an experiment."
      />
    )

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[48rem] text-sm">
        <thead className="bg-muted/40 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Version</th>
            <th className="px-3 py-2 text-left font-medium">Requests · 24h</th>
            <th className="px-3 py-2 text-right font-medium">Cost share</th>
            <th className="px-3 py-2 text-left font-medium">Referenced by</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(({ v, agents, exps }) => {
            const idle =
              v.requests24h === 0 && agents.length === 0 && exps.length === 0
            const share = totalCost ? v.cost24h / totalCost : 0
            return (
              <tr
                key={v.id}
                className={cn("align-top", idle && "text-muted-foreground")}
              >
                <td className="w-40 px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <VersionTag version={v} className="text-xs" />
                    <LabelBadge label={v.label} size="sm" />
                  </div>
                </td>
                <td className="w-64 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          v.label === "production" ? "bg-chart-1" : "bg-chart-5"
                        )}
                        style={{
                          width: `${(v.requests24h / maxReq) * 100}%`,
                        }}
                      />
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatNumber(v.requests24h)}
                    </span>
                  </div>
                </td>
                <td className="w-32 px-3 py-3 text-right tabular-nums">
                  <span className="font-medium">
                    {share ? `${Math.round(share * 100)}%` : "—"}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {v.cost24h ? fmtCost(v.cost24h) : "no spend"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {agents.length === 0 && exps.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {v.label === "archived"
                        ? "Not referenced"
                        : "Not pinned yet"}
                    </span>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {agents.map((a) => (
                        <li key={a.id} className="flex items-center gap-2">
                          <AgentChip agentId={a.id} size="sm" />
                          <StateBadge state={a.environment} size="sm" />
                        </li>
                      ))}
                      {exps.map((e) => (
                        <li key={e.id} className="flex items-center gap-2">
                          <Link
                            href={`/agentops/experiments?open=${e.id}`}
                            className="inline-flex min-w-0 items-center gap-1.5 text-xs hover:underline"
                          >
                            <FlaskConicalIcon className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate font-medium">
                              {e.name}
                            </span>
                          </Link>
                          <StateBadge state={e.status} size="sm" />
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
