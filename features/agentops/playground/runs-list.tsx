"use client"

import { cn } from "cn"
import { HistoryIcon, RotateCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { fmtCost, fmtMs, modelDisplayName } from "@/features/agentops/format"
import { scoreTone } from "@/features/agentops/shared"
import { getDeployedAgent } from "@/lib/data"
import type { PlaygroundRunRecord } from "@/lib/data/playground"
import { ColumnBadge } from "./config-panel"

const qualityText = {
  success: "text-success-text",
  warning: "text-warning-text",
  danger: "text-danger-text",
} as const

export function RunsList({
  runs,
  onRerun,
  disabled,
  className,
}: {
  runs: PlaygroundRunRecord[]
  onRerun: (run: PlaygroundRunRecord) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <section
      className={cn("rounded-xl border bg-card", className)}
      aria-labelledby="playground-runs"
    >
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2
          id="playground-runs"
          className="flex items-center gap-1.5 text-sm font-semibold"
        >
          <HistoryIcon className="size-3.5 text-muted-foreground" /> Runs
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
            {runs.length}
          </span>
        </h2>
        <span className="text-[11px] text-muted-foreground">
          Last 8 · session only
        </span>
      </header>
      {runs.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          Runs you make in this session show up here so you can re-run them.
        </p>
      ) : (
        <ul className="divide-y">
          {runs.map((r, i) => {
            const agent = getDeployedAgent(r.config.agentId)
            const p = r.config.params
            const m = r.result.metrics
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 px-4 py-2 text-xs"
              >
                <span className="w-5 shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
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
                  <p className="truncate font-mono text-[11px] text-muted-foreground tabular-nums">
                    T {p.temperature.toFixed(1)} · top_p {p.topP.toFixed(2)} ·{" "}
                    {p.reasoningEffort} · {p.toolChoice} ·{" "}
                    {p.responseFormat === "json_schema" ? "json" : "text"}
                  </p>
                </div>
                <div className="hidden shrink-0 items-center gap-3 font-mono text-[11px] tabular-nums sm:flex">
                  <span className="text-muted-foreground">
                    {fmtMs(m.latencyMs)}
                  </span>
                  <span className="text-muted-foreground">
                    {fmtCost(m.cost, 4)}
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
    </section>
  )
}
