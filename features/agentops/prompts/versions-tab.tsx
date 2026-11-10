"use client"

import { cn } from "cn"
import { GitCompareIcon, RocketIcon, Undo2Icon } from "lucide-react"

import { DateCell } from "@/components/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import { Button } from "@/components/ui/button"
import type { PromptVersion } from "@/lib/data/prompts"
import { ModelChip, scoreTone } from "../shared"
import { LabelBadge, paramsSummary, VersionTag } from "./shared"

const toneText = {
  success: "text-success-text",
  warning: "text-warning-text",
  danger: "text-danger-text",
} as const

/** Eval score of the closest earlier version that has one. */
function previousScore(versions: PromptVersion[], idx: number) {
  for (let i = idx - 1; i >= 0; i--) {
    const s = versions[i].evalScore
    if (s !== null) return s
  }
  return null
}

export function VersionsTab({
  versions,
  onPromote,
  onRollback,
  onCompare,
}: {
  /** Ascending by version number. */
  versions: PromptVersion[]
  onPromote: (v: PromptVersion) => void
  onRollback: (v: PromptVersion) => void
  onCompare: (v: PromptVersion) => void
}) {
  if (versions.length === 0)
    return <EmptyState size="sm" title="No versions yet" />

  const rows = versions
    .map((v, i) => ({ v, prev: previousScore(versions, i) }))
    .reverse()

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[56rem] text-sm">
        <thead className="bg-muted/40 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Version</th>
            <th className="px-3 py-2 text-left font-medium">Change</th>
            <th className="px-3 py-2 text-right font-medium">Eval</th>
            <th className="px-3 py-2 text-left font-medium">Model</th>
            <th className="px-3 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(({ v, prev }) => {
            const delta =
              v.evalScore !== null && prev !== null ? v.evalScore - prev : null
            return (
              <tr
                key={v.id}
                className={cn(
                  "align-top",
                  v.label === "archived" && "text-muted-foreground"
                )}
              >
                <td className="w-44 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <VersionTag version={v} className="text-xs" />
                    <LabelBadge label={v.label} size="sm" />
                  </div>
                  {v.review === "Pending Approval" && (
                    <StateBadge state={v.review} size="sm" className="mt-1.5" />
                  )}
                  <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                    {v.id}
                  </p>
                </td>
                <td className="min-w-72 px-3 py-3">
                  <p className="leading-snug">{v.changeNote}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <UserChip userId={v.authorId} size="xs" />
                    <span aria-hidden>·</span>
                    <DateCell value={v.createdAt} mode="datetime" />
                  </div>
                </td>
                <td className="w-28 px-3 py-3 text-right tabular-nums">
                  {v.evalScore === null ? (
                    <span className="text-xs text-muted-foreground">
                      Not run
                    </span>
                  ) : (
                    <>
                      <span
                        className={cn(
                          "font-medium",
                          toneText[scoreTone(v.evalScore)]
                        )}
                      >
                        {v.evalScore.toFixed(1)}
                      </span>
                      {delta !== null && (
                        <span
                          className={cn(
                            "block text-[11px]",
                            delta > 0
                              ? "text-success-text"
                              : delta < 0
                                ? "text-danger-text"
                                : "text-muted-foreground"
                          )}
                        >
                          {delta > 0 ? "+" : delta < 0 ? "−" : "±"}
                          {Math.abs(delta).toFixed(1)} vs prev
                        </span>
                      )}
                    </>
                  )}
                </td>
                <td className="w-64 px-3 py-3">
                  <ModelChip modelId={v.modelId} className="text-xs" />
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {paramsSummary(v.params)}
                  </p>
                </td>
                <td className="w-56 px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => onCompare(v)}
                    >
                      <GitCompareIcon /> Compare
                    </Button>
                    {v.label === "production" ? null : v.label ===
                      "archived" ? (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => onRollback(v)}
                      >
                        <Undo2Icon /> Rollback
                      </Button>
                    ) : (
                      <Button size="xs" onClick={() => onPromote(v)}>
                        <RocketIcon /> Promote
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
