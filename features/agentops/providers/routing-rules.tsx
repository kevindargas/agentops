"use client"

import * as React from "react"
import { cn } from "cn"
import {
  ArrowRightIcon,
  BracesIcon,
  CheckIcon,
  CircleSlashIcon,
  GitForkIcon,
  PauseIcon,
  PlayIcon,
  RouteIcon,
  ZapIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CopyButton } from "@/components/shared/copy-button"
import { DetailList } from "@/components/shared/detail-list"
import { StateBadge } from "@/components/shared/status-badge"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { deployedAgents } from "@/lib/data"
import {
  routingRuleConfig,
  routingRules as seed,
  simulateRoute,
  type RoutingRule,
  type RoutingStrategy,
} from "@/lib/data/providers"
import { formatNumber, timeAgo } from "@/lib/format"
import { AgentChip, fmtMs, ModelChip } from "../shared"
import { ProviderChip } from "./shared"

const strategyHint: Record<RoutingStrategy, string> = {
  "Priority fallback": "Try targets in order; move on when a condition fires.",
  Weighted: "Split traffic by weight; failed targets are skipped.",
  "Lowest latency": "Pick the target with the best rolling p95.",
  "Lowest cost": "Pick the cheapest healthy target each minute.",
  "Region-pinned": "Only targets in the pinned regions are eligible.",
}

export function RoutingTab() {
  const [items, setItems] = React.useState<RoutingRule[]>(seed)
  const [openId, setOpenId] = React.useState<string | null>(null)
  const open = items.find((r) => r.id === openId) ?? null
  const patch = (id: string, p: Partial<RoutingRule>) =>
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)))

  const hits = items.reduce((s, r) => s + r.fallbackHits24h, 0)

  return (
    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {items.filter((r) => r.status === "Active").length} active rules ·{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatNumber(hits)}
            </span>{" "}
            fallbacks in the last 24h
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast("Rule editor opened")}
          >
            <RouteIcon /> New rule
          </Button>
        </div>
        {items.map((r) => (
          <RuleCard
            key={r.id}
            rule={r}
            onOpen={() => setOpenId(r.id)}
            onToggle={() => {
              const next = r.status === "Active" ? "Paused" : "Active"
              patch(r.id, { status: next })
              toast(next === "Active" ? "Rule activated" : "Rule paused", {
                description: r.name,
              })
            }}
          />
        ))}
      </section>
      <SimulatePanel rules={items} />
      <RuleSheet rule={open} onClose={() => setOpenId(null)} />
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Chain                                                                     */
/* ------------------------------------------------------------------------ */

function Chain({
  rule,
  compact = false,
}: {
  rule: RoutingRule
  compact?: boolean
}) {
  return (
    <ol className="flex flex-wrap items-center gap-y-2">
      {rule.chain.map((t, i) => (
        <li
          key={`${t.providerId}-${t.modelId}-${i}`}
          className="flex items-center"
        >
          {i > 0 && (
            <ArrowRightIcon
              className="mx-1.5 size-3.5 shrink-0 text-muted-foreground"
              aria-label="then"
            />
          )}
          <span
            className={cn(
              "flex flex-col gap-0.5 rounded-lg border bg-muted/30 px-2.5 py-1.5",
              i === 0 && "border-brand/30 bg-brand/5"
            )}
          >
            <ModelChip
              modelId={t.modelId}
              className={compact ? "text-xs" : "text-sm font-medium"}
            />
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ProviderChip providerId={t.providerId} size="sm" />
              {t.weight !== undefined && (
                <span className="tabular-nums">· {t.weight}%</span>
              )}
              {t.region && <span className="font-mono">· {t.region}</span>}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/* ------------------------------------------------------------------------ */
/* Card                                                                      */
/* ------------------------------------------------------------------------ */

function RuleCard({
  rule: r,
  onOpen,
  onToggle,
}: {
  rule: RoutingRule
  onOpen: () => void
  onToggle: () => void
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card p-5",
        r.status !== "Active" && "opacity-80"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-chart-4/15 text-chart-4">
          <GitForkIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium tracking-wide uppercase">
              {r.strategy}
            </span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{r.trafficShare}% of requests</span>
            <span aria-hidden>·</span>
            updated {timeAgo(r.updated)}
          </div>
          <h3 className="mt-0.5 text-base leading-snug font-semibold">
            <button
              type="button"
              onClick={onOpen}
              className="text-left hover:underline"
            >
              {r.name}
            </button>
          </h3>
        </div>
        <StateBadge state={r.status} size="sm" />
      </div>

      <Chain rule={r} compact />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          Agents:
          {r.agentIds.length === 0 ? (
            <span className="text-foreground">all unmatched</span>
          ) : (
            r.agentIds.map((id) => (
              <AgentChip key={id} agentId={id} size="sm" />
            ))
          )}
        </span>
        <span className="inline-flex flex-wrap items-center gap-1">
          {r.conditions.map((c) => (
            <Badge
              key={c}
              variant="outline"
              className="h-5 px-1.5 font-mono text-[10px] text-muted-foreground"
            >
              {c === "on timeout" ? `on timeout > ${r.timeoutMs / 1000}s` : c}
            </Badge>
          ))}
        </span>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ZapIcon className="size-3.5" />
          <span className="font-medium text-foreground tabular-nums">
            {formatNumber(r.fallbackHits24h)}
          </span>
          fallback hits · 24h
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={onOpen}>
            <BracesIcon /> Details
          </Button>
          {r.status !== "Draft" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              aria-label={
                r.status === "Active" ? "Pause rule" : "Activate rule"
              }
            >
              {r.status === "Active" ? (
                <>
                  <PauseIcon /> Pause
                </>
              ) : (
                <>
                  <PlayIcon /> Activate
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------------ */
/* Detail sheet                                                              */
/* ------------------------------------------------------------------------ */

function RuleSheet({
  rule: r,
  onClose,
}: {
  rule: RoutingRule | null
  onClose: () => void
}) {
  const json = r ? JSON.stringify(routingRuleConfig(r), null, 2) : ""
  return (
    <Sheet open={r !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {r && (
          <>
            <SheetHeader className="gap-3 border-b px-6 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <StateBadge state={r.status} />
                <Badge variant="outline" className="text-muted-foreground">
                  {r.strategy}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-muted-foreground tabular-nums"
                >
                  {r.trafficShare}% of traffic
                </Badge>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {r.id}
                </span>
              </div>
              <SheetTitle className="text-lg leading-tight">
                {r.name}
              </SheetTitle>
              <SheetDescription className="text-sm leading-relaxed">
                {r.description}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-6">
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">Model chain</h3>
                  <Chain rule={r} />
                  <p className="text-xs text-muted-foreground">
                    {strategyHint[r.strategy]}
                  </p>
                </section>

                <DetailList
                  columns={2}
                  dense
                  items={[
                    {
                      label: "Matched agents",
                      value:
                        r.agentIds.length === 0 ? (
                          "Any agent without an explicit rule"
                        ) : (
                          <span className="flex flex-wrap gap-2">
                            {r.agentIds.map((id) => (
                              <AgentChip key={id} agentId={id} />
                            ))}
                          </span>
                        ),
                    },
                    {
                      label: "Fallback conditions",
                      value: r.conditions
                        .map((c) =>
                          c === "on timeout"
                            ? `on timeout > ${r.timeoutMs / 1000}s`
                            : c
                        )
                        .join(" · "),
                    },
                    { label: "Request timeout", value: fmtMs(r.timeoutMs) },
                    {
                      label: "Retries per target",
                      value: String(r.retries),
                    },
                    {
                      label: "Fallback hits · 24h",
                      value: formatNumber(r.fallbackHits24h),
                    },
                    { label: "Updated", value: timeAgo(r.updated) },
                  ]}
                />

                <section className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Gateway config</h3>
                    <CopyButton value={json} label="Copy JSON" />
                  </div>
                  <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-[11px] leading-relaxed">
                    {json}
                  </pre>
                  <p className="text-xs text-muted-foreground">
                    Portkey-style config; applied to the gateway when the rule
                    is active.
                  </p>
                </section>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------------ */
/* Simulation                                                                */
/* ------------------------------------------------------------------------ */

const agentItems = deployedAgents.map((a) => ({ value: a.id, label: a.name }))

function ruleForAgent(rules: RoutingRule[], agentId: string) {
  return (
    rules.find((r) => r.status === "Active" && r.agentIds.includes(agentId)) ??
    rules.find((r) => r.agentIds.includes(agentId)) ??
    rules.find((r) => r.agentIds.length === 0) ??
    null
  )
}

function SimulatePanel({ rules }: { rules: RoutingRule[] }) {
  const [agentId, setAgentId] = React.useState(deployedAgents[0].id)
  const [failPrimary, setFailPrimary] = React.useState(true)
  const [failSecondary, setFailSecondary] = React.useState(false)
  const rule = ruleForAgent(rules, agentId)
  const failed = [...(failPrimary ? [0] : []), ...(failSecondary ? [1] : [])]
  const result = rule ? simulateRoute(rule, failed) : null

  return (
    <aside className="flex h-fit flex-col gap-4 rounded-xl border bg-card p-5 xl:sticky xl:top-20">
      <div>
        <h2 className="text-sm font-semibold">Simulate request</h2>
        <p className="text-xs text-muted-foreground">
          Pick an agent and fail targets to see the path the gateway takes.
        </p>
      </div>
      <Field>
        <FieldLabel htmlFor="sim-agent">Agent</FieldLabel>
        <Select
          items={agentItems}
          value={agentId}
          onValueChange={(v) => v && setAgentId(String(v))}
        >
          <SelectTrigger id="sim-agent" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {agentItems.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>
          Matches{" "}
          {rule ? (
            <span className="font-medium text-foreground">{rule.name}</span>
          ) : (
            "no rule"
          )}
          {rule &&
            rule.status !== "Active" &&
            ` (${rule.status.toLowerCase()})`}
        </FieldDescription>
      </Field>
      <div className="flex flex-col gap-2 rounded-lg border px-3 py-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <Label htmlFor="sim-fail-primary" className="font-normal">
            Fail primary target
          </Label>
          <Switch
            id="sim-fail-primary"
            size="sm"
            checked={failPrimary}
            onCheckedChange={setFailPrimary}
          />
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <Label htmlFor="sim-fail-secondary" className="font-normal">
            Fail secondary target
          </Label>
          <Switch
            id="sim-fail-secondary"
            size="sm"
            checked={failSecondary}
            onCheckedChange={setFailSecondary}
            disabled={!rule || rule.chain.length < 2}
          />
        </div>
      </div>

      {result && rule && (
        <ol className="flex flex-col gap-2" aria-label="Simulated path">
          {result.steps.map((s, i) => (
            <li
              key={i}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-3 py-2",
                s.failed
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-success/30 bg-success/5"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-background",
                  s.failed ? "bg-destructive" : "bg-success"
                )}
              >
                {s.failed ? (
                  <CircleSlashIcon className="size-3" />
                ) : (
                  <CheckIcon className="size-3" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <ModelChip
                  modelId={s.target.modelId}
                  className="text-sm font-medium"
                />
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                  <ProviderChip providerId={s.target.providerId} size="sm" />
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">{fmtMs(s.latencyMs)}</span>
                  {s.reason && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="text-danger-text">{s.reason}</span>
                    </>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {result && (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            result.served
              ? "text-muted-foreground"
              : "border-destructive/30 bg-destructive/5 text-danger-text"
          )}
        >
          {result.served ? (
            <>
              Served by{" "}
              <span className="font-medium text-foreground">
                {result.served.modelId.split("/").pop()}
              </span>{" "}
              after {result.steps.length - 1} fallback
              {result.steps.length - 1 === 1 ? "" : "s"} · total{" "}
              <span className="tabular-nums">
                {fmtMs(result.totalLatencyMs)}
              </span>
            </>
          ) : (
            "All targets failed — the request returns 503 to the agent."
          )}
        </p>
      )}
    </aside>
  )
}
