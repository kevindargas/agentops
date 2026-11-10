"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  ArrowRightIcon,
  CheckIcon,
  Link2Icon,
  RotateCcwIcon,
  RocketIcon,
  SaveIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ModelSelectorLogo } from "@/components/ai-elements/model-selector"
import { StateBadge } from "@/components/shared/status-badge"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { modelDisplayName } from "@/features/agentops/format"
import { models, providerMeta, type ModelProvider } from "@/lib/ai/agents"
import { deployedAgents, getDeployedAgent } from "@/lib/data"
import {
  cloneParams,
  configToSearchParams,
  diffParams,
  promptVersionOptions,
  type PlaygroundConfig,
} from "@/lib/data/playground"
import { ParamEditor } from "./param-editor"

export interface ConfigPanelProps {
  config: PlaygroundConfig
  onChange: (next: PlaygroundConfig) => void
  /** Column label shown in compare mode. */
  label?: "A" | "B"
  className?: string
}

const byProvider = (() => {
  const groups = new Map<ModelProvider, typeof models>()
  for (const m of models)
    groups.set(m.provider, [...(groups.get(m.provider) ?? []), m])
  return [...groups.entries()]
})()

const modelItems = models
  .filter((m) => m.openRouterId)
  .map((m) => ({ value: m.openRouterId as string, label: m.name }))

const agentItems = deployedAgents.map((a) => ({ value: a.id, label: a.name }))

/**
 * Left-hand "Configuration" panel for the playground: agent, prompt version,
 * model and the full parameter editor, plus a diff against what is deployed
 * and the promote / share actions.
 */
export function ConfigPanel({
  config,
  onChange,
  label,
  className,
}: ConfigPanelProps) {
  const id = React.useId()
  const agent = getDeployedAgent(config.agentId) ?? deployedAgents[0]
  const pvOptions = React.useMemo(() => promptVersionOptions(agent), [agent])
  const pvItems = React.useMemo(
    () =>
      pvOptions.some((o) => o.value === config.promptVersion)
        ? pvOptions
        : [
            ...pvOptions,
            { value: config.promptVersion, label: config.promptVersion },
          ],
    [pvOptions, config.promptVersion]
  )

  const paramDiff = diffParams(config.params, agent.params)
  const modelChanged = config.modelId !== agent.modelId
  const pvChanged = config.promptVersion !== agent.promptVersion
  const diffCount =
    paramDiff.length + (modelChanged ? 1 : 0) + (pvChanged ? 1 : 0)

  const reset = () =>
    onChange({
      ...config,
      modelId: agent.modelId,
      promptVersion: agent.promptVersion,
      params: cloneParams(agent.params),
    })

  const share = async () => {
    const sp = configToSearchParams(config)
    const url = `${window.location.origin}/agentops/playground?${sp.toString()}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Share link copied", {
        description: "Anyone with the link opens this exact configuration.",
      })
    } catch {
      toast("Share link", { description: url })
    }
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {label && (
        <div className="flex items-center gap-2">
          <ColumnBadge label={label} />
          <span className="text-xs text-muted-foreground">
            Editing configuration {label}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-agent`} className="text-xs font-medium">
          Agent
        </Label>
        <Select
          value={config.agentId}
          onValueChange={(v) => {
            const next = getDeployedAgent(String(v))
            if (!next) return
            onChange({
              agentId: next.id,
              promptVersion: next.promptVersion,
              modelId: next.modelId,
              params: cloneParams(next.params),
            })
          }}
          items={agentItems}
        >
          <SelectTrigger id={`${id}-agent`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {deployedAgents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{a.name}</span>
                  <StateBadge state={a.environment} size="sm" />
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          {agent.version} · {agent.framework} ·{" "}
          <Link
            href={`/agentops/agents/${agent.id}`}
            className="hover:text-foreground hover:underline"
          >
            open record
          </Link>
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-pv`} className="text-xs font-medium">
          Prompt version
        </Label>
        <Select
          value={config.promptVersion}
          onValueChange={(v) =>
            onChange({ ...config, promptVersion: String(v) })
          }
          items={pvItems}
        >
          <SelectTrigger id={`${id}-pv`} className="w-full font-mono text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pvItems.map((o) => (
              <SelectItem
                key={o.value}
                value={o.value}
                className="font-mono text-xs"
              >
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-model`} className="text-xs font-medium">
          Model
        </Label>
        <Select
          value={config.modelId}
          onValueChange={(v) => onChange({ ...config, modelId: String(v) })}
          items={modelItems}
        >
          <SelectTrigger id={`${id}-model`} className="w-full">
            <SelectValue>
              {(value: string) => <ModelValue modelId={value} />}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="w-(--anchor-width)">
            {byProvider.map(([provider, list]) => (
              <SelectGroup key={provider}>
                <SelectLabel className="flex items-center gap-1.5">
                  <ModelSelectorLogo
                    provider={providerMeta[provider].logo}
                    className="size-3"
                  />
                  {providerMeta[provider].label}
                </SelectLabel>
                {list.map((m) => (
                  <SelectItem key={m.id} value={m.openRouterId ?? m.id}>
                    <span className="flex w-full min-w-0 items-center gap-2">
                      <span className="truncate">{m.name}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground capitalize">
                        {m.tier}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <ParamEditor
        value={config.params}
        onChange={(params) => onChange({ ...config, params })}
        baseline={agent.params}
        density="compact"
      />

      <Separator />

      <DiffVsDeployed
        agentName={agent.name}
        promptVersion={agent.promptVersion}
        modelId={agent.modelId}
        config={config}
        paramDiff={paramDiff}
      />

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={reset}
          disabled={diffCount === 0}
        >
          <RotateCcwIcon /> Reset to deployed
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            toast.success(
              `Saved as ${nextDraftVersion(config.promptVersion)}`,
              {
                description: `Draft prompt version for ${agent.name} with these parameters.`,
              }
            )
          }
        >
          <SaveIcon /> Save as version
        </Button>
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button size="sm" disabled={diffCount === 0} />}
          >
            <RocketIcon /> Apply to agent
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Apply configuration to {agent.name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This updates the <strong>{agent.environment}</strong> deployment
                ({agent.version}) in place. {diffCount}{" "}
                {diffCount === 1 ? "setting differs" : "settings differ"} from
                what is deployed. Traffic is not re-split; the change is
                recorded in the agent&apos;s activity.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="max-h-40 overflow-y-auto rounded-md border bg-muted/30 px-3 py-2 text-xs">
              {modelChanged && (
                <DiffRow
                  label="Model"
                  from={modelDisplayName(agent.modelId)}
                  to={modelDisplayName(config.modelId)}
                />
              )}
              {pvChanged && (
                <DiffRow
                  label="Prompt"
                  from={agent.promptVersion}
                  to={config.promptVersion}
                />
              )}
              {paramDiff.map((d) => (
                <DiffRow key={d.key} label={d.label} from={d.from} to={d.to} />
              ))}
            </ul>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  toast.success(`Applied to ${agent.name}`, {
                    description: `${agent.environment} · ${agent.version} now runs ${modelDisplayName(config.modelId)} with ${diffCount} changed ${diffCount === 1 ? "setting" : "settings"}.`,
                  })
                }
              >
                <CheckIcon /> Apply to {agent.environment}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button variant="outline" size="sm" onClick={share}>
          <Link2Icon /> Share link
        </Button>
      </div>
    </div>
  )
}

function nextDraftVersion(pv: string) {
  const n = Number(pv.replace(/\D/g, "")) || 0
  return `p-${n + 1}-draft`
}

function ModelValue({ modelId }: { modelId: string }) {
  const m = models.find((x) => x.openRouterId === modelId)
  const provider = m ? providerMeta[m.provider] : undefined
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {provider && (
        <ModelSelectorLogo provider={provider.logo} className="size-3" />
      )}
      <span className="truncate">{m?.name ?? modelDisplayName(modelId)}</span>
    </span>
  )
}

export function ColumnBadge({
  label,
  className,
}: {
  label: "A" | "B"
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 min-w-5 justify-center px-1.5 font-mono text-[11px] font-semibold",
        label === "A"
          ? "border-chart-1/40 bg-chart-1/10 text-chart-1"
          : "border-chart-2/40 bg-chart-2/10 text-chart-2",
        className
      )}
    >
      {label}
    </Badge>
  )
}

function DiffRow({
  label,
  from,
  to,
}: {
  label: string
  from: string
  to: string
}) {
  return (
    <li className="flex items-center justify-between gap-2 py-1 tabular-nums">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 font-mono">
        <span className="truncate text-muted-foreground line-through">
          {from}
        </span>
        <ArrowRightIcon className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{to}</span>
      </span>
    </li>
  )
}

export function DiffVsDeployed({
  agentName,
  promptVersion,
  modelId,
  config,
  paramDiff,
}: {
  agentName: string
  promptVersion: string
  modelId: string
  config: PlaygroundConfig
  paramDiff: ReturnType<typeof diffParams>
}) {
  const modelChanged = config.modelId !== modelId
  const pvChanged = config.promptVersion !== promptVersion
  const total = paramDiff.length + (modelChanged ? 1 : 0) + (pvChanged ? 1 : 0)
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">Diff vs deployed</span>
        <Badge
          variant={total ? "default" : "outline"}
          className="h-5 px-1.5 text-[10px] tabular-nums"
        >
          {total ? `${total} changed` : "in sync"}
        </Badge>
      </div>
      {total > 0 ? (
        <ul className="mt-1.5 text-xs">
          {modelChanged && (
            <DiffRow
              label="Model"
              from={modelDisplayName(modelId)}
              to={modelDisplayName(config.modelId)}
            />
          )}
          {pvChanged && (
            <DiffRow
              label="Prompt"
              from={promptVersion}
              to={config.promptVersion}
            />
          )}
          {paramDiff.map((d) => (
            <DiffRow key={d.key} label={d.label} from={d.from} to={d.to} />
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Matches what {agentName} runs in production.
        </p>
      )}
    </div>
  )
}
