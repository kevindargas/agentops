"use client"

import { cn } from "cn"
import { HistoryIcon, RotateCwIcon } from "lucide-react"

import { Section } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { scoreTone } from "@/features/agentops/shared"
import { getDeployedAgent } from "@/lib/data/agentops"
import type { PlaygroundRunRecord } from "@/lib/data/playground"
import { formatCost, formatMs, modelDisplayName } from "@/lib/format"
import { ColumnBadge } from "./config-panel"

const qualityText = {
  success: "text-success-text",
  warning: "text-warning-text",
  danger: "text-danger-text",
} as const

export function RunsList({
  runs,
  max,
  onRerun,
  disabled,
  className,
}: {
  runs: PlaygroundRunRecord[]
  /** Cap on the session history, shown in the header. */
  max: number
  onRerun: (run: PlaygroundRunRecord) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <Section
      title="Runs"
      icon={<HistoryIcon />}
      count={runs.length}
      description={`Last ${max} · this browser session only`}
      className={cn("rounded-xl border bg-card p-4", className)}
    >
      {runs.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Runs you make in this session show up here so you can re-run them.
        </p>
      ) : (
        <ul className="-mx-4 -mb-4 divide-y border-t">
          {runs.map((r, i) => {
            const agent = getDeployedAgent(r.config.agentId)
            const p = r.config.params
            const m = r.result.metrics
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 px-4 py-2 text-xs"
              >
                <span className="w-5 shrink-0 font-mono text-2xs text-muted-foreground tabular-nums">
                  #{runs.length - i}
                </span>
                {r.label && <ColumnBadge label={r.label} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {agent?.name ?? r.config.agentId}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {modelDisplayName(r.config.modelId)} ·{" "}
                      <span className="font-mono">
                        {r.config.promptVersion}
                      </span>
                    </span>
                  </p>
                  <p className="truncate font-mono text-2xs text-muted-foreground tabular-nums">
                    T {p.temperature.toFixed(1)} · top_p {p.topP.toFixed(2)} ·{" "}
                    {p.reasoningEffort} · {p.toolChoice} ·{" "}
                    {p.responseFormat === "json_schema" ? "json" : "text"}
                  </p>
                </div>
                <div className="hidden shrink-0 items-center gap-3 font-mono text-2xs tabular-nums sm:flex">
                  <span className="text-muted-foreground">
                    {formatMs(m.latencyMs)}
                  </span>
                  <span className="text-muted-foreground">
                    {formatCost(m.cost, 4)}
                  </span>
                  <span className={qualityText[scoreTone(m.quality)]}>
                    Q {m.quality}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Re-run ${agent?.name ?? "run"} #${runs.length - i}`}
                  onClick={() => onRerun(r)}
                  disabled={disabled}
                >
                  <RotateCwIcon />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
