"use client"

import * as React from "react"
import { cn } from "cn"
import { ArrowRightIcon, EqualIcon } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { toneClasses } from "@/components/shared/status-badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { PromptVersion } from "@/lib/data/prompts"
import { diffLines, diffStats, toSideBySide, type DiffOpType } from "./diff"
import { LabelBadge, versionSelectItems } from "./shared"

type Mode = "unified" | "split"

const rowTone: Record<DiffOpType, string> = {
  equal: "",
  add: toneClasses.success.soft,
  remove: toneClasses.danger.soft,
}
const marker: Record<DiffOpType, string> = { equal: " ", add: "+", remove: "−" }

export function DiffTab({
  versions,
  fromId,
  toId,
  onChange,
}: {
  /** Ascending by version number. */
  versions: PromptVersion[]
  fromId: string
  toId: string
  onChange: (fromId: string, toId: string) => void
}) {
  const [mode, setMode] = React.useState<Mode>("split")
  const from = versions.find((v) => v.id === fromId)
  const to = versions.find((v) => v.id === toId)
  const items = versionSelectItems(versions)

  if (versions.length < 2)
    return (
      <EmptyState
        size="sm"
        title="Nothing to compare"
        description="Create a second version to see what changed."
      />
    )
  if (!from || !to) return null

  const ops = diffLines(from.template, to.template)
  const stats = diffStats(ops)
  const same = stats.added === 0 && stats.removed === 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <VersionPicker
          label="From"
          value={from.id}
          items={items}
          onChange={(v) => onChange(v, to.id)}
        />
        <ArrowRightIcon className="size-3.5 text-muted-foreground" />
        <VersionPicker
          label="To"
          value={to.id}
          items={items}
          onChange={(v) => onChange(from.id, v)}
        />
        <span className="ml-1 flex items-center gap-2 font-mono text-xs tabular-nums">
          <span className={toneClasses.success.text}>+{stats.added}</span>
          <span className={toneClasses.danger.text}>−{stats.removed}</span>
          <span className="text-muted-foreground">
            {stats.unchanged} unchanged
          </span>
        </span>
        <ToggleGroup
          value={[mode]}
          onValueChange={(v) => v[0] && setMode(v[0] as Mode)}
          aria-label="Diff layout"
          className="ml-auto"
        >
          <ToggleGroupItem value="split" size="sm" className="text-xs">
            Side by side
          </ToggleGroupItem>
          <ToggleGroupItem value="unified" size="sm" className="text-xs">
            Unified
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {same ? (
        <EmptyState
          size="sm"
          icon={<EqualIcon />}
          title="No differences"
          description={
            from.id === to.id
              ? "Pick two different versions to compare."
              : "The templates are identical; only metadata or parameters changed."
          }
        />
      ) : mode === "unified" ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full font-mono text-xs leading-relaxed">
            <tbody>
              {ops.map((op, i) => (
                <tr key={i} className={rowTone[op.type]}>
                  <td className="w-10 px-2 text-right text-muted-foreground/70 tabular-nums select-none">
                    {op.a ?? ""}
                  </td>
                  <td className="w-10 px-2 text-right text-muted-foreground/70 tabular-nums select-none">
                    {op.b ?? ""}
                  </td>
                  <td className="w-5 text-center text-muted-foreground select-none">
                    {marker[op.type]}
                  </td>
                  <td className="px-2 break-words whitespace-pre-wrap">
                    {op.line || " "}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <div className="grid min-w-[48rem] grid-cols-2 divide-x border-b bg-muted/40 text-xs">
            <Head version={from} />
            <Head version={to} />
          </div>
          <table className="w-full min-w-[48rem] table-fixed font-mono text-xs leading-relaxed">
            <tbody>
              {toSideBySide(ops).map((row, i) => (
                <tr key={i}>
                  <Cell side={row.left} />
                  <Cell side={row.right} border />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Head({ version }: { version: PromptVersion }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className="font-mono tabular-nums">v{version.number}</span>
      <LabelBadge label={version.label} size="sm" />
      <span className="truncate text-muted-foreground">
        {version.changeNote}
      </span>
    </div>
  )
}

function Cell({
  side,
  border,
}: {
  side?: { n: number; line: string; type: DiffOpType }
  border?: boolean
}) {
  return (
    <td
      className={cn(
        "w-1/2 align-top",
        border && "border-l",
        side ? rowTone[side.type] : "bg-muted/20"
      )}
    >
      {side && (
        <div className="flex">
          <span className="w-10 shrink-0 px-2 text-right text-muted-foreground/70 tabular-nums select-none">
            {side.n}
          </span>
          <span className="w-4 shrink-0 text-center text-muted-foreground select-none">
            {marker[side.type]}
          </span>
          <span className="min-w-0 flex-1 px-2 break-words whitespace-pre-wrap">
            {side.line || " "}
          </span>
        </div>
      )}
    </td>
  )
}

function VersionPicker({
  label,
  value,
  items,
  onChange,
}: {
  label: string
  value: string
  items: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)} items={items}>
      <SelectTrigger size="sm" className="w-48" aria-label={label}>
        <span className="text-muted-foreground">{label}</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {items.map((it) => (
          <SelectItem key={it.value} value={it.value}>
            {it.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
