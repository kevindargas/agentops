"use client"

import { cn } from "cn"
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  MinusIcon,
} from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { fmtCost, fmtMs, fmtTokens } from "@/features/agentops/format"
import { ScoreBar } from "@/features/agentops/shared"
import type { RunMetrics } from "@/lib/data/playground"

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
  /** Streaming in progress — show placeholders for final values. */
  pending?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile
          label="Latency"
          value={metrics ? fmtMs(metrics.latencyMs) : null}
          pending={pending}
          delta={
            metrics && other
              ? relDelta(metrics.latencyMs, other.latencyMs, "lower")
              : undefined
          }
        />
        <Tile
          label="Tokens in → out"
          value={
            metrics
              ? `${fmtTokens(metrics.tokensIn)} → ${fmtTokens(metrics.tokensOut)}`
              : null
          }
          pending={pending}
          delta={
            metrics && other
              ? relDelta(
                  metrics.tokensIn + metrics.tokensOut,
                  other.tokensIn + other.tokensOut,
                  "neutral"
                )
              : undefined
          }
        />
        <Tile
          label="Cost"
          value={metrics ? fmtCost(metrics.cost, 4) : null}
          pending={pending}
          delta={
            metrics && other
              ? relDelta(metrics.cost, other.cost, "lower")
              : undefined
          }
        />
        <Tile
          label="Est. quality"
          value={
            metrics ? (
              <ScoreBar value={metrics.quality} label="Estimated quality" />
            ) : null
          }
          pending={pending}
          delta={
            metrics && other
              ? absDelta(metrics.quality, other.quality, "higher")
              : undefined
          }
        />
      </div>
      {warnings.length > 0 && !pending && (
        <ul className="flex flex-col gap-1">
          {warnings.map((w) => (
            <li
              key={w}
              className="flex items-start gap-1.5 text-[11px] text-warning-text"
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

interface Delta {
  text: string
  tone: "good" | "bad" | "neutral"
  direction: "up" | "down" | "flat"
}

function relDelta(
  a: number,
  b: number,
  better: "lower" | "higher" | "neutral"
): Delta {
  if (b === 0 || Math.abs(a - b) / Math.max(b, 1e-9) < 0.005)
    return { text: "same", tone: "neutral", direction: "flat" }
  const pct = ((a - b) / b) * 100
  const direction = pct > 0 ? "up" : "down"
  const tone =
    better === "neutral"
      ? "neutral"
      : (better === "lower") === pct < 0
        ? "good"
        : "bad"
  return {
    text: `${pct > 0 ? "+" : "−"}${Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%`,
    tone,
    direction,
  }
}

function absDelta(a: number, b: number, better: "higher"): Delta {
  const d = a - b
  if (Math.abs(d) < 0.5)
    return { text: "same", tone: "neutral", direction: "flat" }
  void better
  return {
    text: `${d > 0 ? "+" : "−"}${Math.abs(Math.round(d))} pts`,
    tone: d > 0 ? "good" : "bad",
    direction: d > 0 ? "up" : "down",
  }
}

const toneClass: Record<Delta["tone"], string> = {
  good: "text-success-text",
  bad: "text-danger-text",
  neutral: "text-muted-foreground",
}

function Tile({
  label,
  value,
  delta,
  pending,
}: {
  label: string
  value: React.ReactNode
  delta?: Delta
  pending?: boolean
}) {
  const Icon =
    delta?.direction === "up"
      ? ArrowUpIcon
      : delta?.direction === "down"
        ? ArrowDownIcon
        : MinusIcon
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="min-w-0 text-sm font-medium tabular-nums">
          {pending || value === null ? (
            <Skeleton className="h-4 w-14" />
          ) : (
            value
          )}
        </div>
        {delta && !pending && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium tabular-nums",
              toneClass[delta.tone]
            )}
            title="vs the other configuration"
          >
            <Icon className="size-3" />
            {delta.text}
          </span>
        )}
      </div>
    </div>
  )
}
