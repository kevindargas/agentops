"use client"

import * as React from "react"
import { cn } from "cn"
import { AlertCircleIcon, ChevronDownIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { TraceSpan } from "@/lib/types"
import { fmtCost, fmtMs, fmtTokens, modelDisplayName, nodeMeta } from "./shared"

const barTone: Record<TraceSpan["type"], string> = {
  router: "bg-chart-4",
  llm: "bg-brand",
  retriever: "bg-chart-3",
  tool: "bg-chart-2",
  human: "bg-warning",
  guard: "bg-success",
  chain: "bg-muted-foreground/50",
}

/**
 * Span waterfall for a single trace: one row per span with a proportional
 * timing bar, expandable to show inputs, outputs and attributes.
 */
export function TraceWaterfall({
  spans,
  totalMs,
  className,
}: {
  spans: TraceSpan[]
  totalMs: number
  className?: string
}) {
  const [open, setOpen] = React.useState<string | null>(
    spans.find((s) => s.status === "error")?.id ?? null
  )
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  return (
    <div className={cn("overflow-hidden rounded-xl border", className)}>
      <div className="grid grid-cols-[minmax(12rem,1.2fr)_3fr_auto] items-center gap-3 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <span>Span</span>
        <span className="relative h-3">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute top-0 -translate-x-1/2 font-mono text-[10px] normal-case tabular-nums"
              style={{ left: `${t * 100}%` }}
            >
              {fmtMs(totalMs * t)}
            </span>
          ))}
        </span>
        <span className="w-20 text-right">Duration</span>
      </div>
      <ol className="divide-y">
        {spans.map((s) => {
          const meta = nodeMeta[s.type]
          const Icon = meta.icon
          const depth = s.parentId ? 1 : 0
          const left = (s.startMs / totalMs) * 100
          const width = Math.max(0.8, (s.durationMs / totalMs) * 100)
          const isOpen = open === s.id
          return (
            <li key={s.id}>
              <Collapsible
                open={isOpen}
                onOpenChange={(o) => setOpen(o ? s.id : null)}
              >
                <CollapsibleTrigger
                  render={
                    <button
                      type="button"
                      className="grid w-full grid-cols-[minmax(12rem,1.2fr)_3fr_auto] items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/40 data-[panel-open]:bg-muted/30"
                      aria-label={`${s.name}, ${fmtMs(s.durationMs)}, ${s.status}`}
                    />
                  }
                >
                  <span
                    className="flex min-w-0 items-center gap-2"
                    style={{ paddingLeft: depth * 16 }}
                  >
                    <ChevronDownIcon
                      className={cn(
                        "size-3.5 shrink-0 text-muted-foreground transition-transform",
                        !isOpen && "-rotate-90"
                      )}
                    />
                    <span
                      className={cn(
                        "inline-flex size-5 shrink-0 items-center justify-center rounded-md border",
                        meta.className
                      )}
                    >
                      <Icon className="size-3" />
                    </span>
                    <span className="truncate text-sm">{s.name}</span>
                    {s.status === "error" && (
                      <AlertCircleIcon
                        className="size-3.5 shrink-0 text-destructive"
                        aria-label="error"
                      />
                    )}
                  </span>
                  <span className="relative h-5">
                    {ticks.slice(1, -1).map((t) => (
                      <span
                        key={t}
                        className="absolute inset-y-0 border-l border-dashed border-border/60"
                        style={{ left: `${t * 100}%` }}
                      />
                    ))}
                    <span
                      className={cn(
                        "absolute top-1 h-3 rounded-sm",
                        s.status === "error"
                          ? "bg-destructive"
                          : barTone[s.type],
                        depth === 0 && "opacity-40"
                      )}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                  </span>
                  <span className="w-20 text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {fmtMs(s.durationMs)}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid gap-3 border-t bg-muted/20 px-3 py-3 pl-10 text-xs lg:grid-cols-[1fr_1fr_14rem]">
                    <Field label="Input">
                      {s.input ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Field>
                    <Field
                      label="Output"
                      tone={s.status === "error" ? "danger" : undefined}
                    >
                      {s.output ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Field>
                    <div className="flex flex-col gap-2">
                      <Field label="Timing">
                        <span className="font-mono tabular-nums">
                          {fmtMs(s.startMs)} → {fmtMs(s.startMs + s.durationMs)}
                        </span>
                      </Field>
                      {s.modelId && (
                        <Field label="Model">
                          {modelDisplayName(s.modelId)} ·{" "}
                          {fmtTokens(s.tokensIn ?? 0)} in /{" "}
                          {fmtTokens(s.tokensOut ?? 0)} out ·{" "}
                          {fmtCost(s.cost ?? 0, 3)}
                        </Field>
                      )}
                      {s.attributes && (
                        <Field label="Attributes">
                          <span className="flex flex-wrap gap-1">
                            {Object.entries(s.attributes).map(([k, v]) => (
                              <Badge
                                key={k}
                                variant="outline"
                                className="h-5 gap-1 px-1.5 font-mono text-[10px] font-normal text-muted-foreground"
                              >
                                {k}=
                                <span className="text-foreground">
                                  {String(v)}
                                </span>
                              </Badge>
                            ))}
                          </span>
                        </Field>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Field({
  label,
  children,
  tone,
}: {
  label: string
  children: React.ReactNode
  tone?: "danger"
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div
        className={cn(
          "rounded-md border bg-background px-2.5 py-2 leading-relaxed break-words whitespace-pre-wrap",
          tone === "danger" && "border-destructive/30 text-danger-text"
        )}
      >
        {children}
      </div>
    </div>
  )
}
