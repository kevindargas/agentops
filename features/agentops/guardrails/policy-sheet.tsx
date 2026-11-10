"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  ActivityIcon,
  CopyIcon,
  DownloadIcon,
  FlaskConicalIcon,
  HistoryIcon,
  LanguagesIcon,
  PowerIcon,
  PowerOffIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CHART_HEIGHT } from "@/components/charts/chart-primitives"
import { IncidentTrendChart } from "@/components/charts/incident-trend-chart"
import { CopyButton } from "@/components/shared/copy-button"
import { EmptyState } from "@/components/shared/empty-state"
import { MetricTile } from "@/components/shared/metric-tile"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import { deployedAgents } from "@/lib/data/agentops"
import { getEvalRun } from "@/lib/data/evals"
import type {
  Guardrail,
  GuardrailVersion,
  GuardrailViolation,
} from "@/lib/data/guardrails"
import { clock, daysAgo } from "@/lib/data/seed"
import { currentUser } from "@/lib/data/users"
import { formatDate, formatMs, timeAgo } from "@/lib/format"
import { recordAudit } from "../audit/audit-store"
import { AgentChip } from "../shared"
import {
  ActionBadge,
  bypassAlertThreshold,
  CategoryBadge,
  EngineCell,
  FailModeBadge,
  failModeMeta,
  fmtPct,
  ModeBadge,
  PolicyStatusBadge,
  scopeLabel,
  violationsHref,
} from "./shared"
import { falsePositiveRate, fpTone } from "./store"

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
      <SheetContent
        className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
      >
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
    : value.toFixed(2).replace(/\.?0+$/, "")
  return `${n}${unit ?? ""}`
}

function nextVersion(versions: GuardrailVersion[]) {
  const nums = versions.map((v) => Number(v.version.replace(/^v/, "")) || 0)
  const max = Math.max(0, ...nums)
  return `v${(Math.floor(max) + 1).toFixed(1)}`
}

function policyTarget(g: Guardrail) {
  return {
    kind: "guardrail",
    id: g.id,
    label: g.name,
    href: `/agentops/guardrails?policy=${g.id}`,
  }
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
  const fp = falsePositiveRate(violations)
  const fpToneValue = fpTone(fp.rate)
  const current = g.versions[0]

  /** Append a version entry and bump `updated`; every saved change is a version. */
  const bump = (summary: string, extra: Partial<Guardrail> = {}) => {
    const version: GuardrailVersion = {
      version: nextVersion(g.versions),
      changed: clock().toISOString(),
      authorId: currentUser.id,
      summary,
    }
    onPatch(g.id, {
      ...extra,
      updated: version.changed,
      versions: [version, ...g.versions],
    })
    return version
  }

  const saveThreshold = () => {
    if (!g.threshold) return
    const before = fmtThreshold(g.threshold.value, g.threshold.unit)
    const after = fmtThreshold(threshold, g.threshold.unit)
    const version = bump(`${g.threshold.label} ${before} to ${after}`, {
      threshold: { ...g.threshold, value: threshold },
      config: { ...g.config, [g.threshold.key]: threshold },
    })
    const event = recordAudit({
      action: "guardrail.threshold.changed",
      source: "guardrail",
      target: policyTarget(g),
      summary: `Changed ${g.threshold.label.toLowerCase()} on ${g.name} from ${before} to ${after}`,
      before: `${g.threshold.key}: ${before}`,
      after: `${g.threshold.key}: ${after}`,
      context: { policyVersion: version.version },
    })
    toast.success("Threshold saved", {
      description: `${g.name} ${version.version} · ${g.threshold.label.toLowerCase()} ${after}. Recorded as ${event.id}.`,
    })
  }

  const saveScope = () => {
    const next =
      scope.length === deployedAgents.length ? ("all" as const) : scope
    const version = bump(
      `Scope ${scopeLabel(g.scope).toLowerCase()} to ${scopeLabel(next).toLowerCase()}`,
      { scope: next }
    )
    const event = recordAudit({
      action: "guardrail.policy.updated",
      source: "guardrail",
      target: policyTarget(g),
      summary: `Rescoped ${g.name} to ${scopeLabel(next).toLowerCase()}`,
      before: scopeLabel(g.scope),
      after: scopeLabel(next),
      context: { policyVersion: version.version },
    })
    toast.success("Scope updated", {
      description: `${g.name} now applies to ${scopeLabel(next).toLowerCase()}. Recorded as ${event.id}.`,
    })
  }

  const toggleStatus = () => {
    const next = g.status === "Active" ? "Disabled" : "Active"
    onPatch(g.id, { status: next, updated: clock().toISOString() })
    const event = recordAudit({
      action:
        next === "Active"
          ? "guardrail.policy.enabled"
          : "guardrail.policy.disabled",
      source: "guardrail",
      target: policyTarget(g),
      summary: `${next === "Active" ? "Enabled" : "Disabled"} ${g.name} for ${scopeLabel(g.scope).toLowerCase()}`,
      before: g.status,
      after: next,
      context: { policyVersion: current?.version },
    })
    toast[next === "Active" ? "success" : "warning"](
      next === "Active" ? "Policy enabled" : "Policy disabled",
      {
        description:
          next === "Active"
            ? `${g.name} is enforcing again for ${scopeLabel(g.scope).toLowerCase()}. Recorded as ${event.id}.`
            : `${g.name} stopped evaluating. Existing violations are kept. Recorded as ${event.id}.`,
      }
    )
  }

  const rollbackTo = (v: GuardrailVersion) => {
    const version = bump(`Rolled back to ${v.version} (${v.summary})`)
    const event = recordAudit({
      action: "guardrail.policy.rolled_back",
      source: "guardrail",
      target: policyTarget(g),
      summary: `Rolled back ${g.name} to ${v.version}; recorded as ${version.version}`,
      before: current?.version,
      after: version.version,
      context: { policyVersion: version.version },
    })
    toast(`Rolled back to ${v.version}`, {
      description: `${g.name} re-deployed from ${v.version} as ${version.version}. Recorded as ${event.id}.`,
    })
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

      <SheetBody>
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
                      ? `Disable "${g.name}"?`
                      : `Enable "${g.name}"?`}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {g.status === "Active"
                      ? `The policy stops evaluating for ${scopeLabel(g.scope).toLowerCase()} immediately. Agents in scope lose this ${g.category.toLowerCase()} guardrail until it is re-enabled. A guardrail.policy.disabled event is appended to the audit log.`
                      : `The policy starts evaluating for ${scopeLabel(g.scope).toLowerCase()} on the next request using mode "${g.mode}". A guardrail.policy.enabled event is appended to the audit log.`}
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
              render={<Link href={violationsHref(g.id)} />}
            >
              <ShieldAlertIcon /> Violations
            </Button>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href={`/agentops/traces?policy=${g.id}`} />}
            >
              <ActivityIcon /> Traces
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricTile
              label="Triggers · 24h"
              value={g.triggers24h.toLocaleString()}
            />
            <MetricTile
              label="False-positive rate"
              value={fp.rate === null ? "n/a" : fmtPct(fp.rate)}
              tone={fpToneValue}
              hint={
                fp.decided
                  ? `${fp.dismissed} of ${fp.decided} verdicts`
                  : "No reviewer verdicts yet"
              }
            />
            <MetricTile label="Engine" value={<EngineCell policy={g} />} />
          </div>

          {/* Effectiveness */}
          <Section
            title="Effectiveness"
            description="How the guardrail behaves under failure and attack, and where it has been validated."
          >
            <EffectivenessPanel
              policy={g}
              fpRate={fp.rate}
              fpDecided={fp.decided}
            />
          </Section>

          {/* Configuration */}
          <Section
            title="Configuration"
            description="Readable view of the policy, then the source of truth."
          >
            <dl className="divide-y divide-border/70 rounded-lg border">
              {Object.entries(g.config).map(([k, v]) => (
                <div
                  key={k}
                  className="grid grid-cols-1 gap-x-4 gap-y-0.5 px-3 py-2 sm:grid-cols-[minmax(8rem,1fr)_minmax(0,2fr)] sm:items-baseline"
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
                            className="h-5 px-1.5 font-mono text-2xs text-muted-foreground"
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
                <span className="font-mono text-2xs text-muted-foreground">
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
                <div className="mt-2 flex justify-between font-mono text-2xs text-muted-foreground tabular-nums">
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
                    <span className="text-2xs text-muted-foreground">
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
              height={CHART_HEIGHT.sm}
            />
          </Section>

          {/* Recent violations */}
          <Section
            title="Recent violations"
            description={`${violations.length} in the sampled window`}
            action={
              violations.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link href={violationsHref(g.id)} />}
                >
                  View all
                </Button>
              ) : undefined
            }
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
            description="Every saved change is a new version; rolling back re-deploys the older policy as a new version."
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
                          className="h-4.5 px-1.5 text-3xs text-muted-foreground"
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
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                          />
                        }
                      >
                        <RotateCcwIcon /> Rollback
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Roll back {g.name} to {v.version}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            The {v.version} configuration is re-deployed as a
                            new version ({nextVersion(g.versions)}) for{" "}
                            {scopeLabel(g.scope).toLowerCase()}. Threshold and
                            scope edits made since are superseded. A
                            guardrail.policy.rolled_back event is appended to
                            the audit log.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => rollbackTo(v)}
                          >
                            <RotateCcwIcon /> Roll back
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </SheetBody>
      <SheetFooterActions />
    </>
  )
}

function EffectivenessPanel({
  policy: g,
  fpRate,
  fpDecided,
}: {
  policy: Guardrail
  fpRate: number | null
  fpDecided: number
}) {
  const run = g.lastRedTeamRunId ? getEvalRun(g.lastRedTeamRunId) : undefined
  const bypassHigh = g.bypassRate > bypassAlertThreshold
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile
          label="Fail mode"
          value={<FailModeBadge failMode={g.failMode} />}
        />
        <MetricTile
          label="p95 evaluation"
          value={formatMs(g.p95Ms)}
          tone={g.p95Ms >= 1000 ? "warning" : undefined}
        />
        <MetricTile
          label="Red-team bypass"
          value={g.lastRedTeamRunId ? fmtPct(g.bypassRate, 1) : "n/a"}
          tone={bypassHigh ? "danger" : undefined}
        />
        <MetricTile
          label="False-positive rate"
          value={fpRate === null ? "n/a" : fmtPct(fpRate)}
          tone={fpTone(fpRate)}
          hint={fpDecided ? `${fpDecided} verdicts` : "No verdicts yet"}
        />
      </div>

      {(g.failMode === "fail_open" || bypassHigh) && (
        <ul className="flex flex-col gap-1.5 text-xs">
          {g.failMode === "fail_open" && (
            <li className="flex items-start gap-1.5 text-warning-text">
              <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {failModeMeta.fail_open.hint} Consider fail-closed for
                security-critical scopes.
              </span>
            </li>
          )}
          {bypassHigh && (
            <li className="flex items-start gap-1.5 text-danger-text">
              <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {fmtPct(g.bypassRate, 1)} of red-team attack cases got through,
                above the {fmtPct(bypassAlertThreshold)} threshold.
              </span>
            </li>
          )}
        </ul>
      )}

      <dl className="divide-y divide-border/70 rounded-lg border text-sm">
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 px-3 py-2 sm:grid-cols-[minmax(8rem,1fr)_minmax(0,2fr)] sm:items-center">
          <dt className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <FlaskConicalIcon className="size-3.5" /> Last red-team run
          </dt>
          <dd className="min-w-0">
            {g.lastRedTeamRunId ? (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <Link
                  href={`/agentops/evals/${g.lastRedTeamRunId}`}
                  className="font-mono text-xs underline-offset-4 hover:underline"
                >
                  {g.lastRedTeamRunId}
                </Link>
                {run && (
                  <span className="text-xs text-muted-foreground">
                    {run.datasetId} · {run.cases} cases · {timeAgo(run.started)}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Not an attack surface: no red-team dataset targets this policy.
              </span>
            )}
          </dd>
        </div>
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 px-3 py-2 sm:grid-cols-[minmax(8rem,1fr)_minmax(0,2fr)] sm:items-center">
          <dt className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <LanguagesIcon className="size-3.5" /> Language coverage
          </dt>
          <dd className="min-w-0">
            {g.languages.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                Language-agnostic
              </span>
            ) : (
              <span className="flex flex-wrap gap-1">
                {g.languages.map((l) => (
                  <Badge
                    key={l}
                    variant="outline"
                    className="h-5 px-1.5 font-mono text-2xs uppercase"
                  >
                    {l}
                  </Badge>
                ))}
              </span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  )
}
