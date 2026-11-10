"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "cn"
import { BinaryIcon } from "lucide-react"

import { StateBadge, type Tone } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { KbStore } from "@/lib/data/knowledge"
import { ModelChip, modelDisplayName } from "../shared"

/* ------------------------------------------------------------------------ */
/* URL state                                                                 */
/* ------------------------------------------------------------------------ */

export const KNOWLEDGE_PATH = "/agentops/knowledge"

/**
 * Read/write a single query param on the knowledge page without dropping the
 * others (tab, open sheet). Uses replace so sheets do not pollute history.
 */
export function useQueryParam(key: string) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const value = params.get(key)
  const set = React.useCallback(
    (next: string | null) => {
      const sp = new URLSearchParams(params.toString())
      if (next) sp.set(key, next)
      else sp.delete(key)
      router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, {
        scroll: false,
      })
    },
    [key, params, pathname, router]
  )
  return [value, set] as const
}

/* ------------------------------------------------------------------------ */
/* Tones for states that are specific to this module                         */
/* ------------------------------------------------------------------------ */

/**
 * States introduced by Knowledge & Memory. Those not yet in the global
 * `stateTone` map get an explicit tone here so badges render correctly until
 * the shared map is extended.
 */
const localTone: Record<string, Tone> = {
  Syncing: "progress",
  Stale: "warning",
  Error: "danger",
  Synced: "success",
  Queued: "muted",
}

export function KbStateBadge({
  state,
  size,
  pulse,
  className,
}: {
  state: string
  size?: "sm" | "default"
  pulse?: boolean
  className?: string
}) {
  return (
    <StateBadge
      state={state}
      tone={localTone[state]}
      size={size}
      pulse={pulse ?? (state === "Syncing" || state === "Running")}
      className={className}
    />
  )
}

/* ------------------------------------------------------------------------ */
/* Chips                                                                     */
/* ------------------------------------------------------------------------ */

const storeTone: Record<KbStore, string> = {
  pgvector: "border-chart-3/30 bg-chart-3/15 text-chart-3",
  Pinecone: "border-brand/30 bg-brand/10 text-brand",
  Weaviate: "border-chart-4/30 bg-chart-4/15 text-chart-4",
  Elasticsearch: "border-chart-2/30 bg-chart-2/15 text-chart-2",
  "Vertex AI Search": "border-chart-5/30 bg-chart-5/15 text-chart-5",
  "Bedrock KB": "border-warning/40 bg-warning/15 text-warning-text",
}

export function StoreBadge({
  store,
  className,
}: {
  store: KbStore
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 px-1.5 text-[11px] font-medium whitespace-nowrap",
        storeTone[store],
        className
      )}
    >
      {store}
    </Badge>
  )
}

/** Providers with a logo on models.dev; others get a generic vector icon. */
const logoProviders = new Set(["openai", "google", "mistral", "amazon"])

export function EmbeddingChip({
  modelId,
  className,
}: {
  modelId: string
  className?: string
}) {
  const provider = modelId.split("/")[0]
  if (logoProviders.has(provider))
    return <ModelChip modelId={modelId} className={className} />
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "inline-flex min-w-0 items-center gap-1.5 text-sm",
              className
            )}
          />
        }
      >
        <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
          <BinaryIcon className="size-3" />
        </span>
        <span className="truncate">{modelDisplayName(modelId)}</span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="font-mono text-xs">{modelId}</span>
      </TooltipContent>
    </Tooltip>
  )
}

/* ------------------------------------------------------------------------ */
/* Layout bits                                                               */
/* ------------------------------------------------------------------------ */

export function Fact({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-lg border bg-muted/30 px-3 py-2", className)}>
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-1 text-sm tabular-nums">{children}</div>
    </div>
  )
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">{children}</h3>
      {action}
    </div>
  )
}

export function pct(n: number, digits = 1) {
  return `${n.toFixed(digits)}%`
}

export function fmtTtl(days: number | null) {
  if (days === null) return "No expiry"
  if (days < 1) return `${Math.round(days * 24)}h`
  if (days >= 365) return `${Math.round(days / 365)}y`
  return `${days}d`
}
