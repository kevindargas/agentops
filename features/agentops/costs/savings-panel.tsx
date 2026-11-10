"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import {
  ArrowRightIcon,
  CheckIcon,
  DatabaseZapIcon,
  LayersIcon,
  LightbulbIcon,
  RouteIcon,
  ScissorsIcon,
  WalletIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { StateBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  savingsOpportunities as seed,
  type SavingsKind,
  type SavingsOpportunity,
} from "@/lib/data/costs"
import { formatCurrency } from "@/lib/format"
import { AgentChip } from "../shared"

const kindMeta: Record<
  SavingsKind,
  { label: string; icon: LucideIcon; tone: string }
> = {
  route: {
    label: "Routing",
    icon: RouteIcon,
    tone: "bg-chart-4/15 text-chart-4",
  },
  caching: {
    label: "Prompt caching",
    icon: DatabaseZapIcon,
    tone: "bg-chart-3/15 text-chart-3",
  },
  "output-tokens": {
    label: "Output tokens",
    icon: ScissorsIcon,
    tone: "bg-brand/10 text-brand",
  },
  batch: {
    label: "Batch API",
    icon: LayersIcon,
    tone: "bg-chart-5/15 text-chart-5",
  },
  commitment: {
    label: "Commitment",
    icon: WalletIcon,
    tone: "bg-success/10 text-success-text",
  },
}

export function SavingsPanel() {
  const [items, setItems] = React.useState<SavingsOpportunity[]>(seed)
  const open = items.filter((s) => s.status === "Open")
  const total = open.reduce((s, o) => s + o.estimatedMonthlySavings, 0)
  const applied = items
    .filter((s) => s.status === "Applied")
    .reduce((s, o) => s + o.estimatedMonthlySavings, 0)

  const set = (id: string, status: SavingsOpportunity["status"]) =>
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-success/10 text-success-text">
            <LightbulbIcon className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">
              <span className="tabular-nums">{formatCurrency(total)}</span> /
              month in open opportunities
            </p>
            <p className="text-xs text-muted-foreground">
              {open.length} open
              {applied > 0 &&
                ` · ${formatCurrency(applied)} / month applied this session`}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/agentops/recommendations" />}
        >
          All recommendations <ArrowRightIcon />
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<CheckIcon />}
          title="No savings left on the table"
          description="Opportunities appear when routing, caching or token usage can be tuned without a quality regression."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((s) => (
            <SavingsCard
              key={s.id}
              item={s}
              onApply={() => {
                set(s.id, "Applied")
                toast.success("Applied", {
                  description: `${s.title} · saves about ${formatCurrency(s.estimatedMonthlySavings)}/month`,
                })
              }}
              onDismiss={() => {
                set(s.id, "Dismissed")
                toast("Opportunity dismissed")
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SavingsCard({
  item: s,
  onApply,
  onDismiss,
}: {
  item: SavingsOpportunity
  onApply: () => void
  onDismiss: () => void
}) {
  const meta = kindMeta[s.kind]
  const Icon = meta.icon
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card p-5",
        s.status === "Dismissed" && "opacity-70"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
            meta.tone
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium tracking-wide uppercase">
              {meta.label}
            </span>
            <span aria-hidden>·</span>
            <AgentChip agentId={s.agentId} size="sm" />
            <span aria-hidden>·</span>
            <span className="capitalize">{s.effort} effort</span>
          </div>
          <h3 className="mt-0.5 text-base leading-snug font-semibold">
            {s.title}
          </h3>
        </div>
        {s.status !== "Open" && <StateBadge state={s.status} size="sm" />}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {s.summary}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
        <Badge
          variant="outline"
          className="gap-1 border-success/30 text-success-text"
        >
          Saves ~{formatCurrency(s.estimatedMonthlySavings)}/mo
        </Badge>
        <div className="ml-auto flex items-center gap-1.5">
          {s.recommendationId && (
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/agentops/recommendations" />}
            >
              <LightbulbIcon /> Recommendation
            </Button>
          )}
          {s.status === "Open" && (
            <>
              <Button size="sm" onClick={onApply}>
                <CheckIcon /> Apply
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Dismiss opportunity"
                onClick={onDismiss}
              >
                <XIcon />
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
