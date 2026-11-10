import { cn } from "cn"
import { GaugeIcon } from "lucide-react"

import { RecordSection } from "@/components/record/record-section"
import { toneClasses, type Tone } from "@/components/shared/status-badge"
import { formatMs } from "@/lib/format"
import type { DeployedAgent } from "@/lib/types"

/** Error-budget state from remaining share and short-window burn. */
export function budgetTone(agent: DeployedAgent): Tone {
  const { remaining, burnRate1h } = agent.errorBudget
  if (remaining <= 0.1 || burnRate1h > 4) return "danger"
  if (remaining <= 0.4 || burnRate1h > 2) return "warning"
  return "success"
}

const barTone: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  progress: "bg-brand",
  brand: "bg-brand",
  neutral: "bg-foreground/55",
  muted: "bg-muted-foreground",
}

/**
 * SLO targets vs the agent's observed 24h metrics, plus the 28-day error
 * budget. Server-renderable; no state.
 */
export function AgentSloCard({ agent }: { agent: DeployedAgent }) {
  const { slo, metrics: m, errorBudget: eb } = agent
  const idle = m.requests24h === 0
  const availability = idle ? undefined : 100 - m.errorRate
  const safeCompletion = idle
    ? undefined
    : Math.min(100, 100 - m.errorRate * 0.6 - m.thumbsDownRate * 0.05)
  const rows: {
    label: string
    target: string
    actual: string
    met?: boolean
  }[] = [
    {
      label: "Availability",
      target: `≥ ${slo.availability}%`,
      actual:
        availability === undefined ? "n/a" : `${availability.toFixed(2)}%`,
      met:
        availability === undefined
          ? undefined
          : availability >= slo.availability,
    },
    {
      label: "Latency p95",
      target: `≤ ${formatMs(slo.p95Ms)}`,
      actual: idle ? "n/a" : formatMs(m.p95Ms),
      met: idle ? undefined : m.p95Ms <= slo.p95Ms,
    },
    {
      label: "Quality",
      target: `≥ ${slo.quality}`,
      actual: `${m.quality}`,
      met: m.quality >= slo.quality,
    },
    {
      label: "Safe completion",
      target: `≥ ${slo.safeCompletion}%`,
      actual:
        safeCompletion === undefined ? "n/a" : `${safeCompletion.toFixed(2)}%`,
      met:
        safeCompletion === undefined
          ? undefined
          : safeCompletion >= slo.safeCompletion,
    },
  ]
  const tone = idle ? "muted" : budgetTone(agent)
  const pct = Math.round(eb.remaining * 100)

  return (
    <RecordSection
      title="SLOs & error budget"
      size="sm"
      icon={<GaugeIcon />}
      description={`${eb.window} rolling window`}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
            <th className="pb-1.5 text-left font-medium">Objective</th>
            <th className="pb-1.5 text-right font-medium">Target</th>
            <th className="pb-1.5 text-right font-medium">Actual</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="py-1.5 pr-2">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn(
                      "inline-block size-1.5 rounded-full",
                      r.met === undefined
                        ? barTone.muted
                        : r.met
                          ? barTone.success
                          : barTone.danger
                    )}
                  />
                  {r.label}
                </span>
              </td>
              <td className="py-1.5 text-right font-mono text-xs text-muted-foreground tabular-nums">
                {r.target}
              </td>
              <td
                className={cn(
                  "py-1.5 text-right font-mono text-xs tabular-nums",
                  r.met === false && toneClasses.danger.text
                )}
              >
                {r.actual}
                <span className="sr-only">
                  {r.met === undefined
                    ? ""
                    : r.met
                      ? " (target met)"
                      : " (target missed)"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-medium">Error budget remaining</span>
          <span
            className={cn(
              "font-mono font-medium tabular-nums",
              toneClasses[tone].text
            )}
          >
            {pct}%
          </span>
        </div>
        <div
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-label="Error budget remaining"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn("h-full rounded-full", barTone[tone])}
            style={{ width: `${pct}%` }}
          />
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Burn rate · 1h</dt>
            <dd
              className={cn(
                "font-mono tabular-nums",
                eb.burnRate1h > 2 && toneClasses.danger.text
              )}
            >
              {eb.burnRate1h.toFixed(1)}x
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Burn rate · 6h</dt>
            <dd
              className={cn(
                "font-mono tabular-nums",
                eb.burnRate6h > 2 && toneClasses.warning.text
              )}
            >
              {eb.burnRate6h.toFixed(1)}x
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-2xs leading-snug text-muted-foreground">
          {idle
            ? "No traffic in the window; the budget is untouched."
            : eb.burnRate1h > 2
              ? "Burning faster than 2x: at this pace the budget is gone before the window ends. Page the owner."
              : "1x means spending the budget exactly over the window."}
        </p>
      </div>
    </RecordSection>
  )
}
