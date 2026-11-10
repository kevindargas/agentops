"use client"

import { BracesIcon, SlidersHorizontalIcon } from "lucide-react"

import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  estimateTokens,
  getPromptVariables,
  type Prompt,
  type PromptVersion,
} from "@/lib/data/prompts"
import { formatNumber } from "@/lib/format"
import {
  LabelBadge,
  ParamsGrid,
  TemplateView,
  VariableChip,
  versionSelectItems,
} from "./shared"

export function EditorTab({
  prompt,
  versions,
  versionId,
  onVersionChange,
}: {
  prompt: Prompt
  versions: PromptVersion[]
  versionId: string
  onVersionChange: (id: string) => void
}) {
  const version = versions.find((v) => v.id === versionId) ?? versions.at(-1)
  if (!version)
    return (
      <EmptyState
        size="sm"
        title="No versions yet"
        description="Use New version in the header to draft the first template."
      />
    )
  const variables = getPromptVariables(prompt, version)
  const lines = version.template.split("\n").length
  const items = versionSelectItems(versions)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border">
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
          <Select
            value={version.id}
            onValueChange={(v) => v && onVersionChange(v)}
            items={items}
          >
            <SelectTrigger size="sm" className="w-44" aria-label="Version">
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
          <LabelBadge label={version.label} size="sm" />
          <span className="ml-auto font-mono text-2xs text-muted-foreground tabular-nums">
            ~{formatNumber(estimateTokens(version.template))} tokens · {lines}{" "}
            lines · {formatNumber(version.template.length)} chars
          </span>
        </div>
        <TemplateView
          template={version.template}
          className="max-h-[36rem] overflow-y-auto px-4 py-3"
        />
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          Read-only. Edit by creating a new version so every change stays
          attributable and evaluable.
        </p>
      </section>

      <aside className="flex min-w-0 flex-col gap-4">
        <section className="rounded-lg border">
          <h3 className="flex items-center gap-1.5 border-b px-3 py-2 text-sm font-semibold">
            <BracesIcon className="size-3.5 text-muted-foreground" />
            Variables
            <CountPill count={variables.length} className="ml-auto" />
          </h3>
          {variables.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              This template has no runtime variables.
            </p>
          ) : (
            <ul className="divide-y">
              {variables.map((v) => (
                <li key={v.name} className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <VariableChip name={v.name} className="text-2xs" />
                    {!v.required && (
                      <span className="text-2xs text-muted-foreground">
                        optional
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">
                    {v.description}
                  </p>
                  <p className="mt-1 truncate font-mono text-2xs">
                    <span className="text-muted-foreground">e.g. </span>
                    {v.example}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border">
          <h3 className="flex items-center gap-1.5 border-b px-3 py-2 text-sm font-semibold">
            <SlidersHorizontalIcon className="size-3.5 text-muted-foreground" />
            Model parameters
          </h3>
          <ParamsGrid
            params={version.params}
            modelId={version.modelId}
            className="px-3 py-3"
          />
        </section>
      </aside>
    </div>
  )
}
