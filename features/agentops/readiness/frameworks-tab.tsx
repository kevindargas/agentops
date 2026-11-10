"use client"

import * as React from "react"
import { cn } from "cn"
import { ClipboardListIcon, ExternalLinkIcon } from "lucide-react"

import { AvailabilityBar } from "@/components/charts/availability-bar"
import { EmptyState } from "@/components/shared/empty-state"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { frameworkKey, frameworks } from "@/lib/readiness/frameworks"
import { applicabilityLabel } from "@/lib/readiness/labels"
import { isMet } from "@/lib/readiness/scoring"
import type {
  ControlEval,
  FrameworkDef,
  FrameworkId,
} from "@/lib/readiness/types"
import { ControlStatusBadge, scoreTone, useReadiness } from "./shared"

type ItemCoverage = "covered" | "partial" | "open" | "unmapped"

interface ItemRow {
  id: string
  title: string
  controls: ControlEval[]
  applicable: ControlEval[]
  /** Weighted average credit of applicable mapped controls, 0–100. */
  score: number
  coverage: ItemCoverage
}

function mapFramework(fw: FrameworkDef, controls: ControlEval[]) {
  const key = frameworkKey[fw.id]
  const known = new Set(fw.items.map((i) => i.id))
  const items: ItemRow[] = fw.items.map((item) => {
    const mapped = controls.filter((e) =>
      e.control.frameworks[key]?.includes(item.id)
    )
    const applicable = mapped.filter(
      (e) => e.applicability !== "not-applicable"
    )
    const weight = applicable.reduce((acc, e) => acc + e.weight, 0)
    const score =
      weight === 0
        ? 0
        : Math.round(
            (applicable.reduce((acc, e) => acc + e.weight * e.credit, 0) /
              weight) *
              100
          )
    const met = applicable.filter((e) => isMet(e.response.status)).length
    const coverage: ItemCoverage =
      mapped.length === 0
        ? "unmapped"
        : applicable.length === 0
          ? "unmapped"
          : met === applicable.length
            ? "covered"
            : met > 0
              ? "partial"
              : "open"
    return {
      id: item.id,
      title: item.title,
      controls: mapped,
      applicable,
      score,
      coverage,
    }
  })
  const unmapped = controls
    .map((e) => ({
      id: e.control.id,
      refs: (e.control.frameworks[key] ?? []).filter((r) => !known.has(r)),
    }))
    .filter((x) => x.refs.length > 0)
  return { items, unmapped }
}

export function FrameworksTab({ onOpen }: { onOpen: (id: string) => void }) {
  const { assessment, result } = useReadiness()
  const [active, setActive] = React.useState<FrameworkId>(frameworks[0].id)

  if (!assessment || !result) {
    return (
      <EmptyState
        icon={<ClipboardListIcon />}
        title="No assessment yet"
        description="Complete the Setup tab to profile your system; framework coverage is derived from your control answers."
      />
    )
  }

  return (
    <Tabs
      value={active}
      onValueChange={(v) => setActive(v as FrameworkId)}
      className="gap-4"
    >
      <TabsList variant="line" className="flex-wrap">
        {frameworks.map((fw) => (
          <TabsTrigger key={fw.id} value={fw.id}>
            {fw.short}
          </TabsTrigger>
        ))}
      </TabsList>
      {frameworks.map((fw) => (
        <TabsContent key={fw.id} value={fw.id}>
          <FrameworkPanel fw={fw} controls={result.controls} onOpen={onOpen} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function FrameworkPanel({
  fw,
  controls,
  onOpen,
}: {
  fw: FrameworkDef
  controls: ControlEval[]
  onOpen: (id: string) => void
}) {
  const { items, unmapped } = React.useMemo(
    () => mapFramework(fw, controls),
    [fw, controls]
  )
  const withControls = items.filter((i) => i.coverage !== "unmapped").length
  const covered = items.filter((i) => i.coverage === "covered").length
  const partial = items.filter((i) => i.coverage === "partial").length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold tracking-tight">{fw.name}</h3>
          <p className="text-xs text-muted-foreground">
            <Stat value={withControls} total={items.length} /> items have at
            least one applicable control ·{" "}
            <Stat value={covered} tone="success" /> fully covered ·{" "}
            <Stat value={partial} tone="warning" /> partial ·{" "}
            <Stat value={items.length - withControls} /> with no control mapped
          </p>
        </div>
        <a
          href={fw.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline print:hidden"
        >
          Reference <ExternalLinkIcon className="size-3" />
        </a>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="bg-muted/40 text-xs font-medium text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th className="pl-4">Item</th>
              <th className="w-40">Coverage</th>
              <th className="pr-4">Mapped controls</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id} className="align-top hover:bg-muted/30">
                <td className="max-w-xs px-3 py-2.5 pl-4">
                  <div className="flex flex-col gap-0.5 leading-tight">
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.id}
                    </span>
                    <span className="font-medium">{item.title}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {item.coverage === "unmapped" ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <AvailabilityBar
                      size="sm"
                      value={item.score}
                      tone={scoreTone(item.score)}
                      label={coverageLabel[item.coverage]}
                      valueLabel={`${item.score}`}
                      className="w-36"
                    />
                  )}
                </td>
                <td className="px-3 py-2.5 pr-4">
                  {item.controls.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">
                      No control mapped
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {item.controls.map((e) => (
                        <ControlChip
                          key={e.control.id}
                          eval={e}
                          onOpen={onOpen}
                        />
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {unmapped.length === 0 ? (
          <>
            All {fw.short} references in the control set resolve to a listed
            item.
          </>
        ) : (
          <>
            <span className="font-medium text-warning-text">
              Unmapped references:
            </span>{" "}
            {unmapped.map((u, i) => (
              <React.Fragment key={u.id}>
                {i > 0 && ", "}
                <button
                  type="button"
                  onClick={() => onOpen(u.id)}
                  className="font-mono underline-offset-4 hover:underline"
                >
                  {u.id}
                </button>{" "}
                <span className="font-mono">({u.refs.join(", ")})</span>
              </React.Fragment>
            ))}{" "}
            — these ids are not in the {fw.short} item list. Check the control
            set for typos or a framework version mismatch.
          </>
        )}
      </p>
    </div>
  )
}

const coverageLabel: Record<Exclude<ItemCoverage, "unmapped">, string> = {
  covered: "Covered",
  partial: "Partial",
  open: "Open",
}

function Stat({
  value,
  total,
  tone,
}: {
  value: number
  total?: number
  tone?: "success" | "warning"
}) {
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        tone === "success" && value > 0
          ? "text-success-text"
          : tone === "warning" && value > 0
            ? "text-warning-text"
            : "text-foreground"
      )}
    >
      {value}
      {total !== undefined && (
        <span className="font-normal text-muted-foreground">/{total}</span>
      )}
    </span>
  )
}

function ControlChip({
  eval: e,
  onOpen,
}: {
  eval: ControlEval
  onOpen: (id: string) => void
}) {
  const na = e.applicability === "not-applicable"
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => onOpen(e.control.id)}
            className={cn(
              "inline-flex h-6 items-center gap-1.5 rounded-md border bg-card pr-0.5 pl-1.5 text-xs transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              na && "opacity-50 hover:opacity-80"
            )}
          />
        }
      >
        <span className="font-mono">{e.control.id}</span>
        <ControlStatusBadge status={e.response.status} size="sm" />
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-medium">{e.control.title}</span>
        {na && (
          <span className="text-muted-foreground">
            {" "}
            · {applicabilityLabel[e.applicability]}
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
