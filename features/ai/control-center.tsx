"use client"

import Link from "next/link"
import { cn } from "cn"
import {
  ArrowUpRightIcon,
  BotIcon,
  CheckCheckIcon,
  ClockIcon,
  CoinsIcon,
  HistoryIcon,
  LayersIcon,
  PauseIcon,
  PlayIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TimerIcon,
  ZapIcon,
} from "lucide-react"

import { AgentAvatar, AgentCard } from "@/components/ai/agent-card"
import { useAi } from "@/components/ai/ai-provider"
import { ProposalCard } from "@/components/ai/proposal-card"
import { Sparkline } from "@/components/charts/sparkline"
import { StackedBarChart } from "@/components/charts/stacked-bar-chart"
import { EmptyState } from "@/components/shared/empty-state"
import { StatCard } from "@/components/shared/stat-card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  agentRuns,
  autonomyMeta,
  getAgent,
  models,
  runOutcomeMeta,
  toolCatalog,
  usageByDay,
  type Autonomy,
} from "@/lib/ai/agents"
import { formatNumber, timeAgo } from "@/lib/format"

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
  high: "border-destructive/30 text-destructive",
}

function fmtDuration(ms: number) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

/** Header actions for the AI Control Center page. */
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

export function ControlCenter() {
  const {
    agents,
    updateAgent,
    proposals,
    decide,
    activity,
    settings,
    updateSettings,
  } = useAi()
  const enabled = agents.filter((a) => a.enabled)
  const actions24h = enabled.reduce((a, x) => a + x.actions24h, 0)
  const saved = enabled.reduce(
    (a, x) => a + x.actions24h * x.avgSavedMinutes,
    0
  )
  const acceptance = Math.round(
    agents.reduce((a, x) => a + x.acceptanceRate, 0) / agents.length
  )
  const degraded = agents.filter((a) => a.health === "Degraded").length
  const tokens24h = agentRuns.reduce((a, r) => a + r.tokens, 0) * 9 // scaled from the sample of runs
  const budgetUsed = Math.min(
    100,
    Math.round((actions24h / settings.dailyActionBudget) * 100)
  )

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Agent actions · 24h"
          value={actions24h.toLocaleString()}
          delta={9}
          icon={<BotIcon />}
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
          icon={<ShieldCheckIcon />}
          hint={
            proposals.length
              ? `Oldest ${timeAgo(proposals[proposals.length - 1].created)}`
              : "Queue is clear"
          }
        />
        <StatCard
          label="Acceptance rate"
          value={`${acceptance}%`}
          delta={2}
          icon={<CheckCheckIcon />}
          hint="Proposals approved or left unchanged"
        />
        <StatCard
          label="Time saved · 24h"
          value={`${Math.round(saved / 60)}h`}
          delta={14}
          icon={<TimerIcon />}
          hint={`≈ ${formatNumber(tokens24h, true)} tokens · ${budgetUsed}% of daily budget`}
        />
      </div>

      <Tabs defaultValue="agents" className="gap-4">
        <TabsList>
          <TabsTrigger value="agents">
            <BotIcon /> Agents
          </TabsTrigger>
          <TabsTrigger value="queue">
            <ShieldCheckIcon /> Approval queue
            {proposals.length > 0 && (
              <span className="ml-0.5 rounded-full bg-brand px-1.5 text-[10px] font-semibold text-brand-foreground tabular-nums">
                {proposals.length}
              </span>
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
              description="Agents set to “act with approval” will queue their proposed changes here."
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
                        <div
                          key={impact}
                          className="rounded-lg border px-2.5 py-2"
                        >
                          <p className="text-[11px] text-muted-foreground capitalize">
                            {impact} impact
                          </p>
                          <p
                            className={cn(
                              "text-lg font-semibold tabular-nums",
                              impact === "high" && n > 0 && "text-destructive"
                            )}
                          >
                            {n}
                          </p>
                        </div>
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
                    Approving applies the change immediately and logs it to the
                    audit trail. Rejections are fed back to the agent as
                    training signal.
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
                  Every agent invocation with its outcome, duration and cost
                </CardDescription>
                <CardAction>
                  <Badge variant="secondary" className="tabular-nums">
                    {agentRuns.length} runs
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow className="**:[th]:h-9 **:[th]:text-xs">
                      <TableHead className="pl-4">Agent</TableHead>
                      <TableHead>Run</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Trigger
                      </TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                      <TableHead className="hidden text-right md:table-cell">
                        Tokens
                      </TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead className="pr-4 text-right">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentRuns.map((r) => {
                      const agent = getAgent(r.agentId)
                      const meta = runOutcomeMeta[r.outcome]
                      return (
                        <TableRow key={r.id} className="**:[td]:py-2.5">
                          <TableCell className="pl-4">
                            <span className="flex items-center gap-2">
                              <AgentAvatar agentId={r.agentId} size="xs" />
                              <span className="hidden truncate text-sm xl:inline">
                                {agent?.name}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[320px]">
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
                                <span className="font-mono">—</span>
                              )}
                              <span>
                                {r.toolCalls} tool call
                                {r.toolCalls === 1 ? "" : "s"}
                              </span>
                            </p>
                          </TableCell>
                          <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                            {r.trigger}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {fmtDuration(r.durationMs)}
                          </TableCell>
                          <TableCell className="hidden text-right text-xs tabular-nums md:table-cell">
                            {formatNumber(r.tokens, true)}
                          </TableCell>
                          <TableCell>
                            <StateBadge
                              state={meta.state}
                              className="h-[18px] px-1.5 text-[10px]"
                            />
                          </TableCell>
                          <TableCell className="pr-4 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                            {timeAgo(r.startedAt)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
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
                  <CardTitle>Audit log</CardTitle>
                  <CardDescription>
                    Who approved what, and whether it was undone
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
                        className="h-[18px] shrink-0 px-1.5 text-[10px]"
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
                  Defaults applied to new agents and the assistant.
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
                      {autonomyMeta[settings.defaultAutonomy].description}
                    </FieldDescription>
                  </Field>

                  <Field>
                    <div className="flex items-center justify-between">
                      <FieldLabel htmlFor="budget">
                        Daily action budget
                      </FieldLabel>
                      <span className="text-sm tabular-nums">
                        {settings.dailyActionBudget.toLocaleString()} actions
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
                      Agents pause and ask for review once the budget is spent.{" "}
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
                        Notifications, closures and deletions always queue for a
                        human, even on autonomous agents.
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
                        Strip names, bank details and IDs before sending content
                        to the model.
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
                    Capabilities agents may use. Disabled tools are hidden from
                    every agent.
                  </CardDescription>
                  <CardAction>
                    <Badge variant="secondary" className="tabular-nums">
                      {settings.allowedTools.length} / {toolCatalog.length}
                    </Badge>
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
                                "h-[18px] px-1.5 text-[10px]",
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
                        <code className="hidden shrink-0 pt-0.5 font-mono text-[10px] text-muted-foreground sm:block">
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
                    Where the budget went in the last 24 hours
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2">
                  {[
                    {
                      icon: ZapIcon,
                      label: "Runs",
                      value: agents
                        .reduce((a, x) => a + x.runs24h, 0)
                        .toLocaleString(),
                    },
                    {
                      icon: CoinsIcon,
                      label: "Tokens",
                      value: formatNumber(tokens24h, true),
                    },
                    {
                      icon: TimerIcon,
                      label: "Avg. latency",
                      value: fmtDuration(
                        Math.round(
                          agentRuns.reduce((a, r) => a + r.durationMs, 0) /
                            agentRuns.length
                        )
                      ),
                    },
                  ].map(({ icon: Icon, label, value }) => (
                    <Tooltip key={label}>
                      <TooltipTrigger
                        render={
                          <div className="rounded-lg border px-2.5 py-2" />
                        }
                      >
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Icon className="size-3" /> {label}
                        </p>
                        <p className="text-base font-semibold tabular-nums">
                          {value}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent>
                        Across all enabled agents, last 24 hours
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  )
}
