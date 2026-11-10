"use client"

import Link from "next/link"
import { createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import {
  ArrowUpRightIcon,
  BotIcon,
  ClockIcon,
  HistoryIcon,
  LayersIcon,
  PauseIcon,
  PlayIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react"

import { AgentAvatar, AgentCard } from "@/components/ai/agent-card"
import { useAi } from "@/components/ai/ai-provider"
import { ProposalCard } from "@/components/ai/proposal-card"
import { Sparkline } from "@/components/charts/sparkline"
import { StackedBarChart } from "@/components/charts/stacked-bar-chart"
import {
  DataTable,
  DataTableColumnHeader,
  NumericCell,
  type DataTableFeatures,
} from "@/components/data-table"
import { CountPill } from "@/components/shared/count-pill"
import { EmptyState } from "@/components/shared/empty-state"
import { MetricTile } from "@/components/shared/metric-tile"
import { StatCard } from "@/components/shared/stat-card"
import { StatGrid } from "@/components/shared/stat-grid"
import { StateBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldTitle,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  agentRuns,
  autonomyMeta,
  getAgent,
  models,
  runOutcomeMeta,
  toolCatalog,
  usageByDay,
  type AgentRun,
  type Autonomy,
} from "@/lib/ai/agents"
import { formatDurationMs, formatNumber, timeAgo } from "@/lib/format"

const outcomeState: Record<string, string> = {
  applied: "Complete",
  approved: "Approved",
  rejected: "Rejected",
  suggested: "Draft",
  failed: "Failed",
  undone: "Canceled",
}

const riskTone: Record<"low" | "medium" | "high", string> = {
  low: "border-border text-muted-foreground",
  medium: "border-warning/40 text-warning-text",
  high: "border-destructive/30 text-danger-text",
}

/** Header actions for the Workflow Automations page. */
export function ControlCenterActions() {
  const { agents, updateAgent, setOpen, setTab } = useAi()
  const anyActive = agents.some((a) => a.enabled)
  return (
    <>
      <Button variant="outline" size="sm" render={<Link href="/ai/models" />}>
        <LayersIcon /> Model catalog
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          agents.forEach((a) => updateAgent(a.id, { enabled: !anyActive }))
        }
      >
        {anyActive ? <PauseIcon /> : <PlayIcon />}{" "}
        {anyActive ? "Pause all agents" : "Resume all agents"}
      </Button>
      <Button
        size="sm"
        onClick={() => {
          setTab("chat")
          setOpen(true)
        }}
      >
        <SparklesIcon /> Open Assist
      </Button>
    </>
  )
}

/* ------------------------------------------------------------------------ */
/* Run history table                                                         */
/* ------------------------------------------------------------------------ */

const runCol = createColumnHelper<DataTableFeatures, AgentRun>()

const runColumns = runCol.columns([
  runCol.accessor("agentId", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Agent" />
    ),
    cell: ({ getValue }) => (
      <span className="flex items-center gap-2">
        <AgentAvatar agentId={getValue()} size="xs" />
        <span className="truncate text-sm">{getAgent(getValue())?.name}</span>
      </span>
    ),
    enableHiding: false,
    meta: { width: "w-48", label: "Agent", skeleton: "w-28" },
  }),
  runCol.accessor("summary", {
    header: "Run",
    cell: ({ row }) => {
      const r = row.original
      return (
        <div className="min-w-0">
          <p className="truncate text-sm">{r.summary}</p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            {r.recordNumber && r.recordHref ? (
              <Link
                href={r.recordHref}
                className="inline-flex items-center gap-0.5 font-mono underline-offset-4 hover:underline"
              >
                {r.recordNumber}{" "}
                <ArrowUpRightIcon className="size-3 opacity-60" />
              </Link>
            ) : (
              <span>No record</span>
            )}
            <span>
              {r.toolCalls} tool call{r.toolCalls === 1 ? "" : "s"}
            </span>
          </p>
        </div>
      )
    },
    enableSorting: false,
    meta: { width: "min-w-72 max-w-md", label: "Run", skeleton: "w-56" },
  }),
  runCol.accessor("trigger", {
    header: "Trigger",
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground">{getValue()}</span>
    ),
    enableSorting: false,
    meta: { width: "w-40", label: "Trigger", skeleton: "w-24" },
  }),
  runCol.accessor("durationMs", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Duration" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={formatDurationMs} />
    ),
    meta: { width: "w-24", label: "Duration", numeric: true, skeleton: "w-10" },
  }),
  runCol.accessor("tokens", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tokens" />
    ),
    cell: ({ getValue }) => (
      <NumericCell value={getValue()} format={(n) => formatNumber(n, true)} />
    ),
    meta: { width: "w-24", label: "Tokens", numeric: true, skeleton: "w-10" },
  }),
  runCol.accessor("outcome", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Outcome" />
    ),
    cell: ({ getValue }) => (
      <StateBadge state={runOutcomeMeta[getValue()].state} size="sm" />
    ),
    meta: { width: "w-36", label: "Outcome", skeleton: "w-20 rounded-full" },
  }),
  runCol.accessor("startedAt", {
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="When" />
    ),
    cell: ({ getValue }) => (
      <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        {timeAgo(getValue())}
      </span>
    ),
    meta: { width: "w-28", label: "When", skeleton: "w-16" },
  }),
])

/* ------------------------------------------------------------------------ */

/** Relative change in autonomous plus approved actions, today versus yesterday. */
function actionsDelta() {
  const today = usageByDay[usageByDay.length - 1]
  const yesterday = usageByDay[usageByDay.length - 2]
  if (!today || !yesterday) return undefined
  const a = today.applied + today.approved
  const b = yesterday.applied + yesterday.approved
  return b === 0 ? undefined : Math.round(((a - b) / b) * 1000) / 10
}

export function ControlCenter() {
  const {
    agents,
    updateAgent,
    proposals,
    decide,
    activity,
    settings,
    updateSettings,
    actionsToday,
  } = useAi()
  const enabled = agents.filter((a) => a.enabled)
  const actions24h = actionsToday
  const saved = enabled.reduce(
    (a, x) => a + x.actions24h * x.avgSavedMinutes,
    0
  )
  const acceptance = Math.round(
    agents.reduce((a, x) => a + x.acceptanceRate, 0) / agents.length
  )
  const degraded = agents.filter((a) => a.health === "Degraded").length
  const tokens24h = enabled.reduce((a, x) => a + x.tokens24h, 0)
  const budgetUsed = Math.min(
    100,
    Math.round((actions24h / settings.dailyActionBudget) * 100)
  )

  return (
    <>
      <StatGrid columns={4}>
        <StatCard
          label="Agent actions · 24h"
          value={actions24h.toLocaleString("en-US")}
          delta={actionsDelta()}
          deltaLabel="vs yesterday"
          hint={`${enabled.length} of ${agents.length} agents active${degraded ? ` · ${degraded} degraded` : ""}`}
        >
          <Sparkline
            data={usageByDay.map((d) => d.applied + d.approved)}
            className="h-8 w-full"
          />
        </StatCard>
        <StatCard
          label="Awaiting your approval"
          value={proposals.length}
          hint={
            proposals.length
              ? `Oldest ${timeAgo(proposals[proposals.length - 1].created)}`
              : "Queue is clear"
          }
        />
        <StatCard
          label="Acceptance rate"
          value={`${acceptance}%`}
          hint="Proposals approved or left unchanged, all agents"
        />
        <StatCard
          label="Time saved · 24h"
          value={`${Math.round(saved / 60)}h`}
          hint={`${formatNumber(tokens24h, true)} tokens · ${budgetUsed}% of daily budget`}
        />
      </StatGrid>

      <Tabs defaultValue="agents" className="gap-4">
        <TabsList>
          <TabsTrigger value="agents">
            <BotIcon /> Agents
          </TabsTrigger>
          <TabsTrigger value="queue">
            <ShieldCheckIcon /> Approval queue
            {proposals.length > 0 && (
              <CountPill
                count={proposals.length}
                tone="inverse"
                label="waiting"
                className="ml-0.5"
              />
            )}
          </TabsTrigger>
          <TabsTrigger value="runs">
            <HistoryIcon /> Runs
          </TabsTrigger>
          <TabsTrigger value="guardrails">
            <ShieldCheckIcon /> Guardrails
          </TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="agents" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              <span className="font-medium text-foreground tabular-nums">
                {enabled.length}
              </span>{" "}
              active
            </span>
            <span>
              <span className="font-medium text-foreground tabular-nums">
                {
                  agents.filter((a) => a.autonomy === "autonomous" && a.enabled)
                    .length
                }
              </span>{" "}
              autonomous
            </span>
            <span>
              <span className="font-medium text-foreground tabular-nums">
                {
                  agents.filter((a) => a.autonomy === "approve" && a.enabled)
                    .length
                }
              </span>{" "}
              need approval
            </span>
            <span>
              <span className="font-medium text-foreground tabular-nums">
                {agents.length - enabled.length}
              </span>{" "}
              paused
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((a) => (
              <AgentCard
                key={a.id}
                agent={a}
                onChange={(patch) => updateAgent(a.id, patch)}
              />
            ))}
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="queue">
          {proposals.length === 0 ? (
            <EmptyState
              icon={<SparklesIcon />}
              title="Nothing to approve"
              description="Agents set to act with approval will queue their proposed changes here."
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="grid gap-3 lg:grid-cols-2 xl:col-span-2">
                {proposals.map((p) => (
                  <ProposalCard key={p.id} proposal={p} onDecide={decide} />
                ))}
              </div>
              <Card className="self-start">
                <CardHeader>
                  <CardTitle>Queue at a glance</CardTitle>
                  <CardDescription>
                    What is waiting and who proposed it
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-2">
                    {(["high", "medium", "low"] as const).map((impact) => {
                      const n = proposals.filter(
                        (p) => p.impact === impact
                      ).length
                      return (
                        <MetricTile
                          key={impact}
                          label={`${impact} impact`}
                          value={n}
                          tone={
                            impact === "high" && n > 0 ? "danger" : undefined
                          }
                        />
                      )
                    })}
                  </div>
                  <ul className="flex flex-col divide-y">
                    {agents
                      .map((a) => ({
                        agent: a,
                        n: proposals.filter((p) => p.agentId === a.id).length,
                      }))
                      .filter((x) => x.n > 0)
                      .sort((a, b) => b.n - a.n)
                      .map(({ agent, n }) => (
                        <li
                          key={agent.id}
                          className="flex items-center gap-2.5 py-2 text-sm first:pt-0 last:pb-0"
                        >
                          <AgentAvatar agentId={agent.id} size="sm" />
                          <span className="min-w-0 flex-1 truncate">
                            {agent.name}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {n} proposal{n === 1 ? "" : "s"}
                          </span>
                        </li>
                      ))}
                  </ul>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Approving or rejecting moves the proposal to the activity
                    list under Runs with your name. In this template the
                    underlying record does not change.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="runs">
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Run history</CardTitle>
                <CardDescription>
                  Every agent invocation with its outcome, duration and tokens
                </CardDescription>
                <CardAction>
                  <CountPill
                    count={agentRuns.length}
                    size="default"
                    label="runs"
                  />
                </CardAction>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={runColumns}
                  data={agentRuns}
                  getRowId={(r) => r.id}
                  hideToolbar
                  hidePagination
                  initialSorting={[{ id: "startedAt", desc: true }]}
                  totalLabel="runs"
                  caption="Workflow agent run history with trigger, duration, tokens and outcome"
                />
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Actions per day</CardTitle>
                  <CardDescription>
                    Autonomous vs approved vs rejected
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <StackedBarChart
                    data={usageByDay}
                    series={[
                      {
                        key: "applied",
                        label: "Autonomous",
                        color: "var(--chart-1)",
                      },
                      {
                        key: "approved",
                        label: "Approved",
                        color: "var(--chart-3)",
                      },
                      {
                        key: "rejected",
                        label: "Rejected",
                        color: "var(--chart-2)",
                      },
                    ]}
                    height={220}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Activity</CardTitle>
                  <CardDescription>
                    Who approved what, and whether it was undone. Workflow
                    agents only; deployed-agent events live in the Audit Log.
                  </CardDescription>
                </CardHeader>
                <CardContent className="divide-y">
                  {activity.slice(0, 7).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                    >
                      <AgentAvatar agentId={a.agentId} size="sm" muted />
                      <div className="min-w-0 flex-1">
                        <p className="leading-snug">
                          <span className="font-medium">
                            {getAgent(a.agentId)?.name ?? "Assistant"}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            {a.summary}
                          </span>
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          {a.recordNumber && a.recordHref && (
                            <Link
                              href={a.recordHref}
                              className="font-mono underline-offset-4 hover:underline"
                            >
                              {a.recordNumber}
                            </Link>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <ClockIcon className="size-3" />{" "}
                            {timeAgo(a.timestamp)}
                          </span>
                          {a.actor && <span>by {a.actor}</span>}
                        </p>
                      </div>
                      <StateBadge
                        state={outcomeState[a.outcome]}
                        size="sm"
                        className="shrink-0"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        <TabsContent value="guardrails">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Model & autonomy</CardTitle>
                <CardDescription>
                  Defaults for the assistant and for new agents. Each setting
                  says what it does in this template.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="gap-5">
                  <Field>
                    <FieldLabel htmlFor="model">Model</FieldLabel>
                    <Select
                      value={settings.modelId}
                      onValueChange={(v) => v && updateSettings({ modelId: v })}
                      items={models.map((m) => ({
                        value: m.id,
                        label: m.name,
                      }))}
                    >
                      <SelectTrigger id="model" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}{" "}
                            <span className="text-muted-foreground">
                              · {m.tier}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {
                        models.find((m) => m.id === settings.modelId)
                          ?.description
                      }
                      . Labels the assistant run; the scripted engine does not
                      change with it.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="autonomy">
                      Default autonomy for new agents
                    </FieldLabel>
                    <Select
                      value={settings.defaultAutonomy}
                      onValueChange={(v) =>
                        v && updateSettings({ defaultAutonomy: v as Autonomy })
                      }
                      items={(Object.keys(autonomyMeta) as Autonomy[]).map(
                        (a) => ({ value: a, label: autonomyMeta[a].label })
                      )}
                    >
                      <SelectTrigger id="autonomy" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(autonomyMeta) as Autonomy[]).map((a) => (
                          <SelectItem key={a} value={a}>
                            {autonomyMeta[a].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {autonomyMeta[settings.defaultAutonomy].description}{" "}
                      <Badge variant="outline" className="ml-1 text-3xs">
                        Planned
                      </Badge>{" "}
                      Stored only; applies once agents can be registered from
                      this page.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <div className="flex items-center justify-between">
                      <FieldLabel htmlFor="budget">
                        Daily action budget
                      </FieldLabel>
                      <span className="text-sm tabular-nums">
                        {settings.dailyActionBudget.toLocaleString("en-US")}{" "}
                        actions
                      </span>
                    </div>
                    <Slider
                      id="budget"
                      min={50}
                      max={2000}
                      step={50}
                      value={[settings.dailyActionBudget]}
                      onValueChange={(v) =>
                        updateSettings({
                          dailyActionBudget: Array.isArray(v) ? v[0] : v,
                        })
                      }
                    />
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={budgetUsed}
                      aria-label="Budget used today"
                    >
                      <div
                        className={cn(
                          "h-full rounded-full",
                          budgetUsed >= 90
                            ? "bg-destructive"
                            : budgetUsed >= 70
                              ? "bg-warning"
                              : "bg-brand"
                        )}
                        style={{ width: `${budgetUsed}%` }}
                      />
                    </div>
                    <FieldDescription>
                      Once the budget is spent, actions applied from AgentOps
                      Assist queue for approval instead of applying.{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {actions24h}
                      </span>{" "}
                      used today ({budgetUsed}%).
                    </FieldDescription>
                  </Field>

                  <FieldSeparator />

                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>
                        Require approval for high-risk actions
                      </FieldTitle>
                      <FieldDescription>
                        High-risk suggested actions in AgentOps Assist queue for
                        a human instead of applying.
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      checked={settings.requireApprovalForHighRisk}
                      onCheckedChange={(v) =>
                        updateSettings({ requireApprovalForHighRisk: v })
                      }
                      aria-label="Require approval for high-risk actions"
                    />
                  </Field>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>Redact personal data</FieldTitle>
                      <FieldDescription>
                        E-mail addresses, phone numbers and IBANs in a prompt
                        are masked before AgentOps Assist processes it.
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      checked={settings.piiRedaction}
                      onCheckedChange={(v) =>
                        updateSettings({ piiRedaction: v })
                      }
                      aria-label="Redact personal data"
                    />
                  </Field>
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>Show reasoning in chat</FieldTitle>
                      <FieldDescription>
                        Display the assistant&apos;s thinking before each
                        answer.
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      checked={settings.showReasoning}
                      onCheckedChange={(v) =>
                        updateSettings({ showReasoning: v })
                      }
                      aria-label="Show reasoning in chat"
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Allowed tools</CardTitle>
                  <CardDescription>
                    Capability categories AgentOps Assist may use. Unchecked
                    categories are skipped in its runs and shown as such.
                  </CardDescription>
                  <CardAction>
                    <CountPill
                      count={`${settings.allowedTools.length} / ${toolCatalog.length}`}
                      size="default"
                      label="allowed"
                    />
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-col divide-y">
                  {toolCatalog.map((t) => {
                    const on = settings.allowedTools.includes(t.id)
                    return (
                      <label
                        key={t.id}
                        className="flex cursor-pointer items-start gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <Checkbox
                          checked={on}
                          onCheckedChange={(v) =>
                            updateSettings({
                              allowedTools: v
                                ? [...settings.allowedTools, t.id]
                                : settings.allowedTools.filter(
                                    (x) => x !== t.id
                                  ),
                            })
                          }
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            {t.label}
                            <Badge
                              variant="outline"
                              className={cn(
                                "h-4.5 px-1.5 text-3xs",
                                riskTone[t.risk]
                              )}
                            >
                              {t.risk} risk
                            </Badge>
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {t.description}
                          </span>
                        </span>
                        <code className="hidden shrink-0 pt-0.5 font-mono text-3xs text-muted-foreground sm:block">
                          {t.id}
                        </code>
                      </label>
                    )
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Usage</CardTitle>
                  <CardDescription>
                    Enabled agents, last 24 hours
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2">
                  <MetricTile
                    label="Runs"
                    value={enabled
                      .reduce((a, x) => a + x.runs24h, 0)
                      .toLocaleString("en-US")}
                  />
                  <MetricTile
                    label="Tokens"
                    value={formatNumber(tokens24h, true)}
                  />
                  <MetricTile
                    label="Avg latency"
                    value={formatDurationMs(
                      Math.round(
                        agentRuns.reduce((a, r) => a + r.durationMs, 0) /
                          agentRuns.length
                      )
                    )}
                    hint="Across the sampled runs"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  )
}
