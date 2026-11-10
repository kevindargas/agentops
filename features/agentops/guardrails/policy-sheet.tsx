"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  CopyIcon,
  DownloadIcon,
  HistoryIcon,
  PowerIcon,
  PowerOffIcon,
  RotateCcwIcon,
  RouteIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { toast } from "sonner"

import { IncidentTrendChart } from "@/components/charts/incident-trend-chart"
import { CopyButton } from "@/components/shared/copy-button"
import { EmptyState } from "@/components/shared/empty-state"
import { StateBadge } from "@/components/shared/status-badge"
import { UserChip } from "@/components/shared/user-chip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import { daysAgo, deployedAgents } from "@/lib/data"
import type { Guardrail, GuardrailViolation } from "@/lib/data/guardrails"
import { formatDate, timeAgo } from "@/lib/format"
import { AgentChip } from "../shared"
import {
  ActionBadge,
  CategoryBadge,
  EngineCell,
  fmtPct,
  ModeBadge,
  PolicyStatusBadge,
  scopeLabel,
} from "./shared"

export function PolicySheet({
  policy,
  violations,
  onClose,
  onPatch,
  onDuplicate,
}: {
  policy: Guardrail | null
  violations: GuardrailViolation[]
  onClose: () => void
  onPatch: (id: string, patch: Partial<Guardrail>) => void
  onDuplicate: (id: string) => void
}) {
  return (
    <Sheet open={policy !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {policy && (
          <PolicyBody
            key={policy.id}
            policy={policy}
            violations={violations.filter((v) => v.policyId === policy.id)}
            onPatch={onPatch}
            onDuplicate={onDuplicate}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function fmtConfigValue(v: string | number | boolean | string[]) {
  if (Array.isArray(v)) return v.join(", ")
  if (typeof v === "boolean") return v ? "true" : "false"
  return String(v)
}

function fmtThreshold(value: number, unit?: string) {
  const n = Number.isInteger(value)
    ? value.toLocaleString()
    : value.toFixed(value < 1 ? 2 : 2).replace(/\.?0+$/, "")
  return `${n}${unit ?? ""}`
}

function PolicyBody({
  policy: g,
  violations,
  onPatch,
  onDuplicate,
}: {
  policy: Guardrail
  violations: GuardrailViolation[]
  onPatch: (id: string, patch: Partial<Guardrail>) => void
  onDuplicate: (id: string) => void
}) {
  const [threshold, setThreshold] = React.useState(g.threshold?.value ?? 0)
  const [scope, setScope] = React.useState<string[]>(
    g.scope === "all" ? deployedAgents.map((a) => a.id) : g.scope
  )
  const thresholdDirty =
    g.threshold !== undefined && threshold !== g.threshold.value
  const savedScope =
    g.scope === "all" ? deployedAgents.map((a) => a.id) : g.scope
  const scopeDirty =
    scope.length !== savedScope.length ||
    scope.some((id) => !savedScope.includes(id))

  const trend = g.history.map((v, i) => ({
    date: daysAgo(13 - i),
    triggers: v,
  }))

  const saveThreshold = () => {
    if (!g.threshold) return
    onPatch(g.id, {
      threshold: { ...g.threshold, value: threshold },
      config: { ...g.config, [g.threshold.key]: threshold },
    })
    toast.success("Threshold saved", {
      description: `${g.name} · ${g.threshold.label.toLowerCase()} ${fmtThreshold(threshold, g.threshold.unit)}`,
    })
  }

  const saveScope = () => {
    const next =
      scope.length === deployedAgents.length ? ("all" as const) : scope
    onPatch(g.id, { scope: next })
    toast.success("Scope updated", {
      description: `${g.name} now applies to ${scopeLabel(next).toLowerCase()}.`,
    })
  }

  const toggleStatus = () => {
    const next = g.status === "Active" ? "Disabled" : "Active"
    onPatch(g.id, { status: next })
    toast[next === "Active" ? "success" : "warning"](
      next === "Active" ? "Policy enabled" : "Policy disabled",
      {
        description:
          next === "Active"
            ? `${g.name} is enforcing again for ${scopeLabel(g.scope).toLowerCase()}.`
            : `${g.name} stopped evaluating. Existing violations are kept.`,
      }
    )
  }

  const exportPolicy = () => {
    const blob = new Blob([g.policy + "\n"], { type: "text/yaml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${g.id}.yaml`
    a.click()
    URL.revokeObjectURL(url)
    toast("Policy exported", { description: `${g.id}.yaml` })
  }

  return (
    <>
      <SheetHeader className="gap-3 border-b px-6 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={g.category} />
          <ModeBadge mode={g.mode} />
          <PolicyStatusBadge status={g.status} />
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {g.id}
          </span>
        </div>
        <SheetTitle className="text-lg leading-tight">{g.name}</SheetTitle>
        <SheetDescription className="text-sm leading-relaxed">
          {g.description}
        </SheetDescription>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            Owner <UserChip userId={g.ownerId} size="xs" />
          </span>
          <span>Updated {timeAgo(g.updated)}</span>
          <span>{scopeLabel(g.scope)}</span>
        </div>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-7">
          {/* Actions */}
          <div className="flex flex-wrap items-center gap-1.5">
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant={g.status === "Active" ? "outline" : "default"}
                    size="sm"
                  />
                }
              >
                {g.status === "Active" ? (
                  <>
                    <PowerOffIcon /> Disable
                  </>
                ) : (
                  <>
                    <PowerIcon /> Enable
                  </>
                )}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {g.status === "Active"
                      ? `Disable “${g.name}”?`
                      : `Enable “${g.name}”?`}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {g.status === "Active"
                      ? `The policy stops evaluating for ${scopeLabel(g.scope).toLowerCase()} immediately. Agents in scope lose this ${g.category.toLowerCase()} guardrail until it is re-enabled.`
                      : `The policy starts evaluating for ${scopeLabel(g.scope).toLowerCase()} on the next request using mode “${g.mode}”.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant={g.status === "Active" ? "destructive" : "default"}
                    onClick={toggleStatus}
                  >
                    {g.status === "Active" ? "Disable policy" : "Enable policy"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="ghost" size="sm" onClick={() => onDuplicate(g.id)}>
              <CopyIcon /> Duplicate
            </Button>
            <Button variant="ghost" size="sm" onClick={exportPolicy}>
              <DownloadIcon /> Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              render={<Link href="/agentops/traces" />}
            >
              <RouteIcon /> Traces
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="Triggers · 24h"
              value={g.triggers24h.toLocaleString()}
            />
            <Stat
              label="False-positive rate"
              value={g.triggers24h === 0 ? "—" : fmtPct(g.falsePositiveRate)}
              tone={
                g.falsePositiveRate >= 0.3
                  ? "danger"
                  : g.falsePositiveRate >= 0.15
                    ? "warning"
                    : undefined
              }
            />
            <div className="flex flex-col justify-between rounded-lg border bg-card p-3">
              <span className="text-[11px] font-medium text-muted-foreground">
                Engine
              </span>
              <EngineCell policy={g} className="mt-1" />
            </div>
          </div>

          {/* Configuration */}
          <Section
            title="Configuration"
            description="Readable view of the policy, then the source of truth."
          >
            <dl className="divide-y divide-border/70 rounded-lg border">
              {Object.entries(g.config).map(([k, v]) => (
                <div
                  key={k}
                  className="grid grid-cols-[minmax(8rem,1fr)_minmax(0,2fr)] items-baseline gap-x-4 px-3 py-2"
                >
                  <dt className="font-mono text-xs text-muted-foreground">
                    {k}
                  </dt>
                  <dd className="min-w-0 text-sm break-words">
                    {Array.isArray(v) ? (
                      <span className="flex flex-wrap gap-1">
                        {v.map((item) => (
                          <Badge
                            key={item}
                            variant="outline"
                            className="h-5 px-1.5 font-mono text-[11px] text-muted-foreground"
                          >
                            {item}
                          </Badge>
                        ))}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          typeof v !== "string" &&
                            "font-mono text-xs tabular-nums"
                        )}
                      >
                        {fmtConfigValue(v)}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="relative rounded-lg border bg-muted/40">
              <div className="flex items-center justify-between border-b px-3 py-1.5">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {g.id}.yaml
                </span>
                <CopyButton value={g.policy} label="Copy YAML" />
              </div>
              <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed">
                {g.policy}
              </pre>
            </div>
          </Section>

          {/* Threshold */}
          {g.threshold && (
            <Section
              title="Threshold"
              description={g.threshold.label}
              action={
                <Button
                  size="sm"
                  variant={thresholdDirty ? "default" : "outline"}
                  disabled={!thresholdDirty}
                  onClick={saveThreshold}
                >
                  Save
                </Button>
              }
            >
              <div className="rounded-lg border p-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <Label
                    htmlFor={`${g.id}-threshold`}
                    className="font-mono text-xs text-muted-foreground"
                  >
                    {g.threshold.key}
                  </Label>
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    {fmtThreshold(threshold, g.threshold.unit)}
                    {thresholdDirty && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        was {fmtThreshold(g.threshold.value, g.threshold.unit)}
                      </span>
                    )}
                  </span>
                </div>
                <Slider
                  id={`${g.id}-threshold`}
                  aria-label={g.threshold.label}
                  min={g.threshold.min}
                  max={g.threshold.max}
                  step={g.threshold.step}
                  value={[threshold]}
                  onValueChange={(v) =>
                    setThreshold(Array.isArray(v) ? v[0] : v)
                  }
                />
                <div className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground tabular-nums">
                  <span>{fmtThreshold(g.threshold.min, g.threshold.unit)}</span>
                  <span>{fmtThreshold(g.threshold.max, g.threshold.unit)}</span>
                </div>
              </div>
            </Section>
          )}

          {/* Scope */}
          <Section
            title="Scope"
            description="Agents this policy evaluates. Fleet-wide when every agent is selected."
            action={
              <Button
                size="sm"
                variant={scopeDirty ? "default" : "outline"}
                disabled={!scopeDirty || scope.length === 0}
                onClick={saveScope}
              >
                Save scope
              </Button>
            }
          >
            <div className="grid gap-1 rounded-lg border p-2 sm:grid-cols-2">
              {deployedAgents.map((a) => {
                const checked = scope.includes(a.id)
                const id = `${g.id}-scope-${a.id}`
                return (
                  <label
                    key={a.id}
                    htmlFor={id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60",
                      !checked && "text-muted-foreground"
                    )}
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(c) =>
                        setScope((prev) =>
                          c ? [...prev, a.id] : prev.filter((x) => x !== a.id)
                        )
                      }
                    />
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {a.environment}
                    </span>
                  </label>
                )
              })}
            </div>
            {scope.length === 0 && (
              <p className="text-xs text-danger-text">
                Select at least one agent.
              </p>
            )}
          </Section>

          {/* Trigger history */}
          <Section
            title="Trigger history"
            description="Daily triggers over the last 14 days."
          >
            <IncidentTrendChart
              data={trend}
              series={[
                {
                  key: "triggers",
                  label: "Triggers",
                  color:
                    g.mode === "Block" ? "var(--chart-5)" : "var(--chart-1)",
                },
              ]}
              height={160}
            />
          </Section>

          {/* Recent violations */}
          <Section
            title="Recent violations"
            description={`${violations.length} in the sampled window`}
          >
            {violations.length === 0 ? (
              <EmptyState
                size="sm"
                icon={<ShieldCheckIcon />}
                title="No violations recorded"
                description="This policy has not matched anything in the sampled window."
              />
            ) : (
              <ul className="divide-y rounded-lg border">
                {violations.slice(0, 5).map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-col gap-1.5 px-3 py-2.5 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <AgentChip agentId={v.agentId} size="sm" />
                      <ActionBadge action={v.action} size="sm" />
                      <StateBadge state={v.severity} size="sm" />
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {timeAgo(v.time)}
                      </span>
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {v.snippet}
                    </p>
                    <div className="flex items-center gap-2 text-xs">
                      <Link
                        href={`/agentops/traces/${v.traceId}`}
                        className="font-mono text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        {v.traceId}
                      </Link>
                      <span className="text-muted-foreground">·</span>
                      <StateBadge state={v.verdict} size="sm" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Versions */}
          <Section
            title="Versions"
            description="Every change is a new version; rolling back re-deploys the older policy."
          >
            <ol className="divide-y rounded-lg border">
              {g.versions.map((v, i) => (
                <li
                  key={v.version}
                  className="flex items-start gap-3 px-3 py-2.5"
                >
                  <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <HistoryIcon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold">
                        {v.version}
                      </span>
                      {i === 0 && (
                        <Badge
                          variant="outline"
                          className="h-4.5 px-1.5 text-[10px] text-muted-foreground"
                        >
                          current
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(v.changed)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm">{v.summary}</p>
                    <div className="mt-1">
                      <UserChip userId={v.authorId} size="xs" />
                    </div>
                  </div>
                  {i > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() =>
                        toast(`Rolled back to ${v.version}`, {
                          description: `${g.name} re-deployed from ${v.version}. A new version was recorded.`,
                        })
                      }
                    >
                      <RotateCcwIcon /> Rollback
                    </Button>
                  )}
                </li>
              ))}
            </ol>
          </Section>
          <Separator className="opacity-0" />
        </div>
      </div>
    </>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "warning" | "danger"
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border bg-card p-3">
      <span className="text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          tone === "warning" && "text-warning-text",
          tone === "danger" && "text-danger-text"
        )}
      >
        {value}
      </span>
    </div>
  )
}
