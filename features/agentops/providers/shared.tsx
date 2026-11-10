"use client"

import { cn } from "cn"

import { ModelSelectorLogo } from "@/components/ai-elements/model-selector"
import { StateBadge, type Tone } from "@/components/shared/status-badge"
import { getProvider } from "@/lib/data/providers"

/**
 * Tones for gateway states that are not yet in `stateTone`
 * (components/shared/status-badge.tsx). Passing the tone explicitly keeps the
 * badge readable until the shared map picks these strings up.
 */
const gatewayTone: Record<string, Tone> = {
  Connected: "success",
  Disconnected: "danger",
  Expiring: "warning",
  Revoked: "muted",
  Rotating: "progress",
  Exceeded: "danger",
  Investigating: "danger",
  Monitoring: "warning",
}

export function GatewayBadge({
  state,
  size,
  className,
  pulse,
}: {
  state: string
  size?: "sm" | "default"
  className?: string
  pulse?: boolean
}) {
  return (
    <StateBadge
      state={state}
      tone={gatewayTone[state]}
      size={size}
      className={className}
      pulse={pulse}
    />
  )
}

export function ProviderLogo({
  logo,
  className,
  size = "default",
}: {
  logo: string
  className?: string
  size?: "sm" | "default" | "lg"
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border bg-background",
        size === "sm"
          ? "size-5"
          : size === "lg"
            ? "size-10 rounded-lg"
            : "size-7",
        className
      )}
    >
      <ModelSelectorLogo
        provider={logo}
        className={
          size === "sm" ? "size-3" : size === "lg" ? "size-5" : "size-3.5"
        }
      />
    </span>
  )
}

/** Logo + name for a gateway provider, used in table cells and chains. */
export function ProviderChip({
  providerId,
  className,
  size = "default",
}: {
  providerId: string
  className?: string
  size?: "sm" | "default"
}) {
  const p = getProvider(providerId)
  if (!p) return <span className="text-muted-foreground">Unknown</span>
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5",
        size === "sm" ? "text-xs" : "text-sm",
        className
      )}
      title={p.name}
    >
      <ProviderLogo logo={p.logo} size="sm" />
      <span className="truncate">{p.name}</span>
    </span>
  )
}

export function pctTone(
  pct: number
): "success" | "brand" | "warning" | "danger" {
  if (pct >= 95) return "danger"
  if (pct >= 80) return "warning"
  return "brand"
}
