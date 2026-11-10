"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
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

import { setQueryParam } from "@/hooks/use-query-param"
import { CopyButton } from "@/components/shared/copy-button"
import { DetailList } from "@/components/shared/detail-list"
import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { Section } from "@/components/shared/page-header"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { StateBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Switch } from "@/components/ui/switch"
import { deployedAgents } from "@/lib/data/agentops"
import { modelPricing } from "@/lib/data/costs"
import {
  getProvider,
  providers,
  routingRuleConfig,
  simulateRoute,
  type ApiKey,
  type RoutingCondition,
  type RoutingRule,
  type RoutingStrategy,
  type RoutingTarget,
} from "@/lib/data/providers"
import { clock } from "@/lib/data/seed"
import { formatMs, formatNumber, timeAgo } from "@/lib/format"
import { AgentChip, ModelChip } from "../shared"
import { ProviderChip } from "./shared"
import { fakeHex, keyStore, routingStore } from "./store"

/* ------------------------------------------------------------------------ */
/* Strategies                                                                */
/* ------------------------------------------------------------------------ */

export const strategies: RoutingStrategy[] = [
  "Priority fallback",
  "Weighted",
  "Lowest latency",
  "Lowest cost",
  "Region-pinned",
]

/** One line per strategy; the simulator and the sheet both quote it. */
export const strategyHint: Record<RoutingStrategy, string> = {
  "Priority fallback": "Try targets in order; move on when a condition fires.",
  Weighted:
    "Split traffic by weight; the heaviest healthy target serves first and failed targets are skipped.",
  "Lowest latency":
    "Pick the healthy target with the best rolling p95; the rest are fallbacks.",
  "Lowest cost":
    "Pick the cheapest healthy target each minute; pricier targets are fallbacks.",
  "Region-pinned":
    "Only targets in the pinned regions are eligible, tried in order.",
}

const conditions: RoutingCondition[] = [
  "on 429",
  "on 5xx",
  "on timeout",
  "on cost over budget",
]

function pricePerMillion(modelId: string) {
  const p = modelPricing[modelId]
  return p ? p.input + p.output : Number.POSITIVE_INFINITY
}

/**
 * The order in which the gateway would try a rule's targets under its
 * strategy. `simulateRoute` walks a chain front to back, so re-ordering the
 * chain here is what makes the simulation honour Weighted, Lowest latency and
 * Lowest cost rules instead of treating every rule as priority fallback.
 */
export function orderedChain(rule: RoutingRule): RoutingTarget[] {
  const chain = rule.chain.map((t, i) => ({ t, i }))
  const stable = (score: (target: RoutingTarget) => number, desc = false) =>
    chain
      .sort((a, b) => {
        const d = score(a.t) - score(b.t)
        return (desc ? -d : d) || a.i - b.i
      })
      .map((x) => x.t)
  switch (rule.strategy) {
    case "Weighted":
      return stable((t) => t.weight ?? 0, true)
    case "Lowest latency":
      return stable((t) => getProvider(t.providerId)?.p95Ms ?? Infinity)
    case "Lowest cost":
      return stable((t) => pricePerMillion(t.modelId))
    default:
      return rule.chain
  }
}

/* ------------------------------------------------------------------------ */
/* Tab                                                                       */
/* ------------------------------------------------------------------------ */

export function RoutingTab() {
  const items = routingStore.use()
  const keys = keyStore.use()
  const params = useSearchParams()
  const openId = params.get("rule")
  const open = openId ? (items.find((r) => r.id === openId) ?? null) : null
  const [createOpen, setCreateOpen] = React.useState(false)

  const openRule = (id: string | null) => setQueryParam("rule", id)
  const hits = items.reduce((s, r) => s + r.fallbackHits24h, 0)
  const active = items.filter((r) => r.status === "Active").length

  const toggle = (r: RoutingRule) => {
    const next = r.status === "Active" ? "Paused" : "Active"
    routingStore.patch(r.id, { status: next, updated: clock().toISOString() })
    toast(next === "Active" ? "Rule activated" : "Rule paused", {
      description:
        next === "Active"
          ? `${r.name} is applied to the gateway again`
          : `${r.name}: its agents fall to the next matching rule`,
      duration: 6000,
      action: {
        label: "Undo",
        onClick: () =>
          routingStore.patch(r.id, { status: r.status, updated: r.updated }),
      },
    })
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <Section
        title="Routing rules"
        count={active}
        description={`${active} active rule${active === 1 ? "" : "s"} · ${formatNumber(hits)} fallbacks in the last 24h`}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <RouteIcon /> New rule
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {items.map((r) => (
            <RuleCard
              key={r.id}
              rule={r}
              onOpen={() => openRule(r.id)}
              onToggle={() => toggle(r)}
            />
          ))}
        </div>
      </Section>
      <SimulatePanel rules={items} />
      <RuleSheet
        rule={open}
        keys={keys}
        onClose={() => openRule(null)}
        onToggle={toggle}
      />
      <NewRuleSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(rule) => {
          routingStore.add(rule, "end")
          setCreateOpen(false)
          toast.success(`${rule.name} saved as draft`, {
            description:
              "Drafts are not applied to the gateway. Open the rule to review its config.",
          })
          openRule(rule.id)
        }}
      />
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
            <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
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
          <div className="flex flex-wrap items-center gap-1.5 text-2xs text-muted-foreground">
            <Eyebrow as="span">{r.strategy}</Eyebrow>
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
              className="h-5 px-1.5 font-mono text-3xs text-muted-foreground"
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
  keys,
  onClose,
  onToggle,
}: {
  rule: RoutingRule | null
  keys: ApiKey[]
  onClose: () => void
  onToggle: (rule: RoutingRule) => void
}) {
  const json = r ? JSON.stringify(routingRuleConfig(r), null, 2) : ""
  const chainProviders = r
    ? Array.from(new Set(r.chain.map((t) => t.providerId)))
    : []
  const ruleKeys = keys.filter(
    (k) => k.status !== "Revoked" && chainProviders.includes(k.providerId)
  )
  return (
    <Sheet open={r !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
      >
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
            <SheetBody className="flex flex-col gap-6">
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Model chain</h3>
                <Chain rule={r} />
                <p className="text-xs text-muted-foreground">
                  {strategyHint[r.strategy]}
                </p>
              </section>

              <DetailList
                columns={2}
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
                  { label: "Request timeout", value: formatMs(r.timeoutMs) },
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
                <h3 className="text-sm font-semibold">
                  Keys this chain signs with
                </h3>
                {ruleKeys.length === 0 ? (
                  <EmptyState
                    size="sm"
                    bare
                    title="No active key for these providers"
                    description="Create or rotate a key on the API Keys tab before activating the rule."
                  />
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {ruleKeys.map((k) => (
                      <li
                        key={k.id}
                        className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                      >
                        <Link
                          href={`/agentops/providers?tab=keys&key=${k.id}`}
                          className="min-w-0 flex-1 truncate font-mono text-xs font-medium hover:underline"
                        >
                          {k.name}
                        </Link>
                        <ProviderChip providerId={k.providerId} size="sm" />
                        <StateBadge state={k.status} size="sm" />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Gateway config</h3>
                  <CopyButton value={json} label="Copy JSON" />
                </div>
                <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-2xs leading-relaxed">
                  {json}
                </pre>
                <p className="text-xs text-muted-foreground">
                  Portkey-style config; applied to the gateway when the rule is
                  active. Region-pinned rules use the fallback mode with a
                  region on every target.
                </p>
              </section>
            </SheetBody>
            <SheetFooterActions
              primary={
                r.status === "Draft" ? undefined : (
                  <Button onClick={() => onToggle(r)}>
                    {r.status === "Active" ? (
                      <>
                        <PauseIcon /> Pause rule
                      </>
                    ) : (
                      <>
                        <PlayIcon /> Activate rule
                      </>
                    )}
                  </Button>
                )
              }
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------------ */
/* New rule                                                                  */
/* ------------------------------------------------------------------------ */

const agentOptions = [
  { value: "*", label: "Any agent without an explicit rule" },
  ...deployedAgents.map((a) => ({ value: a.id, label: a.name })),
]
const strategyOptions = strategies.map((s) => ({ value: s, label: s }))
const providerOptions = providers.map((p) => ({ value: p.id, label: p.name }))

function NewRuleSheet({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (rule: RoutingRule) => void
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        className={cn(sheetWidths.editor, "flex flex-col gap-0 p-0")}
      >
        {open && <NewRuleForm onCreate={onCreate} />}
      </SheetContent>
    </Sheet>
  )
}

function TargetFields({
  label,
  providerId,
  modelId,
  onProvider,
  onModel,
}: {
  label: string
  providerId: string
  modelId: string
  onProvider: (id: string) => void
  onModel: (id: string) => void
}) {
  const provider = getProvider(providerId)
  const models = provider?.enabledModels ?? []
  const modelOptions = models.map((m) => ({ value: m, label: m }))
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor={`${label}-provider`}>{label} provider</FieldLabel>
        <Select
          items={providerOptions}
          value={providerId}
          onValueChange={(v) => {
            if (!v) return
            onProvider(String(v))
            const next = getProvider(String(v))?.enabledModels[0]
            if (next) onModel(next)
          }}
        >
          <SelectTrigger id={`${label}-provider`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {providerOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${label}-model`}>{label} model</FieldLabel>
        <Select
          items={modelOptions}
          value={modelId}
          onValueChange={(v) => v && onModel(String(v))}
        >
          <SelectTrigger id={`${label}-model`} className="w-full font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {modelOptions.map((o) => (
              <SelectItem key={o.value} value={o.value} className="font-mono">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  )
}

function NewRuleForm({ onCreate }: { onCreate: (rule: RoutingRule) => void }) {
  const first = providers[0]
  const second = providers.find((p) => p.id !== first.id) ?? first
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [agent, setAgent] = React.useState("*")
  const [strategy, setStrategy] =
    React.useState<RoutingStrategy>("Priority fallback")
  const [primaryProvider, setPrimaryProvider] = React.useState(first.id)
  const [primaryModel, setPrimaryModel] = React.useState(
    first.enabledModels[0] ?? ""
  )
  const [withFallback, setWithFallback] = React.useState(true)
  const [fallbackProvider, setFallbackProvider] = React.useState(second.id)
  const [fallbackModel, setFallbackModel] = React.useState(
    second.enabledModels[0] ?? ""
  )
  const [picked, setPicked] = React.useState<RoutingCondition[]>([
    "on 429",
    "on 5xx",
  ])
  const [timeout, setTimeout_] = React.useState("20000")
  const [retries, setRetries] = React.useState("2")

  const timeoutMs = Number(timeout)
  const retryCount = Number(retries)
  const valid =
    name.trim().length >= 3 &&
    primaryModel.length > 0 &&
    (!withFallback || fallbackModel.length > 0) &&
    Number.isFinite(timeoutMs) &&
    timeoutMs > 0 &&
    Number.isInteger(retryCount) &&
    retryCount >= 0

  const build = (): RoutingRule => {
    const targets: RoutingTarget[] = [
      { modelId: primaryModel, providerId: primaryProvider },
      ...(withFallback
        ? [{ modelId: fallbackModel, providerId: fallbackProvider }]
        : []),
    ]
    const chain = targets.map((t, i) => ({
      ...t,
      ...(strategy === "Weighted"
        ? { weight: targets.length === 1 ? 100 : i === 0 ? 70 : 30 }
        : {}),
      ...(strategy === "Region-pinned"
        ? { region: getProvider(t.providerId)?.region }
        : {}),
    }))
    return {
      id: `rt-${fakeHex(name.trim(), 3)}`,
      name: name.trim(),
      description: description.trim() || strategyHint[strategy],
      agentIds: agent === "*" ? [] : [agent],
      trafficShare: 0,
      strategy,
      chain,
      conditions: picked,
      timeoutMs,
      retries: retryCount,
      fallbackHits24h: 0,
      status: "Draft",
      updated: clock().toISOString(),
    }
  }

  return (
    <>
      <SheetHeader className="border-b px-6 py-5">
        <SheetTitle className="text-lg">New routing rule</SheetTitle>
        <SheetDescription>
          Saved as a draft. Activate it from the card once the chain has been
          checked in the simulator.
        </SheetDescription>
      </SheetHeader>
      <SheetBody>
        <form
          id="new-rule"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) onCreate(build())
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="rule-name">Name</FieldLabel>
              <Input
                id="rule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ops Analyst · Sonnet with Bedrock failover"
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="rule-description">Description</FieldLabel>
              <Input
                id="rule-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional. Defaults to the strategy explanation."
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="rule-agent">Matched agent</FieldLabel>
                <Select
                  items={agentOptions}
                  value={agent}
                  onValueChange={(v) => v && setAgent(String(v))}
                >
                  <SelectTrigger id="rule-agent" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {agentOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="rule-strategy">Strategy</FieldLabel>
                <Select
                  items={strategyOptions}
                  value={strategy}
                  onValueChange={(v) => v && setStrategy(v as RoutingStrategy)}
                >
                  <SelectTrigger id="rule-strategy" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {strategyOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>{strategyHint[strategy]}</FieldDescription>
              </Field>
            </div>
            <TargetFields
              label="Primary"
              providerId={primaryProvider}
              modelId={primaryModel}
              onProvider={setPrimaryProvider}
              onModel={setPrimaryModel}
            />
            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <Label htmlFor="rule-fallback" className="font-normal">
                Add a fallback target
              </Label>
              <Switch
                id="rule-fallback"
                size="sm"
                checked={withFallback}
                onCheckedChange={setWithFallback}
              />
            </div>
            {withFallback && (
              <TargetFields
                label="Fallback"
                providerId={fallbackProvider}
                modelId={fallbackModel}
                onProvider={setFallbackProvider}
                onModel={setFallbackModel}
              />
            )}
            <Field>
              <FieldLabel>Fallback conditions</FieldLabel>
              <ul className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                {conditions.map((c) => {
                  const id = `cond-${c.replace(/\W/g, "-")}`
                  return (
                    <li key={c} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={picked.includes(c)}
                        onCheckedChange={(v) =>
                          setPicked((prev) =>
                            v ? [...prev, c] : prev.filter((x) => x !== c)
                          )
                        }
                      />
                      <label htmlFor={id} className="font-mono text-xs">
                        {c}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="rule-timeout">
                  Request timeout (ms)
                </FieldLabel>
                <Input
                  id="rule-timeout"
                  inputMode="numeric"
                  value={timeout}
                  onChange={(e) => setTimeout_(e.target.value)}
                  className="tabular-nums"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="rule-retries">
                  Retries per target
                </FieldLabel>
                <Input
                  id="rule-retries"
                  inputMode="numeric"
                  value={retries}
                  onChange={(e) => setRetries(e.target.value)}
                  className="tabular-nums"
                />
              </Field>
            </div>
          </FieldGroup>
        </form>
      </SheetBody>
      <SheetFooterActions
        primary={
          <Button type="submit" form="new-rule" disabled={!valid}>
            <CheckIcon /> Save draft
          </Button>
        }
      />
    </>
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
  const ordered = rule ? { ...rule, chain: orderedChain(rule) } : null
  const failed = [...(failPrimary ? [0] : []), ...(failSecondary ? [1] : [])]
  const result = ordered ? simulateRoute(ordered, failed) : null
  const reordered =
    rule && ordered ? rule.chain.some((t, i) => ordered.chain[i] !== t) : false

  return (
    <aside className="flex h-fit flex-col gap-4 rounded-xl border bg-card p-5 xl:sticky xl:top-20">
      <div>
        <h2 className="text-sm font-semibold">Simulate request</h2>
        <p className="text-xs text-muted-foreground">
          Pick an agent and fail targets to see the path the gateway takes under
          the rule&apos;s strategy.
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
      {rule && (
        <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{rule.strategy}:</span>{" "}
          {strategyHint[rule.strategy]}
          {reordered &&
            " Targets below are shown in the order this strategy tries them."}
        </p>
      )}
      <div className="flex flex-col gap-2 rounded-lg border px-3 py-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <Label htmlFor="sim-fail-primary" className="font-normal">
            Fail first target
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
            Fail second target
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
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-3xs font-semibold",
                  s.failed
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-success text-success-foreground"
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
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-2xs text-muted-foreground">
                  <ProviderChip providerId={s.target.providerId} size="sm" />
                  {s.target.weight !== undefined && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="tabular-nums">{s.target.weight}%</span>
                    </>
                  )}
                  {s.target.region && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="font-mono">{s.target.region}</span>
                    </>
                  )}
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">{formatMs(s.latencyMs)}</span>
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
                {formatMs(result.totalLatencyMs)}
              </span>
            </>
          ) : (
            "All targets failed: the request returns 503 to the agent."
          )}
        </p>
      )}
    </aside>
  )
}
