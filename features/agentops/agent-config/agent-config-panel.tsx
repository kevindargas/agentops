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
  PencilIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  WalletIcon,
  WrenchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { fmtCost, fmtTokens } from "@/features/agentops/format"
import { DiffVsDeployed } from "@/features/agentops/playground/config-panel"
import { ParamEditor } from "@/features/agentops/playground/param-editor"
import { KindBadge } from "@/features/agentops/semantic-layer"
import { ModelChip } from "@/features/agentops/shared"
import { autonomyMeta, type Autonomy } from "@/lib/ai/agents"
import { getSemanticEntity } from "@/lib/data"
import {
  cloneParams,
  diffParams,
  getAgentOpsConfig,
  paramFields,
} from "@/lib/data/playground"
import type { DeployedAgent, ModelParams } from "@/lib/types"

export interface AgentConfigPanelProps {
  agent: DeployedAgent
  /** Where the prompt version chip links to. */
  promptHref: string
  className?: string
}

const autonomyOrder: Autonomy[] = ["suggest", "approve", "autonomous"]

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
  const agentQuery = `?agent=${agent.id}`

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
    Math.round((agent.metrics.costPerDay / ops.budgets.dailyCostCap) * 100)
  )

  return (
    <div className={cn("grid gap-4 lg:grid-cols-2", className)}>
      <ConfigCard
        title="Model & generation"
        icon={<SlidersHorizontalIcon />}
        className="lg:col-span-2"
        action={
          <div className="flex items-center gap-2">
            {diffFromDeployed.length > 0 && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
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
                  <span className="ml-1.5 font-mono text-[11px] text-muted-foreground line-through">
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
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            deployed
          </Badge>
          <span className="text-xs text-muted-foreground">
            Golden set{" "}
            <code className="rounded-sm bg-muted px-1 font-mono text-[11px]">
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
          <MoreLink href={`/agentops/tools${agentQuery}`}>
            Tool registry
          </MoreLink>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {agent.tools.map((t) => (
            <Link
              key={t}
              href={`/agentops/tools?tool=${t}`}
              className="inline-flex h-6 items-center gap-1 rounded-md border bg-muted/40 px-2 font-mono text-[11px] hover:bg-muted"
            >
              {t}
              <ArrowUpRightIcon className="size-3 text-muted-foreground" />
            </Link>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Tool choice <span className="font-mono">{params.toolChoice}</span>,{" "}
          {params.parallelToolCalls ? "parallel calls on" : "sequential calls"},
          budget {params.maxToolCalls} calls per run.
        </p>
      </ConfigCard>

      <ConfigCard title="Autonomy level" icon={<BotIcon />}>
        <RadioGroup
          value={autonomy}
          onValueChange={(v) => {
            const next = v as Autonomy
            setAutonomy(next)
            toast.success(`Autonomy set to ${autonomyMeta[next].label}`, {
              description:
                next === "autonomous"
                  ? "Every action is logged for review."
                  : "Pending actions will show up in the review queue.",
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
        action={
          <MoreLink href={`/agentops/costs${agentQuery}`}>Costs</MoreLink>
        }
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Setting label="Daily cost cap">
            <span className="font-mono tabular-nums">
              {fmtCost(ops.budgets.dailyCostCap, 0)}
            </span>
          </Setting>
          <Setting label="Today">
            <span className="font-mono tabular-nums">
              {fmtCost(agent.metrics.costPerDay, 0)}
            </span>
            <span className="ml-1 text-xs text-muted-foreground tabular-nums">
              {budgetUsed}% of cap
            </span>
          </Setting>
          <Setting label="Month to date">
            <span className="font-mono tabular-nums">
              {fmtCost(ops.budgets.monthToDate, 0)}
            </span>
          </Setting>
          <Setting label="Max tokens / run">
            <span className="font-mono tabular-nums">
              {fmtTokens(ops.budgets.maxTokensPerRun)}
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
        title="Guardrails"
        icon={<ShieldCheckIcon />}
        count={ops.guardrails.length}
        action={
          <MoreLink href={`/agentops/guardrails${agentQuery}`}>Manage</MoreLink>
        }
      >
        <ul className="flex flex-wrap gap-1.5">
          {ops.guardrails.map((g) => (
            <li key={g}>
              <Badge
                variant="outline"
                className="h-6 gap-1 border-success/30 bg-success/5 px-2 text-xs text-success-text"
              >
                <CheckIcon className="size-3" /> {g}
              </Badge>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Evaluated on every input and output; violations are blocked and routed
          to the review queue.
        </p>
      </ConfigCard>

      <ConfigCard
        title="Knowledge sources"
        icon={<BookOpenIcon />}
        count={ops.knowledgeSources.length + agent.semanticEntityIds.length}
        action={
          <MoreLink href={`/agentops/knowledge${agentQuery}`}>
            Knowledge
          </MoreLink>
        }
      >
        <ul className="flex flex-wrap gap-1.5">
          {ops.knowledgeSources.map((k) => (
            <li key={k}>
              <Link
                href={`/agentops/knowledge?agent=${agent.id}&source=${encodeURIComponent(k)}`}
                className="inline-flex h-6 items-center rounded-md border bg-muted/40 px-2 text-xs hover:bg-muted"
              >
                {k}
              </Link>
            </li>
          ))}
        </ul>
        {agent.semanticEntityIds.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Semantic layer
            </p>
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
          <MoreLink href={`/agentops/schedules${agentQuery}`}>
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

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle>Edit generation parameters</SheetTitle>
            <SheetDescription>
              {agent.name} · {agent.environment} {agent.version}. The same
              editor as the playground; changes apply to new runs.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4">
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
          </div>
          <SheetFooter className="flex-row justify-between border-t px-5 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDraft(cloneParams(agent.params))}
            >
              <RotateCcwIcon /> Reset to deployed
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={save}>
                <CheckIcon /> Save
              </Button>
            </div>
          </SheetFooter>
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
          {count !== undefined && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
              {count}
            </span>
          )}
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
      <dt
        className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
        title={hint}
      >
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
