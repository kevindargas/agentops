"use client"

import * as React from "react"
import { cn } from "cn"
import { SlidersHorizontalIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { CountPill } from "@/components/shared/count-pill"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { formatNumber } from "@/lib/format"
import { alertsStore, openAlerts } from "./alerts-store"

/** Correlation window applied by the sample de-duplication rules, minutes. */
const DEDUPE_WINDOW_MIN = 5

/**
 * Header action on the alerts page. The rules are derived from the alert
 * data (one de-duplication rule per monitoring source, plus a recovery rule),
 * and the switches are session state: pausing a rule does not change the
 * alerts already correlated.
 */
export function CorrelationRulesSheet() {
  const [open, setOpen] = React.useState(false)
  const [paused, setPaused] = React.useState<Set<string>>(() => new Set())
  const list = alertsStore.use()
  const active = openAlerts(list)

  const sources = Array.from(new Set(list.map((a) => a.source))).sort()
  const rules = [
    ...sources.map((source) => {
      const rows = active.filter((a) => a.source === source)
      return {
        id: `dedupe-${source}`,
        name: `${source}: de-duplicate by node and metric`,
        description: `Events from ${source} on the same node and metric within ${DEDUPE_WINDOW_MIN} minutes become one alert.`,
        alerts: rows.length,
        events: rows.reduce((sum, a) => sum + a.count, 0),
      }
    }),
    {
      id: "auto-close-clear",
      name: "Close on recovery",
      description:
        "A Clear event closes the matching alert instead of opening a new one.",
      alerts: list.filter((a) => a.severity === "Clear").length,
      events: list
        .filter((a) => a.severity === "Clear")
        .reduce((sum, a) => sum + a.count, 0),
    },
  ]

  function toggle(id: string, name: string, enabled: boolean) {
    setPaused((prev) => {
      const next = new Set(prev)
      if (enabled) next.delete(id)
      else next.add(id)
      return next
    })
    toast(enabled ? `Rule resumed: ${name}` : `Rule paused: ${name}`, {
      description: "Applies to this session; existing alerts are unchanged.",
    })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <SlidersHorizontalIcon /> Correlation rules
      </Button>
      <SheetContent
        className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
      >
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>Correlation rules</SheetTitle>
          <SheetDescription>
            How monitoring events are folded into alerts. Counts are the open
            alerts each rule produced and the events behind them.
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <ul className="divide-y">
            {rules.map((rule) => {
              const enabled = !paused.has(rule.id)
              const id = `rule-${rule.id}`
              return (
                <li
                  key={rule.id}
                  className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 space-y-1">
                    <label
                      htmlFor={id}
                      className="flex flex-wrap items-center gap-1.5 text-sm font-medium"
                    >
                      {rule.name}
                      <CountPill
                        count={rule.alerts}
                        label={`alert${rule.alerts === 1 ? "" : "s"}`}
                      />
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {rule.description}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatNumber(rule.events)} event
                      {rule.events === 1 ? "" : "s"} correlated
                      {!enabled && " · paused"}
                    </p>
                  </div>
                  <Switch
                    id={id}
                    checked={enabled}
                    onCheckedChange={(c) => toggle(rule.id, rule.name, c)}
                    aria-label={`${rule.name} enabled`}
                  />
                </li>
              )
            })}
          </ul>
        </SheetBody>
        <SheetFooterActions />
      </SheetContent>
    </Sheet>
  )
}
