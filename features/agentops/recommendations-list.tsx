"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import {
  ArrowRightIcon,
  CheckIcon,
  CoinsIcon,
  FlaskConicalIcon,
  GaugeIcon,
  LayersIcon,
  SparklesIcon,
  TriangleAlertIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { Eyebrow } from "@/components/shared/eyebrow"
import { StateBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { defaultExperimentSplit } from "@/lib/data/agentops"
import { formatCurrency, timeAgo } from "@/lib/format"
import type {
  ModelRecommendation,
  RecommendationKind,
  RecommendationStatus,
} from "@/lib/types"
import { AgentChip, ModelChip } from "./shared"
import { draftExperiment, recommendationStore } from "./stores"

const kindMeta: Record<
  RecommendationKind,
  { label: string; icon: LucideIcon; tone: string }
> = {
  cost: {
    label: "Cost",
    icon: CoinsIcon,
    tone: "bg-success/10 text-success-text",
  },
  quality: {
    label: "Quality",
    icon: SparklesIcon,
    tone: "bg-brand/10 text-brand",
  },
  latency: {
    label: "Latency",
    icon: GaugeIcon,
    tone: "bg-chart-4/15 text-chart-4",
  },
  deprecation: {
    label: "Deprecation",
    icon: TriangleAlertIcon,
    tone: "bg-warning/15 text-warning-text",
  },
  context: {
    label: "Context",
    icon: LayersIcon,
    tone: "bg-chart-3/15 text-chart-3",
  },
}

const isOpen = (r: ModelRecommendation) =>
  r.status === "New" || r.status === "Testing"

export function RecommendationsList({
  agentId,
  highlightId,
}: {
  agentId?: string
  /** `?open=<rec-id>`: scroll to and outline this card. */
  highlightId?: string
}) {
  const items = recommendationStore.use()
  const [status, setStatus] = React.useState<
    "open" | RecommendationStatus | "all"
  >(() => {
    const target = highlightId
      ? items.find((r) => r.id === highlightId)
      : undefined
    return target && !isOpen(target) ? "all" : "open"
  })
  const scoped = agentId ? items.filter((r) => r.agentId === agentId) : items
  const visible = scoped
    .filter((r) =>
      status === "open"
        ? isOpen(r)
        : status === "all"
          ? true
          : r.status === status
    )
    .sort((a, b) => b.confidence - a.confidence)
  const savings = scoped
    .filter(isOpen)
    .reduce((s, r) => s + (r.savingsPerMonth ?? 0), 0)

  React.useEffect(() => {
    if (!highlightId) return
    document
      .getElementById(`rec-${highlightId}`)
      ?.scrollIntoView({ block: "center" })
  }, [highlightId])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup
          value={[status]}
          onValueChange={(v) => v[0] && setStatus(v[0] as typeof status)}
          aria-label="Filter recommendations"
        >
          {(
            ["open", "New", "Testing", "Applied", "Dismissed", "all"] as const
          ).map((v) => (
            <ToggleGroupItem
              key={v}
              value={v}
              size="sm"
              className="text-xs capitalize"
            >
              {v}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {savings > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              {formatCurrency(savings)}
            </span>{" "}
            / month identified in open recommendations
          </p>
        )}
      </div>
      {visible.length === 0 ? (
        <EmptyState
          icon={<CheckIcon />}
          title="Nothing to recommend"
          description="Recommendations appear when shadow evaluations, experiments or provider notices show a better configuration for an agent."
          action={
            status !== "all" ? (
              <Button variant="outline" onClick={() => setStatus("all")}>
                Show all
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map((r) => (
            <RecommendationCard
              key={r.id}
              rec={r}
              highlighted={r.id === highlightId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RecommendationCard({
  rec: r,
  highlighted,
}: {
  rec: ModelRecommendation
  highlighted?: boolean
}) {
  const router = useRouter()
  const meta = kindMeta[r.kind]
  const Icon = meta.icon
  const sameModel = r.fromModelId === r.toModelId
  const shortTitle = r.title.split(":")[0]

  const setStatus = (
    next: RecommendationStatus,
    title: string,
    description: string
  ) => {
    const previous = r
    recommendationStore.patch(r.id, { status: next })
    toast(title, {
      description,
      action: {
        label: "Undo",
        onClick: () =>
          recommendationStore.set((prev) =>
            prev.map((x) => (x.id === previous.id ? previous : x))
          ),
      },
      duration: 6000,
    })
  }

  const startTest = () => {
    const exp = draftExperiment({
      agentId: r.agentId,
      kind: sameModel ? "prompt" : "model",
      primaryMetric:
        r.kind === "cost"
          ? "cost"
          : r.kind === "latency"
            ? "latency"
            : "quality",
      name: r.title,
      hypothesis: r.summary,
      toModelId: sameModel ? undefined : r.toModelId,
    })
    recommendationStore.patch(r.id, { status: "Testing", experimentId: exp.id })
    toast.success(`A/B test drafted with a ${defaultExperimentSplit}% split`, {
      description: `${exp.name} · Draft, start it from the experiment sheet`,
      action: {
        label: "Open experiment",
        onClick: () => router.push(`/agentops/experiments?open=${exp.id}`),
      },
    })
  }

  return (
    <article
      id={`rec-${r.id}`}
      className={cn(
        "flex scroll-mt-24 flex-col gap-4 rounded-xl border bg-card p-5",
        r.status === "Dismissed" && "opacity-70",
        highlighted && "ring-2 ring-ring/50"
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
          <Eyebrow className="flex flex-wrap items-center gap-1.5 normal-case">
            <span className="uppercase">{meta.label}</span>
            <span aria-hidden>·</span>
            <AgentChip agentId={r.agentId} size="sm" />
            <span aria-hidden>·</span>
            {timeAgo(r.created)}
          </Eyebrow>
          <h3 className="mt-0.5 text-base leading-snug font-semibold">
            {r.title}
          </h3>
        </div>
        <StateBadge state={r.status} size="sm" />
      </div>

      {!sameModel && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <ModelChip modelId={r.fromModelId} showProvider className="text-xs" />
          <ArrowRightIcon className="size-3.5 text-muted-foreground" />
          <ModelChip
            modelId={r.toModelId}
            showProvider
            className="text-xs font-medium"
          />
        </div>
      )}

      <p className="text-sm leading-relaxed text-muted-foreground">
        {r.summary}
      </p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[1fr_auto_auto_auto]">
        {r.evidence.map((ev) => (
          <React.Fragment key={ev.metric}>
            <dt className="col-span-2 text-muted-foreground sm:col-span-1">
              {ev.metric}
            </dt>
            <dd className="font-mono text-xs text-muted-foreground tabular-nums sm:text-right">
              {ev.from}
            </dd>
            <dd className="hidden text-muted-foreground sm:block">
              <ArrowRightIcon className="size-3" />
            </dd>
            <dd
              className={cn(
                "font-mono text-xs font-medium tabular-nums sm:text-right",
                ev.good ? "text-success-text" : "text-danger-text"
              )}
            >
              {ev.to}
            </dd>
          </React.Fragment>
        ))}
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          Confidence{" "}
          <span className="font-mono text-foreground tabular-nums">
            {Math.round(r.confidence * 100)}%
          </span>
        </Badge>
        {r.savingsPerMonth && (
          <Badge
            variant="outline"
            className="gap-1 border-success/30 text-success-text"
          >
            Saves {formatCurrency(r.savingsPerMonth)}/mo
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {r.experimentId ? (
            <Button
              variant="outline"
              size="sm"
              render={
                <Link href={`/agentops/experiments?open=${r.experimentId}`} />
              }
            >
              <FlaskConicalIcon /> View experiment
            </Button>
          ) : (
            r.status === "New" && (
              <Button variant="outline" size="sm" onClick={startTest}>
                <FlaskConicalIcon /> Start A/B test
              </Button>
            )
          )}
          {isOpen(r) && (
            <>
              <Button
                size="sm"
                onClick={() =>
                  setStatus(
                    "Applied",
                    `Marked applied: ${shortTitle}`,
                    "Status only. Ship the change through Deployments so the agent record follows."
                  )
                }
              >
                <CheckIcon /> Apply
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Dismiss recommendation"
                onClick={() =>
                  setStatus(
                    "Dismissed",
                    "Recommendation dismissed",
                    `${shortTitle} stays listed under Dismissed for the record.`
                  )
                }
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
