"use client"

import * as React from "react"
import { cn } from "cn"
import { ChevronDownIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  reasoningEffortOptions,
  sampleJsonSchema,
  toolChoiceOptions,
} from "@/lib/data/playground"
import type { ModelParams, ReasoningEffort } from "@/lib/types"

export interface ParamEditorProps {
  value: ModelParams
  onChange: (next: ModelParams) => void
  /** Deployed values; fields that differ get a "changed" marker. */
  baseline?: ModelParams
  /** Visual density. `compact` is for narrow side panels. */
  density?: "default" | "compact"
  className?: string
}

/**
 * Full `ModelParams` editor shared by the playground configuration panel and
 * the agent configuration sheet. Fully controlled; every change goes through
 * `onChange` so callers can diff against a baseline.
 */
export function ParamEditor({
  value,
  onChange,
  baseline,
  density = "default",
  className,
}: ParamEditorProps) {
  const id = React.useId()
  const patch = <K extends keyof ModelParams>(key: K, v: ModelParams[K]) =>
    onChange({ ...value, [key]: v })
  const changed = (key: keyof ModelParams) =>
    baseline !== undefined &&
    JSON.stringify(value[key]) !== JSON.stringify(baseline[key])

  const compact = density === "compact"

  return (
    <div
      className={cn("flex flex-col", compact ? "gap-4" : "gap-5", className)}
    >
      <SliderField
        id={`${id}-temp`}
        label="Temperature"
        hint="0 = deterministic · 2 = very creative"
        value={value.temperature}
        min={0}
        max={2}
        step={0.1}
        digits={1}
        changed={changed("temperature")}
        onChange={(v) => patch("temperature", v)}
      />
      <SliderField
        id={`${id}-topp`}
        label="Top P"
        hint="Nucleus sampling cut-off"
        value={value.topP}
        min={0}
        max={1}
        step={0.01}
        digits={2}
        changed={changed("topP")}
        onChange={(v) => patch("topP", v)}
      />

      <div
        className={cn(
          "grid gap-3",
          compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
        )}
      >
        <NumberField
          id={`${id}-max`}
          label="Max output tokens"
          value={value.maxOutputTokens}
          min={1}
          max={128_000}
          step={64}
          changed={changed("maxOutputTokens")}
          onChange={(v) => patch("maxOutputTokens", v ?? value.maxOutputTokens)}
        />
        <NumberField
          id={`${id}-timeout`}
          label="Timeout (s)"
          value={Math.round(value.timeoutMs / 1000)}
          min={1}
          max={600}
          changed={changed("timeoutMs")}
          onChange={(v) => v !== undefined && patch("timeoutMs", v * 1000)}
        />
        <NumberField
          id={`${id}-seed`}
          label="Seed"
          value={value.seed}
          optional
          min={0}
          changed={changed("seed")}
          onChange={(v) => patch("seed", v)}
        />
        <NumberField
          id={`${id}-tools`}
          label="Max tool calls"
          value={value.maxToolCalls}
          min={0}
          max={50}
          changed={changed("maxToolCalls")}
          onChange={(v) => patch("maxToolCalls", v ?? value.maxToolCalls)}
        />
        <NumberField
          id={`${id}-retries`}
          label="Max retries"
          value={value.maxRetries}
          min={0}
          max={10}
          changed={changed("maxRetries")}
          onChange={(v) => patch("maxRetries", v ?? value.maxRetries)}
        />
        <NumberField
          id={`${id}-freq`}
          label="Frequency penalty"
          value={value.frequencyPenalty}
          optional
          min={-2}
          max={2}
          step={0.1}
          digits={1}
          changed={changed("frequencyPenalty")}
          onChange={(v) => patch("frequencyPenalty", v)}
        />
        <NumberField
          id={`${id}-presence`}
          label="Presence penalty"
          value={value.presencePenalty}
          optional
          min={-2}
          max={2}
          step={0.1}
          digits={1}
          changed={changed("presencePenalty")}
          onChange={(v) => patch("presencePenalty", v)}
        />
      </div>

      <SegmentField
        label="Reasoning effort"
        changed={changed("reasoningEffort")}
        value={value.reasoningEffort}
        options={reasoningEffortOptions}
        onChange={(v) => patch("reasoningEffort", v as ReasoningEffort)}
      />

      <SegmentField
        label="Tool choice"
        changed={changed("toolChoice")}
        value={value.toolChoice}
        options={toolChoiceOptions}
        onChange={(v) => patch("toolChoice", v as ModelParams["toolChoice"])}
      />

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Label
            htmlFor={`${id}-parallel`}
            className="flex items-center gap-1.5 text-xs font-medium"
          >
            Parallel tool calls
            {changed("parallelToolCalls") && <ChangedDot />}
          </Label>
          <p className="text-2xs text-muted-foreground">
            Let the model issue several calls in one turn
          </p>
        </div>
        <Switch
          id={`${id}-parallel`}
          size="sm"
          checked={value.parallelToolCalls}
          onCheckedChange={(c) => patch("parallelToolCalls", c)}
          disabled={value.toolChoice === "none"}
        />
      </div>

      <div className="flex flex-col gap-2">
        <SegmentField
          label="Response format"
          changed={changed("responseFormat")}
          value={value.responseFormat}
          options={["text", "json_schema"] as const}
          labels={{ text: "Text", json_schema: "JSON schema" }}
          onChange={(v) =>
            patch("responseFormat", v as ModelParams["responseFormat"])
          }
        />
        {value.responseFormat === "json_schema" && (
          <SchemaEditor id={`${id}-schema`} />
        )}
      </div>

      <StopSequences
        id={`${id}-stop`}
        value={value.stopSequences}
        changed={changed("stopSequences")}
        onChange={(v) => patch("stopSequences", v)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Fields                                                                    */
/* ------------------------------------------------------------------------ */

function ChangedDot() {
  return (
    <span
      className="inline-block size-1.5 rounded-full bg-brand"
      title="Differs from deployed"
    >
      <span className="sr-only">changed from deployed</span>
    </span>
  )
}

function FieldLabel({
  id,
  htmlFor,
  children,
  changed,
  className,
}: {
  id?: string
  htmlFor?: string
  children: React.ReactNode
  changed?: boolean
  className?: string
}) {
  return (
    <Label
      id={id}
      htmlFor={htmlFor}
      className={cn("flex items-center gap-1.5 text-xs font-medium", className)}
    >
      {children}
      {changed && <ChangedDot />}
    </Label>
  )
}

function SliderField({
  id,
  label,
  hint,
  value,
  min,
  max,
  step,
  digits,
  changed,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step: number
  digits: number
  changed?: boolean
  onChange: (v: number) => void
}) {
  const clamp = (n: number) =>
    Math.min(max, Math.max(min, Number(n.toFixed(digits))))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel id={`${id}-label`} htmlFor={id} changed={changed}>
          {label}
        </FieldLabel>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(clamp(n))
          }}
          className="h-7 w-20 text-right font-mono text-xs tabular-nums"
        />
      </div>
      <Slider
        aria-labelledby={`${id}-label`}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => {
          const n = Array.isArray(v) ? v[0] : v
          onChange(clamp(n))
        }}
      />
      {hint && (
        <p className="text-2xs text-muted-foreground tabular-nums">{hint}</p>
      )}
    </div>
  )
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step,
  digits = 0,
  optional,
  changed,
  onChange,
}: {
  id: string
  label: string
  value: number | undefined
  min?: number
  max?: number
  step?: number
  /** Decimal places kept; 0 rounds to an integer. */
  digits?: number
  optional?: boolean
  changed?: boolean
  onChange: (v: number | undefined) => void
}) {
  const factor = 10 ** digits
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <FieldLabel htmlFor={id} changed={changed}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        type="number"
        inputMode={digits > 0 ? "decimal" : "numeric"}
        min={min}
        max={max}
        step={step}
        placeholder={optional ? "none" : undefined}
        value={value === undefined ? "" : value}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === "") {
            if (optional) onChange(undefined)
            return
          }
          let n = Number(raw)
          if (!Number.isFinite(n)) return
          if (min !== undefined) n = Math.max(min, n)
          if (max !== undefined) n = Math.min(max, n)
          onChange(Math.round(n * factor) / factor)
        }}
        className="h-7 font-mono text-xs tabular-nums"
      />
    </div>
  )
}

function SegmentField<T extends string>({
  label,
  value,
  options,
  labels,
  changed,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  labels?: Partial<Record<T, string>>
  changed?: boolean
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel changed={changed}>{label}</FieldLabel>
      <ToggleGroup
        multiple={false}
        value={[value]}
        onValueChange={(v) => v[0] && onChange(v[0] as T)}
        variant="outline"
        spacing={0}
        aria-label={label}
        className="w-full"
      >
        {options.map((o) => (
          <ToggleGroupItem
            key={o}
            value={o}
            size="sm"
            className="flex-1 px-2 text-xs capitalize data-pressed:bg-muted data-pressed:font-medium"
          >
            {labels?.[o] ?? o}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

function SchemaEditor({ id }: { id: string }) {
  const [schema, setSchema] = React.useState(sampleJsonSchema)
  const valid = React.useMemo(() => {
    try {
      JSON.parse(schema)
      return true
    } catch {
      return false
    }
  }, [schema])
  return (
    <Collapsible defaultOpen={false} className="group/schema rounded-lg border">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50">
        <span className="flex items-center gap-2">
          JSON schema
          <Badge
            variant="outline"
            className={cn(
              "h-4 px-1.5 text-3xs",
              valid
                ? "border-success/30 text-success-text"
                : "border-destructive/40 text-danger-text"
            )}
          >
            {valid ? "valid" : "invalid JSON"}
          </Badge>
        </span>
        <ChevronDownIcon className="size-3.5 text-muted-foreground transition-transform group-data-[panel-open]/schema:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t p-2">
        <Label htmlFor={id} className="sr-only">
          JSON schema
        </Label>
        <Textarea
          id={id}
          value={schema}
          onChange={(e) => setSchema(e.target.value)}
          spellCheck={false}
          rows={8}
          className="min-h-32 resize-y font-mono text-2xs leading-relaxed"
        />
      </CollapsibleContent>
    </Collapsible>
  )
}

function StopSequences({
  id,
  value,
  changed,
  onChange,
}: {
  id: string
  value: string[]
  changed?: boolean
  onChange: (v: string[]) => void
}) {
  const [draft, setDraft] = React.useState("")
  const add = () => {
    const s = draft.trim()
    if (!s) return
    if (!value.includes(s)) onChange([...value, s])
    setDraft("")
  }
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id} changed={changed}>
        Stop sequences
      </FieldLabel>
      <div className="flex min-h-7 flex-wrap items-center gap-1 rounded-lg border border-input px-1.5 py-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        {value.map((s) => (
          <Badge
            key={s}
            variant="secondary"
            className="h-5 gap-1 pr-0.5 pl-1.5 font-mono text-2xs"
          >
            {s}
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-4 rounded-sm hover:bg-foreground/10"
              aria-label={`Remove stop sequence ${s}`}
              onClick={() => onChange(value.filter((x) => x !== s))}
            >
              <XIcon className="size-2.5" />
            </Button>
          </Badge>
        ))}
        <input
          id={id}
          value={draft}
          placeholder={value.length ? "Add" : "Type and press Enter"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              add()
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
          onBlur={add}
          className="h-5 min-w-16 flex-1 bg-transparent px-1 font-mono text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  )
}
