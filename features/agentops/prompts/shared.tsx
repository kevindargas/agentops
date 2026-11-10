import { cn } from "cn"

import { Eyebrow } from "@/components/shared/eyebrow"
import {
  StateBadge,
  type BadgeSize,
  type Tone,
} from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import {
  promptTypeLabel,
  type PromptLabel,
  type PromptType,
  type PromptVersion,
} from "@/lib/data/prompts"
import type { ModelParams, ReasoningEffort } from "@/lib/types"
import { ModelChip } from "../shared"

/**
 * `production` and `staging` already have tones in status-badge; `draft` and
 * `archived` are passed explicitly so the four labels read as one family.
 */
const labelTone: Record<PromptLabel, Tone> = {
  production: "success",
  staging: "info",
  draft: "muted",
  archived: "muted",
}

export function LabelBadge({
  label,
  size = "default",
  className,
}: {
  label: PromptLabel
  size?: BadgeSize
  className?: string
}) {
  return (
    <StateBadge
      state={label}
      tone={labelTone[label]}
      size={size}
      className={className}
    />
  )
}

export function TypeBadge({
  type,
  className,
}: {
  type: PromptType
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-normal text-muted-foreground", className)}
    >
      {promptTypeLabel[type]}
    </Badge>
  )
}

export function VersionTag({
  version,
  className,
}: {
  version: Pick<PromptVersion, "number">
  className?: string
}) {
  return (
    <code
      className={cn(
        "rounded-sm bg-muted px-1 py-0.5 font-mono text-2xs tabular-nums",
        className
      )}
    >
      v{version.number}
    </code>
  )
}

/* ------------------------------------------------------------------------ */
/* Template rendering                                                        */
/* ------------------------------------------------------------------------ */

const SPLIT_RE = /(\{\{\s*[A-Za-z_][\w.]*\s*\}\})/g

export function VariableChip({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "rounded-sm border border-brand/25 bg-brand/10 px-1 font-mono text-[0.92em] text-brand",
        className
      )}
    >
      {`{{${name}}}`}
    </span>
  )
}

/** Prompt text with `{{variables}}` rendered as chips. */
export function TemplateView({
  template,
  className,
}: {
  template: string
  className?: string
}) {
  const parts = template.split(SPLIT_RE)
  return (
    <pre
      className={cn(
        "font-mono text-xs leading-relaxed break-words whitespace-pre-wrap",
        className
      )}
    >
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <VariableChip key={i} name={part.replace(/^\{\{\s*|\s*\}\}$/g, "")} />
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </pre>
  )
}

/* ------------------------------------------------------------------------ */
/* Model parameters                                                          */
/* ------------------------------------------------------------------------ */

const reasoningLabel: Record<ReasoningEffort, string> = {
  none: "Off",
  low: "Low",
  medium: "Medium",
  high: "High",
}

const toolChoiceLabel: Record<ModelParams["toolChoice"], string> = {
  auto: "Auto",
  required: "Required",
  none: "None",
}

const responseFormatLabel: Record<ModelParams["responseFormat"], string> = {
  text: "Text",
  json_schema: "JSON schema",
}

const optionalNumber = (v: number | undefined, digits = 1) =>
  v === undefined ? (
    <span className="text-muted-foreground">None</span>
  ) : (
    v.toFixed(digits)
  )

/** One-line summary for dense table cells. */
export function paramsSummary(p: ModelParams) {
  return `t ${p.temperature.toFixed(1)} · top_p ${p.topP} · ${p.maxOutputTokens.toLocaleString("en-US")} tok · ${reasoningLabel[p.reasoningEffort].toLowerCase()} reasoning`
}

/** Every `ModelParams` field as a label/value grid, read-only. */
export function ParamsGrid({
  params: p,
  modelId,
  className,
}: {
  params: ModelParams
  modelId?: string
  className?: string
}) {
  const items: { label: string; value: React.ReactNode }[] = [
    ...(modelId
      ? [
          {
            label: "Model",
            value: <ModelChip modelId={modelId} className="text-xs" />,
          },
        ]
      : []),
    { label: "Temperature", value: p.temperature.toFixed(1) },
    { label: "Top P", value: p.topP.toFixed(2) },
    {
      label: "Max output tokens",
      value: p.maxOutputTokens.toLocaleString("en-US"),
    },
    { label: "Reasoning effort", value: reasoningLabel[p.reasoningEffort] },
    { label: "Tool choice", value: toolChoiceLabel[p.toolChoice] },
    { label: "Parallel tool calls", value: p.parallelToolCalls ? "On" : "Off" },
    {
      label: "Stop sequences",
      value: p.stopSequences.length ? (
        <span className="flex flex-wrap gap-1">
          {p.stopSequences.map((s) => (
            <code
              key={s}
              className="rounded-sm bg-muted px-1 font-mono text-2xs"
            >
              {s}
            </code>
          ))}
        </span>
      ) : (
        <span className="text-muted-foreground">None</span>
      ),
    },
    { label: "Response format", value: responseFormatLabel[p.responseFormat] },
    { label: "Seed", value: optionalNumber(p.seed, 0) },
    { label: "Frequency penalty", value: optionalNumber(p.frequencyPenalty) },
    { label: "Presence penalty", value: optionalNumber(p.presencePenalty) },
    { label: "Timeout", value: `${(p.timeoutMs / 1000).toFixed(0)} s` },
    { label: "Tool-call budget", value: p.maxToolCalls },
    { label: "Max retries", value: p.maxRetries },
  ]
  return (
    <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-3", className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <Eyebrow as="span">{it.label}</Eyebrow>
          <dd className="mt-0.5 truncate text-sm font-medium tabular-nums">
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** `{ value, label }` items for a version <Select />, newest first. */
export function versionSelectItems(versions: PromptVersion[]) {
  return [...versions].reverse().map((v) => ({
    value: v.id,
    label: `v${v.number} · ${v.label}`,
  }))
}
