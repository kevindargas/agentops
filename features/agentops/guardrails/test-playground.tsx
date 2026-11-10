"use client"

import * as React from "react"
import { cn } from "cn"
import {
  CheckIcon,
  EraserIcon,
  PlayIcon,
  ScanSearchIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { deployedAgents } from "@/lib/data"
import {
  evaluateGuardrails,
  guardrailAppliesTo,
  guardrailPresets,
  locallyEvaluable,
  type Guardrail,
  type GuardrailEvaluation,
} from "@/lib/data/guardrails"
import { ActionBadge, CategoryBadge, EngineCell, ModeBadge } from "./shared"

const ALL = "all"

interface RunResult {
  text: string
  scope: string
  tripped: GuardrailEvaluation[]
  checked: Guardrail[]
  skipped: Guardrail[]
}

export function TestPlayground({
  policies,
  onOpenPolicy,
}: {
  policies: Guardrail[]
  onOpenPolicy: (id: string) => void
}) {
  const [text, setText] = React.useState(guardrailPresets[0].text)
  const [preset, setPreset] = React.useState<string | null>(
    guardrailPresets[0].id
  )
  const [scope, setScope] = React.useState<string>(ALL)
  const [result, setResult] = React.useState<RunResult | null>(null)

  const agentItems = [
    { value: ALL, label: "All agents (fleet policies)" },
    ...deployedAgents.map((a) => ({ value: a.id, label: a.name })),
  ]

  const run = () => {
    const inScope = policies.filter(
      (g) =>
        g.status === "Active" && (scope === ALL || guardrailAppliesTo(g, scope))
    )
    const tripped = evaluateGuardrails(text, scope, policies)
    setResult({
      text,
      scope,
      tripped,
      checked: inScope.filter((g) => locallyEvaluable.has(g.id)),
      skipped: inScope.filter((g) => !locallyEvaluable.has(g.id)),
    })
  }

  const stale =
    result !== null && (result.text !== text || result.scope !== scope)
  const blocked = result?.tripped.some((t) => t.action === "Blocked") ?? false

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Input */}
      <div className="flex flex-col gap-5">
        <Field>
          <FieldLabel>Sample payloads</FieldLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            {guardrailPresets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPreset(p.id)
                  setText(p.text)
                }}
                aria-pressed={preset === p.id}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  preset === p.id && "border-brand/40 bg-brand/5"
                )}
              >
                <span className="text-sm font-medium">{p.label}</span>
                <span className="text-xs text-muted-foreground">
                  {p.description}
                </span>
              </button>
            ))}
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="guardrail-sample">
            Input or output text
          </FieldLabel>
          <Textarea
            id="guardrail-sample"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setPreset(null)
            }}
            rows={7}
            placeholder="Paste a user message, a draft answer or a tool call…"
            className="min-h-40 font-mono text-xs leading-relaxed"
          />
          <FieldDescription className="flex items-center justify-between tabular-nums">
            <span>≈ {Math.ceil(text.length / 4).toLocaleString()} tokens</span>
            <span>{text.length.toLocaleString()} characters</span>
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="guardrail-scope">Evaluate as</FieldLabel>
          <Select
            value={scope}
            onValueChange={(v) => v && setScope(v)}
            items={agentItems}
          >
            <SelectTrigger id="guardrail-scope" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {agentItems.map((it) => (
                <SelectItem key={it.value} value={it.value}>
                  {it.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Only active policies whose scope includes the agent are checked.
          </FieldDescription>
        </Field>

        <div className="flex items-center gap-2">
          <Button onClick={run} disabled={text.trim().length === 0}>
            <PlayIcon /> Run guardrails
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setText("")
              setPreset(null)
              setResult(null)
            }}
            disabled={text.length === 0 && result === null}
          >
            <EraserIcon /> Clear
          </Button>
          {stale && (
            <span className="ml-auto text-xs text-muted-foreground">
              Input changed — run again.
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex min-w-0 flex-col gap-3">
        {result === null ? (
          <EmptyState
            icon={<ScanSearchIcon />}
            title="No run yet"
            description="Pick a sample payload or paste your own text, choose the agent to evaluate as, then run the guardrails. Evaluation happens locally with the same regex, keyword and pattern rules the policies describe."
            className="h-full"
          />
        ) : (
          <>
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg border p-4",
                result.tripped.length === 0
                  ? "border-success/30 bg-success/5"
                  : blocked
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-warning/40 bg-warning/5"
              )}
            >
              <span
                className={cn(
                  "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
                  result.tripped.length === 0
                    ? "bg-success/15 text-success-text"
                    : blocked
                      ? "bg-destructive/15 text-danger-text"
                      : "bg-warning/20 text-warning-text"
                )}
              >
                {result.tripped.length === 0 ? (
                  <ShieldCheckIcon className="size-5" />
                ) : (
                  <ShieldAlertIcon className="size-5" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {result.tripped.length === 0
                    ? "Passed every guardrail"
                    : blocked
                      ? "Request would be blocked"
                      : `${result.tripped.length} polic${result.tripped.length === 1 ? "y" : "ies"} tripped`}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {result.checked.length} checked · {result.tripped.length}{" "}
                  tripped · {result.skipped.length} not evaluable offline
                </p>
              </div>
              {stale && (
                <Badge
                  variant="outline"
                  className="ml-auto text-muted-foreground"
                >
                  stale
                </Badge>
              )}
            </div>

            {result.tripped.length > 0 && (
              <ul className="flex flex-col gap-2">
                {result.tripped.map((t) => (
                  <li
                    key={t.policy.id}
                    className="flex flex-col gap-2 rounded-lg border bg-card p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryBadge category={t.policy.category} />
                      <ActionBadge action={t.action} />
                      <button
                        type="button"
                        onClick={() => onOpenPolicy(t.policy.id)}
                        className="ml-auto text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        Open policy
                      </button>
                    </div>
                    <h4 className="text-sm font-semibold">{t.policy.name}</h4>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t.explanation}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {t.matches.map((m, i) => (
                        <Badge
                          key={`${m}-${i}`}
                          variant="outline"
                          className="h-5 max-w-full px-1.5 font-mono text-[11px] text-muted-foreground"
                        >
                          <span className="truncate">{m}</span>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                      <EngineCell policy={t.policy} className="text-xs" />
                      <span className="inline-flex items-center gap-1.5">
                        Mode <ModeBadge mode={t.policy.mode} size="sm" />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <PassedList
              title="Passed"
              icon={<CheckIcon className="size-3.5 text-success-text" />}
              items={result.checked.filter(
                (g) => !result.tripped.some((t) => t.policy.id === g.id)
              )}
            />
            <PassedList
              title="Not evaluable offline"
              hint="Spend, rate, retention and schema checks need the live run context."
              items={result.skipped}
              muted
            />
          </>
        )}
      </div>
    </div>
  )
}

function PassedList({
  title,
  hint,
  icon,
  items,
  muted = false,
}: {
  title: string
  hint?: string
  icon?: React.ReactNode
  items: Guardrail[]
  muted?: boolean
}) {
  if (items.length === 0) return null
  return (
    <details className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm select-none">
        {icon}
        <span className={cn("font-medium", muted && "text-muted-foreground")}>
          {title}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {items.length}
        </span>
        {hint && (
          <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
            {hint}
          </span>
        )}
      </summary>
      <ul className="flex flex-wrap gap-1.5 border-t px-4 py-3">
        {items.map((g) => (
          <li key={g.id}>
            <Badge
              variant="outline"
              className={cn(
                "h-6 px-2 text-xs",
                muted && "text-muted-foreground"
              )}
            >
              {g.name}
            </Badge>
          </li>
        ))}
      </ul>
    </details>
  )
}
