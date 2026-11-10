"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  ArrowUpRightIcon,
  BookOpenIcon,
  BotIcon,
  CalendarClockIcon,
  CheckIcon,
  FileTextIcon,
  OctagonXIcon,
  PencilIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  WalletIcon,
  WrenchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { CountPill } from "@/components/shared/count-pill"
import { Eyebrow } from "@/components/shared/eyebrow"
import {
  SheetBody,
  SheetFooterActions,
  sheetWidths,
} from "@/components/shared/sheet-frame"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { DiffVsDeployed } from "@/features/agentops/playground/config-panel"
import { ParamEditor } from "@/features/agentops/playground/param-editor"
import { KindBadge } from "@/features/agentops/semantic-layer"
import { ModelChip } from "@/features/agentops/shared"
import { autonomyMeta, type Autonomy } from "@/lib/ai/agents"
import { getAgentOpsConfig } from "@/lib/data/agent-config"
import { getSemanticEntity } from "@/lib/data/agentops"
import { spendTodayByAgent } from "@/lib/data/costs"
import { cloneParams, diffParams, paramFields } from "@/lib/data/playground"
import { formatCost, formatTokens } from "@/lib/format"
import type { DeployedAgent, ModelParams, RunLimits } from "@/lib/types"
import { PauseAgentDialog, resumeAgent, usePaused } from "./agent-actions"

export interface AgentConfigPanelProps {
  agent: DeployedAgent
  /** Where the prompt version chip links to. */
  promptHref: string
  className?: string
}

const autonomyOrder: Autonomy[] = ["suggest", "approve", "autonomous"]

/** Editable run bounds. Deadline is edited in seconds, stored in ms. */
const limitFields: {
  key: keyof RunLimits
  label: string
  hint: string
  unit: string
  min: number
  max: number
  step: number
  scale: number
}[] = [
  {
    key: "maxSteps",
    label: "Max steps",
    hint: "LLM + tool steps per run before the loop is aborted",
    unit: "steps",
    min: 1,
    max: 200,
    step: 1,
    scale: 1,
  },
  {
    key: "deadlineMs",
    label: "Deadline",
    hint: "Wall-clock budget per run",
    unit: "s",
    min: 5,
    max: 3600,
    step: 5,
    scale: 1000,
  },
  {
    key: "costBudgetUsd",
    label: "Cost budget",
    hint: "Spend per run before the loop is aborted",
    unit: "USD",
    min: 0.05,
    max: 50,
    step: 0.05,
    scale: 1,
  },
  {
    key: "noProgressSteps",
    label: "No-progress steps",
    hint: "Consecutive steps without new tool output or state change",
    unit: "steps",
    min: 1,
    max: 20,
    step: 1,
    scale: 1,
  },
]

const formatLimit = (f: (typeof limitFields)[number], l: RunLimits) =>
  f.key === "costBudgetUsd"
    ? formatCost(l.costBudgetUsd, 2)
    : `${Math.round(l[f.key] / f.scale)} ${f.unit}`

/**
 * "Configuration" tab of an agent record: model & generation parameters,
 * prompt, tools, autonomy, budgets, guardrails, knowledge and schedule. Edits
 * are local to the session and acknowledged with toasts.
 */
export function AgentConfigPanel({
  agent,
  promptHref,
  className,
}: AgentConfigPanelProps) {
  const ops = getAgentOpsConfig(agent.id)
  const [params, setParams] = React.useState<ModelParams>(() =>
    cloneParams(agent.params)
  )
  const [autonomy, setAutonomy] = React.useState<Autonomy>(ops.autonomy)
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState<ModelParams>(params)
  const diffFromDeployed = diffParams(params, agent.params)
  const spendToday = spendTodayByAgent(agent.id) || agent.metrics.costPerDay

  const openEditor = () => {
    setDraft(cloneParams(params))
    setEditing(true)
  }
  const save = () => {
    setParams(cloneParams(draft))
    setEditing(false)
    const n = diffParams(draft, params).length
    toast.success(
      n ? `Saved ${n} parameter ${n === 1 ? "change" : "changes"}` : "Saved",
      {
        description: `${agent.name} · ${agent.environment} ${agent.version}. Changes apply to new runs.`,
      }
    )
  }

  const budgetUsed = Math.min(
    100,
    Math.round((spendToday / ops.budgets.dailyCostCap) * 100)
  )

  const [limits, setLimits] = React.useState<RunLimits>(agent.limits)
  const [limitsDraft, setLimitsDraft] = React.useState<RunLimits>(agent.limits)
  const [editingLimits, setEditingLimits] = React.useState(false)
  const { paused, pausedReason } = usePaused(agent)
  const [confirmPause, setConfirmPause] = React.useState(false)
  const limitsDirty = limitFields.some(
    (f) => limitsDraft[f.key] !== limits[f.key]
  )
  const saveLimits = () => {
    setLimits(limitsDraft)
    setEditingLimits(false)
    toast.success("Run limits saved", {
      description: `${agent.name} · applies to new runs only; in-flight runs keep their current bounds.`,
    })
  }
  const togglePaused = (next: boolean) => {
    if (next) setConfirmPause(true)
    else resumeAgent(agent)
  }

  return (
    <div className={cn("grid gap-4 lg:grid-cols-2", className)}>
      <ConfigCard
        title="Model & generation"
        icon={<SlidersHorizontalIcon />}
        className="lg:col-span-2"
        action={
          <div className="flex items-center gap-2">
            {diffFromDeployed.length > 0 && (
              <Badge variant="outline" className="h-5 px-1.5 text-3xs">
                {diffFromDeployed.length} unsaved vs deployed
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/agentops/playground?agent=${agent.id}`} />}
            >
              Try in playground
            </Button>
            <Button size="sm" onClick={openEditor}>
              <PencilIcon /> Edit
            </Button>
          </div>
        }
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 xl:grid-cols-4">
          <Setting label="Model">
            <ModelChip modelId={agent.modelId} className="text-sm" />
          </Setting>
          <Setting label="Fallback">
            {agent.fallbackModelId ? (
              <ModelChip modelId={agent.fallbackModelId} className="text-sm" />
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </Setting>
          {paramFields.map((f) => {
            const changed = f.format(params) !== f.format(agent.params)
            return (
              <Setting key={f.key} label={f.label} hint={f.description}>
                <span
                  className={cn(
                    "font-mono text-[13px] tabular-nums",
                    changed && "text-brand"
                  )}
                >
                  {f.format(params)}
                </span>
                {changed && (
                  <span className="ml-1.5 font-mono text-2xs text-muted-foreground line-through">
                    {f.format(agent.params)}
                  </span>
                )}
              </Setting>
            )
          })}
        </dl>
      </ConfigCard>

      <ConfigCard
        title="Prompt"
        icon={<FileTextIcon />}
        action={<MoreLink href={promptHref}>Open prompt</MoreLink>}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={promptHref}
            className="inline-flex h-6 items-center rounded-md border bg-muted/40 px-2 font-mono text-xs hover:bg-muted"
          >
            {agent.promptVersion}
          </Link>
          <Badge variant="outline" className="h-5 px-1.5 text-3xs">
            deployed
          </Badge>
          <span className="text-xs text-muted-foreground">
            Golden set{" "}
            <code className="rounded-sm bg-muted px-1 font-mono text-2xs">
              {agent.evalDataset}
            </code>
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          System prompt, few-shot examples and output contract. Edit a copy as a
          new version and promote it through an experiment.
        </p>
      </ConfigCard>

      <ConfigCard
        title="Tools"
        icon={<WrenchIcon />}
        count={agent.tools.length}
        action={
          <MoreLink href="/agentops/tools?tab=permissions">
            Permissions
          </MoreLink>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {agent.tools.map((t) => (
            <Link
              key={t}
              href={`/agentops/tools?tool=${t}`}
              className="inline-flex h-6 items-center gap-1 rounded-md border bg-muted/40 px-2 font-mono text-2xs hover:bg-muted"
            >
              {t}
              <ArrowUpRightIcon className="size-3 text-muted-foreground" />
            </Link>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Tool choice <span className="font-mono">{params.toolChoice}</span>,{" "}
          {params.parallelToolCalls ? "parallel calls on" : "sequential calls"},
          budget {params.maxToolCalls} calls per run. Tool-level permissions
          live in the registry.
        </p>
      </ConfigCard>

      <ConfigCard title="Autonomy level" icon={<BotIcon />}>
        <RadioGroup
          value={autonomy}
          onValueChange={(v) => {
            const next = v as Autonomy
            setAutonomy(next)
            toast.success(`Autonomy set to ${autonomyMeta[next].label}`, {
              description: `${agent.name} · applies to new runs for this session.`,
            })
          }}
          aria-label="Autonomy level"
          className="gap-2"
        >
          {autonomyOrder.map((a) => (
            <Label
              key={a}
              htmlFor={`autonomy-${agent.id}-${a}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors has-data-checked:border-ring has-data-checked:bg-muted/40",
                "hover:bg-muted/30"
              )}
            >
              <RadioGroupItem
                id={`autonomy-${agent.id}-${a}`}
                value={a}
                className="mt-0.5"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{autonomyMeta[a].label}</span>
                <span className="text-xs leading-snug font-normal text-muted-foreground">
                  {autonomyMeta[a].description}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </ConfigCard>

      <ConfigCard
        title="Budgets"
        icon={<WalletIcon />}
        action={<MoreLink href="/agentops/costs?tab=budgets">Budgets</MoreLink>}
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Setting label="Daily cost cap">
            <span className="font-mono tabular-nums">
              {formatCost(ops.budgets.dailyCostCap, 0)}
            </span>
          </Setting>
          <Setting label="Today">
            <span className="font-mono tabular-nums">
              {formatCost(spendToday, 0)}
            </span>
            <span className="ml-1 text-xs text-muted-foreground tabular-nums">
              {budgetUsed}% of cap
            </span>
          </Setting>
          <Setting label="Month to date">
            <span className="font-mono tabular-nums">
              {formatCost(ops.budgets.monthToDate, 0)}
            </span>
          </Setting>
          <Setting label="Max tokens / run">
            <span className="font-mono tabular-nums">
              {formatTokens(ops.budgets.maxTokensPerRun)}
            </span>
          </Setting>
        </dl>
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-label="Daily budget used"
          aria-valuenow={budgetUsed}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn(
              "h-full rounded-full",
              budgetUsed >= 90
                ? "bg-destructive"
                : budgetUsed >= 70
                  ? "bg-warning"
                  : "bg-success"
            )}
            style={{ width: `${budgetUsed}%` }}
          />
        </div>
      </ConfigCard>

      <ConfigCard
        title="Run limits & kill switch"
        icon={<OctagonXIcon />}
        className="lg:col-span-2"
        action={
          editingLimits ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLimitsDraft(limits)
                  setEditingLimits(false)
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={saveLimits} disabled={!limitsDirty}>
                <CheckIcon /> Save
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLimitsDraft(limits)
                setEditingLimits(true)
              }}
            >
              <PencilIcon /> Edit limits
            </Button>
          )
        }
      >
        <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
          {editingLimits ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {limitFields.map((f) => {
                const id = `limit-${agent.id}-${f.key}`
                return (
                  <div key={f.key} className="min-w-0">
                    <Label htmlFor={id} className="eyebrow" title={f.hint}>
                      {f.label}
                    </Label>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Input
                        id={id}
                        type="number"
                        inputMode="decimal"
                        min={f.min}
                        max={f.max}
                        step={f.step}
                        value={limitsDraft[f.key] / f.scale}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          if (!Number.isFinite(n)) return
                          setLimitsDraft({
                            ...limitsDraft,
                            [f.key]:
                              Math.min(f.max, Math.max(f.min, n)) * f.scale,
                          })
                        }}
                        className="h-8 font-mono text-[13px] tabular-nums"
                      />
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {f.unit}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              {limitFields.map((f) => {
                const changed = limits[f.key] !== agent.limits[f.key]
                return (
                  <Setting key={f.key} label={f.label} hint={f.hint}>
                    <span
                      className={cn(
                        "font-mono text-[13px] tabular-nums",
                        changed && "text-brand"
                      )}
                    >
                      {formatLimit(f, limits)}
                    </span>
                    {changed && (
                      <span className="ml-1.5 font-mono text-2xs text-muted-foreground line-through">
                        {formatLimit(f, agent.limits)}
                      </span>
                    )}
                  </Setting>
                )
              })}
            </dl>
          )}
          <div
            className={cn(
              "flex items-start justify-between gap-3 rounded-lg border p-3",
              paused
                ? "border-warning/40 bg-warning/5"
                : "border-border bg-muted/30"
            )}
          >
            <div className="min-w-0">
              <Label
                htmlFor={`paused-${agent.id}`}
                className="text-sm font-medium"
              >
                {paused ? "Paused" : "Accepting runs"}
              </Label>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                {paused
                  ? (pausedReason ??
                    "Paused from this console. Resume to accept new runs.")
                  : "Pause to stop new runs immediately. In-flight runs finish; schedules and triggers are skipped."}
              </p>
            </div>
            <Switch
              id={`paused-${agent.id}`}
              checked={paused}
              onCheckedChange={togglePaused}
              aria-label={paused ? "Resume agent" : "Pause agent"}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          A run that hits any bound ends with outcome{" "}
          <span className="font-mono">partial</span> or{" "}
          <span className="font-mono">timeout</span> and the bound is recorded
          on the trace. Fleet-wide kill switch and write freeze live on the
          fleet overview.
        </p>
      </ConfigCard>

      <ConfigCard
        title="Guardrails"
        icon={<ShieldCheckIcon />}
        count={ops.guardrailIds.length}
        action={
          <MoreLink href="/agentops/guardrails?tab=policies">Policies</MoreLink>
        }
      >
        <ul className="flex flex-wrap gap-1.5">
          {ops.guardrailIds.map((id, i) => (
            <li key={id}>
              <Link
                href={`/agentops/guardrails?policy=${id}`}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-success/30 bg-success/5 px-2 text-xs text-success-text hover:bg-success/10"
              >
                <CheckIcon className="size-3" /> {ops.guardrails[i]}
              </Link>
            </li>
          ))}
          {ops.guardrailIds.length === 0 && (
            <li className="text-xs text-muted-foreground">
              No active policy covers this agent.
            </li>
          )}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Evaluated on every input and output; violations are blocked and routed
          to the review queue.
        </p>
      </ConfigCard>

      <ConfigCard
        title="Knowledge sources"
        icon={<BookOpenIcon />}
        count={ops.knowledgeBaseIds.length + agent.semanticEntityIds.length}
        action={
          <MoreLink href="/agentops/knowledge?tab=bases">Knowledge</MoreLink>
        }
      >
        <ul className="flex flex-wrap gap-1.5">
          {ops.knowledgeBaseIds.map((id, i) => (
            <li key={id}>
              <Link
                href={`/agentops/knowledge?tab=bases&kb=${id}`}
                className="inline-flex h-6 items-center rounded-md border bg-muted/40 px-2 text-xs hover:bg-muted"
              >
                {ops.knowledgeSources[i]}
              </Link>
            </li>
          ))}
          {ops.knowledgeBaseIds.length === 0 && (
            <li className="text-xs text-muted-foreground">
              No knowledge base grants this agent access.
            </li>
          )}
        </ul>
        {agent.semanticEntityIds.length > 0 && (
          <div className="mt-3">
            <Eyebrow className="mb-1.5">Semantic layer</Eyebrow>
            <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
              {agent.semanticEntityIds.map((sid) => {
                const e = getSemanticEntity(sid)
                return e ? (
                  <li key={sid}>
                    <Link
                      href={`/agentops/semantic-layer?entity=${sid}`}
                      className="inline-flex items-center gap-1 text-xs hover:underline"
                    >
                      <KindBadge kind={e.kind} />
                      {e.name}
                    </Link>
                  </li>
                ) : null
              })}
            </ul>
          </div>
        )}
      </ConfigCard>

      <ConfigCard
        title="Schedule"
        icon={<CalendarClockIcon />}
        action={
          <MoreLink href="/agentops/schedules?tab=schedules">
            Schedules
          </MoreLink>
        }
      >
        <p className="text-sm font-medium">{ops.schedule.label}</p>
        <p className="text-xs text-muted-foreground">{ops.schedule.detail}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Timeout{" "}
          <span className="font-mono tabular-nums">
            {Math.round(params.timeoutMs / 1000)} s
          </span>{" "}
          · retries{" "}
          <span className="font-mono tabular-nums">{params.maxRetries}</span>
        </p>
      </ConfigCard>

      <PauseAgentDialog
        agent={agent}
        open={confirmPause}
        onOpenChange={setConfirmPause}
      />

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent
          className={cn(sheetWidths.detail, "flex flex-col gap-0 p-0")}
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Edit generation parameters</SheetTitle>
            <SheetDescription>
              {agent.name} · {agent.environment} {agent.version}. The same
              editor as the playground; changes apply to new runs.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <ParamEditor
              value={draft}
              onChange={setDraft}
              baseline={agent.params}
            />
            <div className="mt-5">
              <DiffVsDeployed
                agentName={agent.name}
                promptVersion={agent.promptVersion}
                modelId={agent.modelId}
                config={{
                  agentId: agent.id,
                  promptVersion: agent.promptVersion,
                  modelId: agent.modelId,
                  params: draft,
                }}
                paramDiff={diffParams(draft, agent.params)}
              />
            </div>
          </SheetBody>
          <SheetFooterActions
            tertiary={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDraft(cloneParams(agent.params))}
              >
                <RotateCcwIcon /> Reset to deployed
              </Button>
            }
            primary={
              <Button onClick={save}>
                <CheckIcon /> Save
              </Button>
            }
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}

/* ------------------------------------------------------------------------ */

function ConfigCard({
  title,
  icon,
  count,
  action,
  className,
  children,
}: {
  title: string
  icon?: React.ReactNode
  count?: number
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={cn("rounded-xl border bg-card", className)}
      aria-label={title}
    >
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          {icon && (
            <span className="text-muted-foreground [&_svg]:size-3.5">
              {icon}
            </span>
          )}
          {title}
          {count !== undefined && <CountPill count={count} />}
        </h3>
        {action}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  )
}

function Setting({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate eyebrow" title={hint}>
        {label}
      </dt>
      <dd className="mt-0.5 flex min-w-0 items-center text-sm">{children}</dd>
    </div>
  )
}

function MoreLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs text-muted-foreground"
      render={<Link href={href} />}
    >
      {children} <ArrowUpRightIcon />
    </Button>
  )
}
