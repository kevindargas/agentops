"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import { ArrowUpRightIcon, ChevronDownIcon, PinOffIcon } from "lucide-react"

import { ModelSelectorLogo } from "@/components/ai-elements/model-selector"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  models,
  providerMeta,
  tierMeta,
  type AiModel,
  type ModelProvider,
} from "@/lib/ai/agents"
import { providerLabel, providerLogo } from "@/lib/ai/openrouter"
import { useAi, type AiSettings } from "./ai-provider"

/** Shape every picker option is reduced to, whether curated or pinned from the catalog. */
export interface PickerModel {
  id: string
  name: string
  description: string
  tier?: AiModel["tier"]
  contextK?: number
  /** models.dev logo slug. */
  logo: string
  providerLabel: string
  source: "curated" | "catalog"
}

function toPicker(m: AiModel): PickerModel {
  const p = providerMeta[m.provider]
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    tier: m.tier,
    contextK: m.contextK,
    logo: p.logo,
    providerLabel: p.label,
    source: "curated",
  }
}

/** Resolve the active model from settings, falling back to the default curated model. */
export function resolveModel(settings: AiSettings): PickerModel {
  const curated = models.find((m) => m.id === settings.modelId)
  if (curated) return toPicker(curated)
  const pinned = settings.catalogModel
  if (pinned && pinned.id === settings.modelId) {
    return {
      id: pinned.id,
      name: pinned.name,
      description: pinned.description,
      logo: providerLogo(pinned.provider),
      providerLabel: providerLabel(pinned.provider),
      source: "catalog",
    }
  }
  return toPicker(models[1])
}

const tierTone: Record<AiModel["tier"], string> = {
  reasoning: "border-brand/30 bg-brand/10 text-brand",
  balanced: "border-border bg-muted text-foreground",
  fast: "border-success/30 bg-success/10 text-success-text",
}

export function TierBadge({
  tier,
  className,
}: {
  tier: AiModel["tier"]
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-4 px-1.5 text-[10px] font-medium",
        tierTone[tier],
        className
      )}
    >
      {tierMeta[tier].label}
    </Badge>
  )
}

export function ProviderLogo({
  logo,
  className,
}: {
  logo: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-md border bg-background",
        className
      )}
    >
      <ModelSelectorLogo provider={logo} className="size-3" />
    </span>
  )
}

interface ModelPickerProps {
  /** `compact` fits inside the composer toolbar; `default` is a regular bordered trigger. */
  variant?: "compact" | "default"
  align?: "start" | "end"
  className?: string
}

/**
 * Dropdown for choosing the assistant model. Groups curated models by vendor,
 * shows a one-line description per option, and surfaces any model pinned from
 * the live catalog.
 */
export function ModelPicker({
  variant = "default",
  align = "start",
  className,
}: ModelPickerProps) {
  const { settings, updateSettings } = useAi()
  const current = resolveModel(settings)
  const pinned = settings.catalogModel

  const byProvider = React.useMemo(() => {
    const groups = new Map<ModelProvider, AiModel[]>()
    for (const m of models)
      groups.set(m.provider, [...(groups.get(m.provider) ?? []), m])
    return [...groups.entries()]
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Model: ${current.name}`}
        render={
          <button
            type="button"
            className={cn(
              "group/model inline-flex items-center gap-1.5 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              variant === "compact"
                ? "h-6 max-w-44 rounded-md px-1.5 text-muted-foreground hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted data-[popup-open]:text-foreground"
                : "h-8 rounded-lg border bg-background px-2.5 shadow-xs hover:bg-muted/60",
              className
            )}
          />
        }
      >
        <ModelSelectorLogo provider={current.logo} className="size-3" />
        <span className="truncate">{current.name}</span>
        <ChevronDownIcon className="size-3 shrink-0 opacity-60 transition-transform group-data-[popup-open]/model:rotate-180" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="w-[21rem] p-0">
        <div className="border-b px-3 py-2">
          <p className="text-xs font-semibold">Model</p>
          <p className="text-[11px] text-muted-foreground">
            Applies to chat and new agent runs. Agents keep their own overrides.
          </p>
        </div>
        <div className="max-h-[min(60vh,26rem)] overflow-y-auto p-1">
          <DropdownMenuRadioGroup
            value={current.id}
            onValueChange={(v) => updateSettings({ modelId: String(v) })}
          >
            {pinned && (
              <DropdownMenuGroup>
                <DropdownMenuLabel className="flex items-center gap-1.5">
                  <ProviderLogo
                    logo={providerLogo(pinned.provider)}
                    className="size-4 rounded-sm"
                  />
                  From model catalog
                </DropdownMenuLabel>
                <ModelOption
                  model={{
                    id: pinned.id,
                    name: pinned.name,
                    description: pinned.description,
                    logo: providerLogo(pinned.provider),
                    providerLabel: providerLabel(pinned.provider),
                    source: "catalog",
                  }}
                />
              </DropdownMenuGroup>
            )}
            {byProvider.map(([provider, list], i) => (
              <DropdownMenuGroup key={provider}>
                {(i > 0 || pinned) && (
                  <DropdownMenuSeparator className="mx-1" />
                )}
                <DropdownMenuLabel className="flex items-center gap-1.5">
                  <ProviderLogo
                    logo={providerMeta[provider].logo}
                    className="size-4 rounded-sm"
                  />
                  {providerMeta[provider].label}
                </DropdownMenuLabel>
                {list.map((m) => (
                  <ModelOption key={m.id} model={toPicker(m)} />
                ))}
              </DropdownMenuGroup>
            ))}
          </DropdownMenuRadioGroup>
        </div>
        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuGroup className="p-1">
          {pinned && (
            <DropdownMenuItem
              className="text-xs text-muted-foreground"
              onClick={() =>
                updateSettings({
                  catalogModel: undefined,
                  modelId:
                    current.id === pinned.id ? models[1].id : settings.modelId,
                })
              }
            >
              <PinOffIcon /> Unpin {pinned.name}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            render={<Link href="/ai/models" />}
            className="text-xs"
          >
            <ArrowUpRightIcon /> Browse the full model catalog
            <span className="ml-auto text-[10px] text-muted-foreground">
              Live from OpenRouter
            </span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ModelOption({ model }: { model: PickerModel }) {
  return (
    <DropdownMenuRadioItem
      value={model.id}
      closeOnClick
      className="items-start rounded-md py-2 pl-2 data-[checked]:bg-muted/50"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{model.name}</span>
          {model.tier && <TierBadge tier={model.tier} />}
          {model.contextK !== undefined && (
            <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
              {model.contextK >= 1000
                ? `${model.contextK / 1000}M`
                : `${model.contextK}K`}{" "}
              ctx
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
          {model.description}
        </p>
      </div>
    </DropdownMenuRadioItem>
  )
}
