import { cn } from "cn"
import { AlertTriangleIcon } from "lucide-react"

import { MetricTile } from "@/components/shared/metric-tile"
import { Skeleton } from "@/components/ui/skeleton"
import { ScoreBar } from "@/features/agentops/shared"
import type { RunMetrics } from "@/lib/data/playground"
import { formatCost, formatMs, formatTokens } from "@/lib/format"

/** Relative change in percent, or undefined when the two are within 0.5%. */
function relDelta(a: number, b: number) {
  if (b === 0) return undefined
  const pct = ((a - b) / b) * 100
  return Math.abs(pct) < 0.5 ? 0 : Math.round(pct * 10) / 10
}

export function MetricsStrip({
  metrics,
  other,
  warnings = [],
  pending,
  className,
}: {
  metrics: RunMetrics | null
  /** Metrics of the other column in compare mode; differences are highlighted. */
  other?: RunMetrics | null
  warnings?: string[]
  /** Streaming in progress: show placeholders for final values. */
  pending?: boolean
  className?: string
}) {
  const ready = Boolean(metrics) && !pending
  const compare = ready && other ? other : null
  const placeholder = <Skeleton className="h-5 w-14" />
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetricTile
          label="Latency"
          value={ready && metrics ? formatMs(metrics.latencyMs) : placeholder}
          delta={
            compare && metrics
              ? relDelta(metrics.latencyMs, compare.latencyMs)
              : undefined
          }
          upIsGood={false}
        />
        <MetricTile
          label="Tokens in / out"
          value={
            ready && metrics
              ? `${formatTokens(metrics.tokensIn)} / ${formatTokens(metrics.tokensOut)}`
              : placeholder
          }
          delta={
            compare && metrics
              ? relDelta(
                  metrics.tokensIn + metrics.tokensOut,
                  compare.tokensIn + compare.tokensOut
                )
              : undefined
          }
          upIsGood={false}
        />
        <MetricTile
          label="Cost"
          value={ready && metrics ? formatCost(metrics.cost, 4) : placeholder}
          delta={
            compare && metrics
              ? relDelta(metrics.cost, compare.cost)
              : undefined
          }
          upIsGood={false}
        />
        <MetricTile
          label="Est. quality"
          hint={ready ? "Heuristic, 0 to 100" : undefined}
          value={
            ready && metrics ? (
              <ScoreBar value={metrics.quality} label="Estimated quality" />
            ) : (
              placeholder
            )
          }
          delta={
            compare && metrics
              ? Math.round(metrics.quality - compare.quality)
              : undefined
          }
          deltaUnit="pt"
        />
      </div>
      {warnings.length > 0 && !pending && (
        <ul className="flex flex-col gap-1">
          {warnings.map((w) => (
            <li
              key={w}
              className="flex items-start gap-1.5 text-2xs text-warning-text"
            >
              <AlertTriangleIcon className="mt-0.5 size-3 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
